// src/app/api/drive/render-callback/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/render-callback   (called by the FFmpeg worker, not the browser)
// Body: { jobId, ok, folderId, results: [{spec, fileId, webViewLink, name}] }  | { jobId, ok:false, error }
//
// The worker reports its composited video results here. We flip the job row to
// done/failed and write the per-spec links into the tracker's "Video w/ graphic"
// columns J–O (reusing update-tracker's =HYPERLINK / USER_ENTERED pattern).
// Auth: the worker carries x-ffmpeg-secret (same shared secret).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createServiceSupabase } from "@/lib/supabase";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TRACKER_SHEET_ID = "1Av15uc0dqbCWljdhUO2CBerrDXIrzf2GswpcZtTcqMA";
const DATA_START_ROW = 3;   // rows 1–2 are the two-row header
// spec → "Video w/ graphic" column (J–O), and the display label.
const VIDEO_COLUMNS: Record<string, string> = { reels: "J", story: "K", tiktok: "L", shorts: "M", igfeed: "N", linkedin: "O" };
const SPEC_LABEL: Record<string, string> = { reels: "Reels", story: "Story", tiktok: "TikTok", shorts: "Shorts", igfeed: "IG feed", linkedin: "LinkedIn" };

function hyperlink(url: string, label: string): string {
  return `=HYPERLINK("${String(url).replace(/"/g, '""')}","${String(label).replace(/"/g, '""')}")`;
}

// Write each video link into J–O on the athlete's existing tracker row (find-only;
// the row is created earlier by the photo export). Mirrors update-tracker.
async function writeVideoLinks(athleteName: string, results: any[]) {
  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: TRACKER_SHEET_ID, fields: "sheets.properties(title)" });
  const tab = meta.data.sheets?.[0]?.properties?.title;
  if (!tab) return;

  const colA = await sheets.spreadsheets.values.get({ spreadsheetId: TRACKER_SHEET_ID, range: `'${tab}'!A:A` });
  const rows = colA.data.values || [];
  const want = athleteName.trim().toLowerCase();
  let rowNumber = -1;
  for (let i = DATA_START_ROW - 1; i < rows.length; i++) {
    if ((rows[i]?.[0] ?? "").toString().trim().toLowerCase() === want) { rowNumber = i + 1; break; }
  }
  if (rowNumber === -1) return;   // no row yet (athlete not exported to the tracker) — skip

  const data: { range: string; values: string[][] }[] = [];
  for (const r of results) {
    const col = VIDEO_COLUMNS[r.spec];
    if (!col || !r.webViewLink) continue;
    data.push({ range: `'${tab}'!${col}${rowNumber}`, values: [[hyperlink(r.webViewLink, SPEC_LABEL[r.spec] || r.spec)]] });
  }
  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: TRACKER_SHEET_ID, requestBody: { valueInputOption: "USER_ENTERED", data } });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("x-ffmpeg-secret") !== process.env.FFMPEG_WORKER_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, ok, results, error } = body;
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

    const supabase = createServiceSupabase();

    if (!ok) {
      await supabase.from("video_render_jobs")
        .update({ status: "failed", error: String(error || "unknown"), updated_at: new Date().toISOString() })
        .eq("id", jobId);
      return NextResponse.json({ ok: true });
    }

    const { data: job } = await supabase
      .from("video_render_jobs").select("athlete_name").eq("id", jobId).single();

    const links: Record<string, any> = {};
    for (const r of (results || [])) links[r.spec] = { fileId: r.fileId, webViewLink: r.webViewLink, name: r.name };

    await supabase.from("video_render_jobs")
      .update({ status: "done", links, updated_at: new Date().toISOString() })
      .eq("id", jobId);

    if (job?.athlete_name) {
      try { await writeVideoLinks(job.athlete_name, results || []); }
      catch (e: any) { console.error("[render-callback] sheet write failed:", e?.message); }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[render-callback] Error:", error);
    return NextResponse.json({ error: error?.message || "callback failed" }, { status: 500 });
  }
}
