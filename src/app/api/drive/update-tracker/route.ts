// src/app/api/drive/update-tracker/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/update-tracker
// Body: { athleteName, links }  where links = { "Reels": url, "Story": url, ... }
//
// Writes one row in the asset-tracker sheet for an athlete: each platform
// cell becomes =HYPERLINK(fileUrl, "platform") pointing at the uploaded file,
// in the "Thumbnail w/ graphic" group (C–H). Find-or-append by athlete name
// (trimmed, case-insensitive). Same refresh-token auth, via a Sheets client.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createServerSupabase } from "@/lib/supabase-server";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TRACKER_SHEET_ID = "1Av15uc0dqbCWljdhUO2CBerrDXIrzf2GswpcZtTcqMA";

// Platform label → column letter, "Thumbnail w/ graphic" group (C–H).
// Column A is Athlete; B ("Original photo") and I–O (video columns) are
// reserved/empty for now. Matches scripts/rebuild-tracker-sheet.js.
const COLUMNS: Record<string, string> = {
  "Athlete": "A",
  "Reels": "C",
  "Story": "D",
  "TikTok": "E",
  "Shorts": "F",
  "IG feed": "G",
  "LinkedIn": "H",
};

// Column-A black/white styling (matches the rebuild script) — stamped on new rows.
const COL_A_FORMAT = {
  backgroundColor: { red: 7 / 255, green: 7 / 255, blue: 10 / 255 },   // #07070a
  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
  verticalAlignment: "MIDDLE",
};

const DATA_START_ROW = 3;   // rows 1–2 are the two-row header

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

    // 1. Resolve the first tab's title + numeric id dynamically (survives a rename).
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: TRACKER_SHEET_ID,
      fields: "sheets.properties(title,sheetId)",
    });
    const tab = meta.data.sheets?.[0]?.properties?.title;
    const numericSheetId = meta.data.sheets?.[0]?.properties?.sheetId;
    if (!tab || numericSheetId == null) {
      return NextResponse.json({ error: "Tracker sheet has no tabs" }, { status: 500 });
    }

    // 2. Find the athlete's row in column A — trimmed, case-insensitive
    //    (so "Name" and "Name " don't create two rows). Rows 1–2 are the header.
    const colA = await sheets.spreadsheets.values.get({
      spreadsheetId: TRACKER_SHEET_ID,
      range: `'${tab}'!A:A`,
    });
    const rowsA = colA.data.values || [];
    const want = String(athleteName).trim().toLowerCase();
    let rowNumber = -1;
    for (let i = DATA_START_ROW - 1; i < rowsA.length; i++) {   // skip the two header rows
      const cell = (rowsA[i]?.[0] ?? "").toString().trim().toLowerCase();
      if (cell === want) { rowNumber = i + 1; break; }          // 1-based row number
    }
    const created = rowNumber === -1;
    // Append below the last row, but never into the two-row header.
    if (created) rowNumber = Math.max(DATA_START_ROW, rowsA.length + 1);

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

    // 5. On a brand-new row, stamp column A with the black/white style so rows
    //    appended beyond the pre-formatted grid still match (existing rows are
    //    already styled by scripts/rebuild-tracker-sheet.js).
    if (created) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: TRACKER_SHEET_ID,
        requestBody: {
          requests: [{
            repeatCell: {
              range: { sheetId: numericSheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 0, endColumnIndex: 1 },
              cell: { userEnteredFormat: COL_A_FORMAT },
              fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
            },
          }],
        },
      });
    }

    return NextResponse.json({ ok: true, rowNumber, created, tab });
  } catch (error: any) {
    console.error("[drive/update-tracker] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Tracker update failed" },
      { status: 500 }
    );
  }
}
