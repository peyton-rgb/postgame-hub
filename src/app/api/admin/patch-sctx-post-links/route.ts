// POST /api/admin/patch-sctx-post-links
// Reads IG Feed and IG Reel post URLs from Dom's old EXTERNAL tracker,
// matches athletes by IG handle to the new tracker,
// and writes those URLs into the correct IG FEED Post 1 and IG REEL Post 1 columns.

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getStaffUser } from "@/lib/staff-auth";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const OLD_SHEET_ID = "1sojVVOpjEkxqKLiWru2zZYPoqmARwaKSh2PmeAt2znE";
const NEW_SHEET_ID = "1UmIljCUyoCw2o0BkytpY-FbaI7QBQGYdqtS2zxmUWDk";
const TAB = "All Metrics + Platforms";
const DATA_START_ROW = 4;

// Column letter → 0-based index
function colToIndex(col: string): number {
  let n = 0;
  for (const c of col.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}
// 0-based index → column letter
function indexToCol(n: number): string {
  let s = "";
  n++;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

export async function POST(_req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // ── 1. Read new tracker header rows 1+2 to find IG Feed Post and IG Reel Post columns ──
  const headersResp = await sheets.spreadsheets.get({
    spreadsheetId: NEW_SHEET_ID,
    includeGridData: true,
    ranges: [`'${TAB}'!A1:BZ2`],
  });
  const headerRows = headersResp.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const row1 = (headerRows[0]?.values ?? []).map(c => c.formattedValue?.trim() ?? "");
  const row2 = (headerRows[1]?.values ?? []).map(c => c.formattedValue?.trim() ?? "");

  // Find "IG FEED Post" in row 2 (first occurrence = post 1 URL column)
  // Find "IG REEL" section start in row 1, then "IG REEL Post" in row 2
  let igFeedPostCol = -1;
  let igReelPostCol = -1;

  for (let i = 0; i < row2.length; i++) {
    if (igFeedPostCol === -1 && row2[i].includes("IG FEED Post")) igFeedPostCol = i;
    if (igReelPostCol === -1 && (row1[i]?.includes("IG REEL") || row1[i]?.includes("IG Reel")) && row2[i].includes("Post")) igReelPostCol = i;
  }
  // Fallback: scan row1 for REEL section then find Post sub-column
  if (igReelPostCol === -1) {
    let inReel = false;
    for (let i = 0; i < row1.length; i++) {
      if (row1[i]?.toUpperCase().includes("REEL")) inReel = true;
      if (inReel && row2[i]?.includes("Post")) { igReelPostCol = i; break; }
    }
  }

  if (igFeedPostCol === -1) {
    return NextResponse.json({ error: "Could not find IG FEED Post column in new tracker", row2: row2.slice(0, 30) }, { status: 400 });
  }

  // ── 2. Read new tracker athlete data (col E = IG handle, rows 4+) ──
  const newAthleteResp = await sheets.spreadsheets.values.get({
    spreadsheetId: NEW_SHEET_ID,
    range: `'${TAB}'!A${DATA_START_ROW}:E200`,
  });
  const newRows = newAthleteResp.data.values ?? [];
  // Map IG handle → row number
  const handleToRow = new Map<string, number>();
  newRows.forEach((row, i) => {
    const handle = (row[4] ?? "").trim().toLowerCase().replace(/^@/, "");
    if (handle) handleToRow.set(handle, DATA_START_ROW + i);
  });

  // ── 3. Read old tracker with full cell data (to extract hyperlinks from F and G) ──
  const oldResp = await sheets.spreadsheets.get({
    spreadsheetId: OLD_SHEET_ID,
    includeGridData: true,
    ranges: ["'Final Athletes'!A1:N50"],
  });
  const oldRowData = oldResp.data.sheets?.[0]?.data?.[0]?.rowData ?? [];

  // ── 4. Build updates ──
  const updates: { row: number; igFeedUrl: string; igReelUrl: string }[] = [];

  for (const row of oldRowData) {
    const cells = row.values ?? [];
    const igHandle = (cells[4]?.formattedValue ?? "").trim().toLowerCase().replace(/^@/, "");
    if (!igHandle || igHandle === "ig") continue;

    // Get feed URL from col F (index 5)
    const feedCell = cells[5];
    const igFeedUrl = feedCell?.hyperlink ?? feedCell?.textFormatRuns?.[0]?.format?.link?.uri ?? feedCell?.formattedValue?.trim() ?? "";

    // Get reel URL from col G (index 6)
    const reelCell = cells[6];
    const igReelUrl = reelCell?.hyperlink ?? reelCell?.textFormatRuns?.[0]?.format?.link?.uri ?? reelCell?.formattedValue?.trim() ?? "";

    const rowNum = handleToRow.get(igHandle);
    if (rowNum && (igFeedUrl || igReelUrl)) {
      updates.push({ row: rowNum, igFeedUrl, igReelUrl });
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No post URLs found in old tracker to migrate", handleToRow: Object.fromEntries(handleToRow) }, { status: 400 });
  }

  // ── 5. Write post URLs into new tracker ──
  const feedColLetter = indexToCol(igFeedPostCol);
  const reelColLetter = igReelPostCol !== -1 ? indexToCol(igReelPostCol) : null;

  const data: { range: string; values: string[][] }[] = [];
  for (const u of updates) {
    if (u.igFeedUrl) {
      data.push({ range: `'${TAB}'!${feedColLetter}${u.row}`, values: [[u.igFeedUrl]] });
    }
    if (u.igReelUrl && reelColLetter) {
      data.push({ range: `'${TAB}'!${reelColLetter}${u.row}`, values: [[u.igReelUrl]] });
    }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: NEW_SHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  return NextResponse.json({
    success: true,
    igFeedPostColumn: feedColLetter,
    igReelPostColumn: reelColLetter,
    athletesPatched: updates.length,
    updates: updates.map(u => ({ row: u.row, feed: u.igFeedUrl.substring(0, 60), reel: u.igReelUrl.substring(0, 60) })),
  });
}
