// src/app/api/drive/update-tracker/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/update-tracker
// Body: { athleteName, links }  where links = { "Reels": url, "Story": url, ... }
//
// Writes one row in the asset-tracker sheet for an athlete: each platform
// cell becomes =HYPERLINK(fileUrl, "platform") pointing at the uploaded PNG.
// Find-or-append by athlete name (trimmed, case-insensitive). Uses the same
// refresh-token auth as the Drive routes, via a Sheets client.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerSupabase } from "@/lib/supabase-server";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TRACKER_SHEET_ID = "1Av15uc0dqbCWljdhUO2CBerrDXIrzf2GswpcZtTcqMA";

// Header order → column letter. A=Athlete, then the photo/platform columns.
const COLUMNS: Record<string, string> = {
  "Athlete": "A",
  "Cover photo": "B",
  "4:5": "C",
  "9:16": "D",
  "Reels": "E",
  "Story": "F",
  "TikTok": "G",
  "Shorts": "H",
  "IG feed": "I",
  "LinkedIn": "J",
};

// =HYPERLINK("url","label") — escape any embedded double-quotes for the formula.
function hyperlink(url: string, label: string): string {
  const safeUrl = String(url).replace(/"/g, '""');
  const safeLabel = String(label).replace(/"/g, '""');
  return `=HYPERLINK("${safeUrl}","${safeLabel}")`;
}

export async function POST(request: NextRequest) {
  try {
    // Auth gate — same pattern as the other /api/drive/* routes.
    const authClient = createServerSupabase();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { athleteName, links } = body;
    if (!athleteName || !links || typeof links !== "object") {
      return NextResponse.json(
        { error: "Missing required fields: athleteName, links" },
        { status: 400 }
      );
    }

    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });

    // 1. Resolve the first tab's title dynamically (don't hardcode it — survives a rename).
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: TRACKER_SHEET_ID,
      fields: "sheets.properties(title)",
    });
    const tab = meta.data.sheets?.[0]?.properties?.title;
    if (!tab) {
      return NextResponse.json({ error: "Tracker sheet has no tabs" }, { status: 500 });
    }

    // 2. Find the athlete's row in column A — trimmed, case-insensitive
    //    (so "Name" and "Name " don't create two rows).
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId: TRACKER_SHEET_ID,
      range: `'${tab}'!A:A`,
    });
    const rowsA = colA.data.values || [];
    const want = String(athleteName).trim().toLowerCase();
    let rowNumber = -1;
    for (let i = 1; i < rowsA.length; i++) {            // skip header (row 1)
      const cell = (rowsA[i]?.[0] ?? "").toString().trim().toLowerCase();
      if (cell === want) { rowNumber = i + 1; break; }  // 1-based row number
    }
    const created = rowNumber === -1;
    if (created) rowNumber = rowsA.length + 1;           // append after the last row

    // 3. Build cell updates. Always set the clean athlete name in column A,
    //    then a =HYPERLINK for each provided link mapped to its column.
    const data: { range: string; values: string[][] }[] = [
      { range: `'${tab}'!A${rowNumber}`, values: [[String(athleteName).trim()]] },
    ];
    for (const [label, url] of Object.entries(links)) {
      if (!url) continue;
      const col = COLUMNS[label];
      if (!col) continue;                                // unknown label → skip defensively
      data.push({ range: `'${tab}'!${col}${rowNumber}`, values: [[hyperlink(url as string, label)]] });
    }

    // 4. One batch write. USER_ENTERED → =HYPERLINK is parsed as a real formula
    //    (RAW would store the literal text instead of a clickable link).
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: TRACKER_SHEET_ID,
      requestBody: { valueInputOption: "USER_ENTERED", data },
    });

    return NextResponse.json({ ok: true, rowNumber, created, tab });
  } catch (error: any) {
    console.error("[drive/update-tracker] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Tracker update failed" },
      { status: 500 }
    );
  }
}
