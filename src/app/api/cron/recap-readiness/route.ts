// ============================================================
// GET /api/cron/recap-readiness — daily readiness sweep.
//
// For every campaign_recaps row that is 'delivered' with an effective date
// (admin_created_on, else created_at) inside the last 120 days, runs the five
// readiness checks, records a recap_readiness row per campaign, and emails one
// report to the address below.
//
// Guarded by CRON_SECRET exactly as the other crons are — Vercel sends
// `Authorization: Bearer <CRON_SECRET>` automatically. Fails CLOSED in
// production so a missing secret cannot leave a write-capable endpoint open.
//
// Manual runs:
//   /api/cron/recap-readiness?dry_run=1   → returns the report, writes nothing,
//                                            sends no email
//
// NO EMAIL WHEN THE WINDOW IS EMPTY. Zero delivered campaigns in 120 days means
// nothing to say, and a daily "nothing to report" trains the recipient to
// ignore the sender.
//
// Makes no model call, so the agent_runs row it writes costs $0. It is logged
// anyway: an unattended job that silently stops running is the failure mode
// worth catching, and a missing row is how the weekly digest would notice.
// ============================================================

import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { sendMail } from "@/lib/mail";
import { startRun, finishRun, failRun } from "@/lib/agents/run-log";
import { checkRecap, deliveredInWindow, priorVerdicts, type ReadinessCheck } from "@/lib/recap-readiness";
import { renderReadinessEmail, WINDOW_DAYS } from "@/lib/recap-readiness-email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REPORT_TO = process.env.AGENT_ALERT_EMAIL ?? "peyton@pstgm.com";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1";
  const supabase = createServiceSupabase();
  const startedAt = Date.now();

  const runId = dryRun
    ? null
    : await startRun(supabase, {
        agentName: "recap_readiness",
        model: "none",
        triggerSource: "cron",
        input: { window_days: WINDOW_DAYS },
      });

  try {
    const recaps = await deliveredInWindow(supabase, WINDOW_DAYS);

    if (recaps.length === 0) {
      await finishRun(supabase, runId, {
        model: "none",
        output: { campaigns: 0, emailed: false, reason: "no delivered campaigns in window" },
        startedAt,
      });
      return NextResponse.json({ ok: true, campaigns: 0, emailed: false });
    }

    // What the last sweep concluded, read BEFORE this run writes its own rows.
    const prior = await priorVerdicts(supabase, recaps.map((r) => r.id));

    // Sequential rather than Promise.all: each check may make a paged Drive
    // call, and a burst across every delivered campaign is the shape that gets
    // an API rate-limited.
    const checks: ReadinessCheck[] = [];
    for (const recap of recaps) {
      checks.push(await checkRecap(supabase, recap));
    }

    // Email only on news. Two things count:
    //   • a campaign this sweep has never checked — it newly became delivered,
    //     or newly entered the 120-day window
    //   • a campaign that was not ready last time and is ready now
    //
    // A ready -> not-ready regression is deliberately NOT news: readiness is
    // driven by counts that only grow in normal use, so a drop means data was
    // removed, and a daily email is the wrong channel for that. It still lands
    // in the rows, and the weekly digest still shows the totals.
    const newlyChecked = checks.filter((c) => !prior.has(c.recapId));
    const flipped = checks.filter((c) => prior.get(c.recapId) === false && c.ready);
    const changed = newlyChecked.length > 0 || flipped.length > 0;

    const { subject, text } = renderReadinessEmail(checks, { newlyChecked, flipped });

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        campaigns: checks.length,
        ready: checks.filter((c) => c.ready).length,
        wouldEmail: changed,
        newlyChecked: newlyChecked.length,
        flipped: flipped.length,
        subject,
        text,
      });
    }

    // Rows are written either way — only the email is conditional. The history
    // stays complete, so the weekly digest and "when did this become ready"
    // both keep working on quiet days.
    const sent = changed
      ? await sendMail({ to: REPORT_TO, subject, text })
      : { sent: false, error: null as string | null };
    if (changed && !sent.sent) console.error(`[readiness] report not sent: ${sent.error}`);

    await finishRun(supabase, runId, {
      model: "none",
      output: {
        campaigns: checks.length,
        ready: checks.filter((c) => c.ready).length,
        newly_checked: newlyChecked.length,
        flipped_to_ready: flipped.length,
        emailed: sent.sent,
        email_error: sent.error,
      },
      startedAt,
    });

    return NextResponse.json({
      ok: true,
      campaigns: checks.length,
      ready: checks.filter((c) => c.ready).length,
      newlyChecked: newlyChecked.length,
      flipped: flipped.length,
      emailed: sent.sent,
    });
  } catch (e) {
    await failRun(supabase, runId, { model: "none", error: e, startedAt });
    console.error("[readiness] sweep failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "readiness sweep failed" }, { status: 500 });
  }
}
