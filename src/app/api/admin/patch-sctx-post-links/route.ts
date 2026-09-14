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

function indexToCol(n: number): string {
  let s = "";
  n++;
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

// Normalize whitespace and newlines for header matching
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();

export async function POST(_req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // 1. Read new tracker header rows to find IG Feed Post and IG Reel Post columns
  const headersResp = await sheets.spreadsheets.get({
    spreadsheetId: NEW_SHEET_ID,
    includeGridData: true,
    ranges: [`'${TAB}'!A1:BZ2`],
  });
  const headerRows = headersResp.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const row1 = (headerRows[0]?.values ?? []).map(c => norm(c.formattedValue ?? ""));
  const row2 = (headerRows[1]?.values ?? []).map(c => norm(c.formattedValue ?? ""));

  let igFeedPostCol = -1;
  let igReelPostCol = -1;

  for (let i = 0; i < row2.length; i++) {
    // IG Feed Post: row2 contains "IG FEED POST" or similar, first occurrence
    if (igFeedPostCol === -1 && row2[i].includes("FEED") && row2[i].includes("POST")) {
      igFeedPostCol = i;
    }
    // IG Reel Post: row1 has REEL section header, row2 has POST sub-column
    if (igReelPostCol === -1 && row1[i].includes("REEL") && row2[i].includes("POST")) {
      igReelPostCol = i;
    }
  }

  // Fallback for Reel: find first REEL in row1 then next POST in row2
  if (igReelPostCol === -1) {
    let inReel = false;
    for (let i = 0; i < row1.length; i++) {
      if (row1[i].includes("REEL")) inReel = true;
      if (inReel && row2[i].includes("POST")) { igReelPostCol = i; break; }
    }
  }

  if (igFeedPostCol === -1) {
    return NextResponse.json({
      error: "Could not find IG FEED Post column",
      row1sample: row1.slice(0, 20),
      row2sample: row2.slice(0, 20),
    }, { status: 400 });
  }

  // 2. Read new tracker athlete IG handles (col E, rows 4+)
  const newAthleteResp = await sheets.spreadsheets.values.get({
    spreadsheetId: NEW_SHEET_ID,
    range: `'${TAB}'!E${DATA_START_ROW}:E200`,
  });
  const newHandles = newAthleteResp.data.values ?? [];
  const handleToRow = new Map<string, number>();
  newHandles.forEach((row, i) => {
    const h = (row[0] ?? "").trim().toLowerCase().replace(/^@/, "");
    if (h) handleToRow.set(h, DATA_START_ROW + i);
  });

  // 3. Read old tracker with full cell data (for hyperlinks in cols F and G)
  const oldResp = await sheets.spreadsheets.get({
    spreadsheetId: OLD_SHEET_ID,
    includeGridData: true,
    ranges: ["'Final Athletes'!A1:N50"],
  });
  const oldRowData = oldResp.data.sheets?.[0]?.data?.[0]?.rowData ?? [];

  // 4. Build write updates
  const feedColLetter  = indexToCol(igFeedPostCol);
  const reelColLetter  = igReelPostCol !== -1 ? indexToCol(igReelPostCol) : null;
  const updates: { handle: string; row: number; feed: string; reel: string }[] = [];
  const data: { range: string; values: string[][] }[] = [];

  for (const row of oldRowData) {
    const cells = row.values ?? [];
    const igHandle = (cells[4]?.formattedValue ?? "").trim().toLowerCase().replace(/^@/, "");
    if (!igHandle || igHandle === "ig") continue;

    const feedCell = cells[5];
    const reelCell = cells[6];
    const feedUrl = feedCell?.hyperlink ?? feedCell?.textFormatRuns?.[0]?.format?.link?.uri ?? feedCell?.formattedValue?.trim() ?? "";
    const reelUrl = reelCell?.hyperlink ?? reelCell?.textFormatRuns?.[0]?.format?.link?.uri ?? reelCell?.formattedValue?.trim() ?? "";

    const rowNum = handleToRow.get(igHandle);
    if (!rowNum || (!feedUrl && !reelUrl)) continue;

    updates.push({ handle: igHandle, row: rowNum, feed: feedUrl, reel: reelUrl });

    if (feedUrl) data.push({ range: `'${TAB}'!${feedColLetter}${rowNum}`, values: [[feedUrl]] });
    if (reelUrl && reelColLetter) data.push({ range: `'${TAB}'!${reelColLetter}${rowNum}`, values: [[reelUrl]] });
  }

  if (data.length === 0) {
    return NextResponse.json({ error: "No post URLs found to write", handleToRow: Object.fromEntries(handleToRow) }, { status: 400 });
  }

  // 5. Write all at once
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: NEW_SHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  return NextResponse.json({
    success: true,
    igFeedPostColumn: feedColLetter + " (index " + igFeedPostCol + ")",
    igReelPostColumn: reelColLetter ? reelColLetter + " (index " + igReelPostCol + ")" : "not found",
    athletesPatched: updates.length,
    updates: updates.map(u => ({ handle: u.handle, row: u.row, feed: u.feed.substring(0, 60), reel: u.reel.substring(0, 60) })),
  });
}
