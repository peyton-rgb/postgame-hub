// ============================================================
// Per-agent monthly spend cap.
//
// Call assertAgentBudget() immediately before a model call. If this calendar
// month's agent_runs.cost_usd for that agent has reached its agent_budgets cap,
// the verdict is `allowed: false` and the caller must skip the call.
//
// WHAT "would exceed" MEANS HERE. The brief says to block a call that would
// exceed the cap, but the cost of a call is not knowable until it returns —
// tokens are counted on the response. So the test is whether the month is
// ALREADY at or over the cap. The practical difference is one final call that
// can cross the line before the gate shuts; the alternative would be guessing a
// price per call and blocking on the guess.
//
// FAIL OPEN, DELIBERATELY. No budget row, enabled = false, or a database error
// all return allowed. A spend cap that turns a Supabase blip into a silent
// outage across every agent is worse than one that misses a day of enforcement.
// The gap is visible rather than hidden: an agent with no row is reported by
// the weekly health check.
//
// COST DATA IS INCOMPLETE, which limits what this can enforce. 89 of the 140
// agent_runs rows have cost_usd null, and three agents never write it at all —
// their month always sums to 0 and their cap can never bind. See the notes in
// the health check for which.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMail } from "@/lib/mail";

/** Where budget alerts go. */
const ALERT_EMAIL = process.env.AGENT_ALERT_EMAIL ?? "peyton@pstgm.com";

/** Business timezone — the "one alert per day" window and month boundaries. */
const TZ = "America/New_York";

export interface BudgetVerdict {
  allowed: boolean;
  agentName: string;
  /** null when no agent_budgets row exists for this agent. */
  capUsd: number | null;
  /** This calendar month's summed cost_usd. Nulls count as 0. */
  spentUsd: number;
  /** Human-readable, safe to log. */
  reason: string;
}

/** YYYY-MM-DD for "today" in the business timezone. */
function etDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * First instant of the current calendar month IN THE BUSINESS TIMEZONE, as UTC.
 *
 * Not `YYYY-MM-01T00:00:00Z`: that is midnight UTC, which is 8pm ET the evening
 * BEFORE the month starts, so four hours of the previous month's spend would be
 * charged to the new one. The offset is measured at the boundary instant rather
 * than assumed, so this stays correct across the DST change.
 */
function monthStartIso(): string {
  const [y, m] = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);

  // Read the 1st at 00:00 as wall-clock numbers, then shift by the zone's
  // offset AT that moment. Both sides are re-parsed through toLocaleString so
  // the arithmetic does not depend on the server's own timezone.
  const wallClock = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const asTz = new Date(wallClock.toLocaleString("en-US", { timeZone: TZ }));
  const asUtc = new Date(wallClock.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(wallClock.getTime() + (asUtc.getTime() - asTz.getTime())).toISOString();
}

/**
 * Is this agent still under its cap?
 *
 * Never throws. `db` must be a service-role client: agent_budgets is RLS'd to
 * staff, and an agent has no session.
 */
export async function checkAgentBudget(
  db: SupabaseClient,
  agentName: string,
): Promise<BudgetVerdict> {
  const base: BudgetVerdict = {
    allowed: true,
    agentName,
    capUsd: null,
    spentUsd: 0,
    reason: "no cap configured",
  };

  try {
    const { data: budget } = await db
      .from("agent_budgets")
      .select("monthly_cap_usd, enabled")
      .eq("agent_name", agentName)
      .maybeSingle();

    const row = budget as { monthly_cap_usd: number | string; enabled: boolean } | null;
    if (!row) return base;
    if (!row.enabled) {
      return { ...base, capUsd: Number(row.monthly_cap_usd), reason: "cap disabled" };
    }

    const cap = Number(row.monthly_cap_usd);

    // Nulls are excluded by the sum rather than treated as unknown spend: an
    // agent that never records cost is under-counted, never over-blocked.
    const { data: runs } = await db
      .from("agent_runs")
      .select("cost_usd")
      .eq("agent_name", agentName)
      .gte("created_at", monthStartIso());

    const spent = ((runs as Array<{ cost_usd: number | string | null }> | null) ?? []).reduce(
      (sum, r) => sum + Number(r.cost_usd ?? 0),
      0,
    );

    if (spent >= cap) {
      return {
        allowed: false,
        agentName,
        capUsd: cap,
        spentUsd: spent,
        reason: `month-to-date $${spent.toFixed(4)} has reached the $${cap.toFixed(2)} cap`,
      };
    }
    return {
      allowed: true,
      agentName,
      capUsd: cap,
      spentUsd: spent,
      reason: `under cap ($${spent.toFixed(4)} of $${cap.toFixed(2)})`,
    };
  } catch (e) {
    console.error(`[budget] check failed for ${agentName}, allowing:`, e instanceof Error ? e.message : e);
    return { ...base, reason: "budget check errored — failing open" };
  }
}

/**
 * The uuid to attribute a skipped run to.
 *
 * agent_runs.triggered_by is NOT NULL and a foreign key to auth.users, so even
 * a run that never happened needs a real person. The alert recipient's profile
 * is the one already implied by this feature; if they have no profile row the
 * insert is skipped rather than faked.
 */
async function resolveActor(db: SupabaseClient, explicit?: string | null): Promise<string | null> {
  if (explicit) return explicit;
  try {
    const { data } = await db.from("profiles").select("id").ilike("email", ALERT_EMAIL).maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Record the skipped call and, at most once per agent per ET day, email.
 *
 * Two things can each fail without stopping the other: the agent_runs insert
 * fails for any caller whose name is not a member of the agent_name enum
 * (pitch generation, tier3, the auto-editor, suggestions), and the email fails
 * if the mailbox is not configured. Both are logged.
 *
 * The once-a-day stamp lives on agent_budgets.last_alert_at rather than being
 * derived from agent_runs, precisely because the insert above is not available
 * to every caller.
 */
export async function recordBudgetExceeded(
  db: SupabaseClient,
  verdict: BudgetVerdict,
  opts: { triggeredBy?: string | null; context?: Record<string, unknown> } = {},
): Promise<void> {
  const { agentName, capUsd, spentUsd, reason } = verdict;

  // 1. The run row.
  const actor = await resolveActor(db, opts.triggeredBy);
  if (!actor) {
    console.warn(`[budget] no actor to attribute the skipped ${agentName} run to — not logging agent_runs`);
  } else {
    const { error } = await db.from("agent_runs").insert({
      agent_name: agentName,
      triggered_by: actor,
      input_payload: { skipped: true, reason, cap_usd: capUsd, spent_usd: spentUsd, ...opts.context },
      status: "budget_exceeded",
      cost_usd: 0,
      error_message: reason,
    });
    if (error) {
      // Expected for any agent_name that is not an enum member.
      console.warn(`[budget] could not log budget_exceeded for ${agentName}: ${error.message}`);
    }
  }

  // 2. The email, throttled.
  try {
    const { data } = await db
      .from("agent_budgets")
      .select("last_alert_at")
      .eq("agent_name", agentName)
      .maybeSingle();

    const last = (data as { last_alert_at: string | null } | null)?.last_alert_at ?? null;
    if (last && etDay(new Date(last)) === etDay()) return; // already alerted today

    const capText = capUsd == null ? "(no cap row)" : `$${capUsd.toFixed(2)}`;
    const sent = await sendMail({
      to: ALERT_EMAIL,
      subject: `Agent budget reached — ${agentName}`,
      text: [
        `${agentName} has reached its monthly spend cap and its model calls are being skipped.`,
        "",
        `  month-to-date : $${spentUsd.toFixed(4)}`,
        `  monthly cap   : ${capText}`,
        "",
        "Calls stay blocked until the cap is raised in agent_budgets or the",
        "calendar month rolls over. To raise it:",
        "",
        `  update agent_budgets set monthly_cap_usd = <new> where agent_name = '${agentName}';`,
        "",
        "To disable the cap for this agent without losing the number:",
        "",
        `  update agent_budgets set enabled = false where agent_name = '${agentName}';`,
        "",
        "This is sent at most once per agent per day.",
      ].join("\n"),
    });

    if (!sent.sent) {
      console.warn(`[budget] alert email for ${agentName} not sent: ${sent.error}`);
      return; // no stamp, so a working mailbox still gets today's alert
    }
    await db
      .from("agent_budgets")
      .update({ last_alert_at: new Date().toISOString() })
      .eq("agent_name", agentName);
  } catch (e) {
    console.error(`[budget] alerting failed for ${agentName}:`, e instanceof Error ? e.message : e);
  }
}

/**
 * The one call an agent entry point needs.
 *
 *   const verdict = await assertAgentBudget(supabase, "intake");
 *   if (!verdict.allowed) return;   // skip the model call
 *
 * Checks, and on a denial records the row and sends the throttled email.
 */
export async function assertAgentBudget(
  db: SupabaseClient,
  agentName: string,
  opts: { triggeredBy?: string | null; context?: Record<string, unknown> } = {},
): Promise<BudgetVerdict> {
  const verdict = await checkAgentBudget(db, agentName);
  if (!verdict.allowed) {
    console.warn(`[budget] skipping ${agentName} model call: ${verdict.reason}`);
    await recordBudgetExceeded(db, verdict, opts);
  }
  return verdict;
}
