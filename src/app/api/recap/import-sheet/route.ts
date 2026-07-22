// src/app/api/recap/import-sheet/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/recap/import-sheet
// Body: { url }  — a Google Sheet link (tab gid preserved from the URL)
//
// Reads the sheet as CSV via the shared Postgame Google token and parses it
// into athlete rows, reusing the exact server-side path the Slack recap-intake
// cron already runs (fetchTrackerCsv → parseTrackerAthletes). The Google token
// stays server-only; the caller inserts the returned rows like a CSV import.
//
// The sheet must be readable by the Postgame Google account behind
// GOOGLE_REFRESH_TOKEN (shared with it, or public). No access → { ok:false }.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { fetchTrackerCsv, parseTrackerAthletes } from "@/lib/recap-intake";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Staff-only, like the other recap/drive routes.
  const authClient = createServerSupabase();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, reason: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ ok: false, reason: "Missing sheet URL" }, { status: 400 });
  }

  // fetchTrackerCsv never throws; a fetch/access failure comes back as ok:false
  // with a human-readable reason. Surface it at 200 so the client can show it
  // inline rather than treating it as a server error.
  const tracker = await fetchTrackerCsv(url);
  if (!tracker.ok || !tracker.csv) {
    return NextResponse.json(
      { ok: false, reason: tracker.reason || "could not read sheet", sheetId: tracker.sheetId, gid: tracker.gid },
      { status: 200 },
    );
  }

  try {
    const athletes = parseTrackerAthletes(tracker.csv);
    return NextResponse.json({
      ok: true,
      athletes,
      count: athletes.length,
      // Raw CSV so the editor can run its own parseMetricsCSV + merge-into-grid
      // (the create modal uses `athletes` for a direct insert instead).
      csv: tracker.csv,
      sheetId: tracker.sheetId,
      gid: tracker.gid,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, reason: `parse error: ${String(e?.message || e)}` },
      { status: 200 },
    );
  }
}
