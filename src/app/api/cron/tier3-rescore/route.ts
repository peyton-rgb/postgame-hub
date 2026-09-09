// ============================================================
// Tier3 re-score sweeper — retries submissions that failed on a Drive 404
//
// Google Drive builds video poster frames ASYNCHRONOUSLY. Scoring fires from the
// upload route seconds after the file lands, so for a video the thumbnail URL
// often 404s and then starts working a minute or two later. The row was being
// marked scoring_failed permanently, with nothing to pick it back up.
//
// /api/tier3/process now retries in-request, but only for ~17s — it runs inside
// the request the athlete's upload is waiting on and cannot sleep for minutes.
// Measured across the five video rows that failed this way, scoring ran 2s, 2s,
// 25s, 35s and 64s after upload, so two of the five were already past any budget
// that route could reasonably carry. This sweeper is what covers those.
//
// DELIBERATELY NARROW. It only touches rows whose recorded error was a 404:
// a 401/403 is permissions and a 410 is deletion, and retrying either hourly
// forever would be noise hiding a real problem. rescore_attempts caps it at 5.
//
// Guarded by CRON_SECRET exactly as the other crons are — Vercel sends
// `Authorization: Bearer <CRON_SECRET>` automatically. Fails CLOSED in
// production so a missing secret can never leave a write-capable endpoint open.
// ============================================================

import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Give up after this many sweeps, so a genuinely dead row stops being retried. */
const MAX_ATTEMPTS = 5;
/** Leave the in-request retry room to win before the sweeper takes over. */
const MIN_AGE_MINUTES = 10;
/** Bounded per run: the sweeper shares its 60s with the scoring calls it makes. */
const BATCH = 10;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const cutoff = new Date(Date.now() - MIN_AGE_MINUTES * 60_000).toISOString();

  const { data: rows, error } = await supabase
    .from("tier3_submissions")
    .select("id, athlete_name, rescore_attempts, scoring_error")
    .eq("status", "scoring_failed")
    .ilike("scoring_error", "%404%")
    .lt("rescore_attempts", MAX_ATTEMPTS)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("[tier3-rescore] query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows?.length) {
    return NextResponse.json({ ok: true, considered: 0, requeued: 0 });
  }

  // Re-run the real scoring path rather than duplicating it: /api/tier3/process
  // only acts on status 'pending_review', so flip the row back first. The
  // attempt counter increments here, not there, so a row cannot be retried
  // forever by repeated manual triggers either.
  const origin = new URL(req.url).origin;
  const results: { id: string; athlete: string | null; ok: boolean; detail?: string }[] = [];

  for (const row of rows) {
    const { error: resetErr } = await supabase
      .from("tier3_submissions")
      .update({
        status: "pending_review",
        scoring_error: null,
        rescore_attempts: (row.rescore_attempts ?? 0) + 1,
      })
      .eq("id", row.id);

    if (resetErr) {
      results.push({ id: row.id, athlete: row.athlete_name, ok: false, detail: resetErr.message });
      continue;
    }

    try {
      const res = await fetch(`${origin}/api/tier3/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: row.id }),
      });
      results.push({
        id: row.id,
        athlete: row.athlete_name,
        ok: res.ok,
        detail: res.ok ? undefined : `process returned HTTP ${res.status}`,
      });
    } catch (e) {
      results.push({
        id: row.id,
        athlete: row.athlete_name,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    considered: rows.length,
    requeued: results.filter((r) => r.ok).length,
    results,
  });
}
