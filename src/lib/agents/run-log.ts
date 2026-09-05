// ============================================================
// agent_runs lifecycle for call sites that had none.
//
// Eight places called a model and logged nothing: their spend was invisible,
// which meant no cap in agent_budgets could ever bind on them. They logged
// nothing largely because agent_runs.triggered_by was NOT NULL and a foreign
// key to auth.users, and most of them have no user in scope — an unattended
// path had no honest value to put there.
//
// triggered_by is now nullable and trigger_source records why:
//   user   — a person caused it, triggered_by is set
//   cron   — a scheduled job
//   system — an unattended code path with no request behind it
//
// The existing agents keep their own inline logging. This is for the ones that
// had none; converting the others would be churn with no behaviour change.
//
// NEVER THROWS. Logging must not be able to fail a run that otherwise
// succeeded, so every function here swallows and warns. startRun returning null
// simply means the finish/fail calls become no-ops.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { usageFrom } from "@/lib/agents/pricing";

export type TriggerSource = "user" | "cron" | "system";

export interface StartRunInput {
  agentName: string;
  model: string;
  /** Omit for cron/system runs. */
  triggeredBy?: string | null;
  triggerSource?: TriggerSource;
  input?: Record<string, unknown>;
}

/**
 * Open a 'running' row. Returns its id, or null if it could not be written.
 *
 * A null return is not an error the caller should act on — it means this run
 * will not appear in cost reporting, which is logged here and nowhere else.
 */
export async function startRun(db: SupabaseClient, input: StartRunInput): Promise<string | null> {
  try {
    const { data, error } = await db
      .from("agent_runs")
      .insert({
        agent_name: input.agentName,
        triggered_by: input.triggeredBy ?? null,
        trigger_source: input.triggerSource ?? (input.triggeredBy ? "user" : "system"),
        input_payload: input.input ?? {},
        model: input.model,
        status: "running",
      })
      .select("id")
      .single();

    if (error) {
      console.warn(`[run-log] could not open a run for ${input.agentName}: ${error.message}`);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    console.warn(`[run-log] startRun threw for ${input.agentName}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Close a run as complete, recording tokens and cost.
 *
 * `usage` is the Anthropic response's usage object; the rate is resolved from
 * the model id through lib/agents/pricing.
 */
export async function finishRun(
  db: SupabaseClient,
  runId: string | null,
  args: {
    model: string;
    usage?: { input_tokens?: number | null; output_tokens?: number | null } | null;
    output?: unknown;
    startedAt?: number;
  },
): Promise<void> {
  if (!runId) return;
  try {
    await db
      .from("agent_runs")
      .update({
        status: "complete",
        ...usageFrom(args.model, args.usage),
        output_payload: (args.output ?? null) as never,
        duration_ms: args.startedAt ? Date.now() - args.startedAt : null,
      })
      .eq("id", runId);
  } catch (e) {
    console.warn("[run-log] finishRun failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Close a run as failed. Tokens are recorded when the provider returned any —
 * a call that errored partway still costs money.
 */
export async function failRun(
  db: SupabaseClient,
  runId: string | null,
  args: {
    model: string;
    error: unknown;
    usage?: { input_tokens?: number | null; output_tokens?: number | null } | null;
    startedAt?: number;
  },
): Promise<void> {
  if (!runId) return;
  try {
    await db
      .from("agent_runs")
      .update({
        status: "failed",
        ...usageFrom(args.model, args.usage),
        error_message: args.error instanceof Error ? args.error.message : String(args.error),
        duration_ms: args.startedAt ? Date.now() - args.startedAt : null,
      })
      .eq("id", runId);
  } catch (e) {
    console.warn("[run-log] failRun failed:", e instanceof Error ? e.message : e);
  }
}

/**
 * Wrap one model call so it opens, closes and costs its own agent_runs row.
 *
 * For the call sites that had no logging at all and often make several calls
 * per file — one wrapper per call beats hand-rolling the lifecycle at each.
 * The response is returned untouched, so adding this to an existing call
 * changes nothing the caller sees.
 *
 *   const response = await trackedCall(
 *     supabase,
 *     { agentName: "analytics", model: MODEL, triggerSource: "system" },
 *     () => anthropic.messages.create({ ... }),
 *   );
 */
export async function trackedCall<T extends { usage?: { input_tokens?: number | null; output_tokens?: number | null } | null }>(
  db: SupabaseClient,
  meta: StartRunInput,
  call: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  const runId = await startRun(db, meta);
  try {
    const response = await call();
    await finishRun(db, runId, { model: meta.model, usage: response?.usage, startedAt });
    return response;
  } catch (err) {
    await failRun(db, runId, { model: meta.model, error: err, startedAt });
    throw err;
  }
}
