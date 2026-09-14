// POST /api/admin/migrate-sctx-perf-data
// Copies all metric columns (reach, impressions, likes, comments, shares,
// reposts, reel/story/tiktok metrics, etc.) from the old SCTX performance
// tracker into the new one, by matching athletes on IG handle.
// Header names are matched between sheets so column position differences
// don't matter — only the values travel, not the positions.

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getStaffUser } from "@/lib/staff-auth";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Old perf tracker sitting in the Trackers subfolder of the SCTX campaign
const SOURCE_ID = "1ct4J8bMMWkAM1yZkdYohxpGu3Ewa8fNNxQeoMEO3CWg";
// New template tracker we created for this campaign
const DEST_ID   = "1UmIljCUyoCw2o0BkytpY-FbaI7QBQGYdqtS2zxmUWDk";
const TAB       = "All Metrics + Platforms";
const DATA_START = 4; // row 4 is first athlete row in both trackers

// Identity columns we already migrated — skip these, only copy metrics
const IDENTITY_HEADERS = new Set([
  "first name","last name","content folder","content rating",
  "ig handle","ig followers","reach level","colleges","sport","gender",
  // old tracker identity names
  "fname","lname","content","approved?","ig","store address",
  "owner/operator","date(s) available","tiktokusername","tiktokfollowers",
]);

function norm(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function indexToCol(n: number): string {
  let s = "";
  n++;
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

export async function POST(_req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // ── 1. Read source tracker headers (rows 1 + 2) and all data ──────────
  const srcFull = await sheets.spreadsheets.get({
    spreadsheetId: SOURCE_ID,
    includeGridData: true,
    ranges: [`'${TAB}'!A1:BZ50`],
  });
  const srcRows = srcFull.data.sheets?.[0]?.data?.[0]?.rowData ?? [];

  // Row 2 (index 1) has the sub-column labels in both trackers
  const srcRow2 = (srcRows[1]?.values ?? []).map(c => norm(c.formattedValue ?? ""));
  // IG handle column in source (find it)
  const srcIgCol = srcRow2.findIndex(h => h.includes("ig handle") || h === "ig");

  // Build map: igHandle → { colIndex → value } for all data rows
  // We only want columns that are NOT identity columns
  const srcAthletes = new Map<string, Map<number, string>>();
  for (let ri = DATA_START - 1; ri < srcRows.length; ri++) {
    const cells = srcRows[ri]?.values ?? [];
    const igRaw = srcIgCol >= 0
      ? (cells[srcIgCol]?.formattedValue ?? "").trim()
      : "";
    const ig = igRaw.toLowerCase().replace(/^@/, "");
    if (!ig) continue;

    const colValues = new Map<number, string>();
    cells.forEach((cell, ci) => {
      const headerLabel = srcRow2[ci] ?? "";
      if (headerLabel && !IDENTITY_HEADERS.has(headerLabel)) {
        const val = cell.formattedValue?.trim() ?? "";
        if (val) colValues.set(ci, val);
      }
    });
    if (colValues.size > 0) srcAthletes.set(ig, colValues);
  }

  // ── 2. Read dest tracker headers and IG handles ───────────────────────
  const dstFull = await sheets.spreadsheets.get({
    spreadsheetId: DEST_ID,
    includeGridData: true,
    ranges: [`'${TAB}'!A1:BZ3`],
  });
  const dstHeaderRows = dstFull.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
  const dstRow2 = (dstHeaderRows[1]?.values ?? []).map(c => norm(c.formattedValue ?? ""));

  // Build map: normalised header → column index in dest
  const dstHeaderToCol = new Map<string, number>();
  dstRow2.forEach((h, i) => { if (h) dstHeaderToCol.set(h, i); });

  // Read dest athlete IG handles to get row numbers
  const dstHandles = await sheets.spreadsheets.values.get({
    spreadsheetId: DEST_ID,
    range: `'${TAB}'!E${DATA_START}:E200`,
  });
  const handleToRow = new Map<string, number>();
  (dstHandles.data.values ?? []).forEach((row, i) => {
    const h = (row[0] ?? "").trim().toLowerCase().replace(/^@/, "");
    if (h) handleToRow.set(h, DATA_START + i);
  });

  // ── 3. Build write operations ─────────────────────────────────────────
  const writes: { range: string; values: string[][] }[] = [];
  const report: { handle: string; dstRow: number; colsWritten: number }[] = [];
  let unmatched: string[] = [];

  for (const [ig, srcColMap] of srcAthletes.entries()) {
    const dstRow = handleToRow.get(ig);
    if (!dstRow) { unmatched.push(ig); continue; }

    let colsWritten = 0;
    for (const [srcColIdx, val] of srcColMap.entries()) {
      const srcHeader = srcRow2[srcColIdx];
      const dstColIdx = dstHeaderToCol.get(srcHeader);
      if (dstColIdx === undefined) continue; // column doesn't exist in dest
      const colLetter = indexToCol(dstColIdx);
      writes.push({ range: `'${TAB}'!${colLetter}${dstRow}`, values: [[val]] });
      colsWritten++;
    }
    report.push({ handle: ig, dstRow, colsWritten });
  }

  if (writes.length === 0) {
    return NextResponse.json({
      message: "No matching metric columns found between source and dest",
      srcHeaders: srcRow2.filter(Boolean),
      dstHeaders: dstRow2.filter(Boolean),
      unmatched,
    });
  }

  // Write in batches of 100 to avoid API limits
  for (let i = 0; i < writes.length; i += 100) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: DEST_ID,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: writes.slice(i, i + 100),
      },
    });
  }

  return NextResponse.json({
    success: true,
    totalCellsWritten: writes.length,
    athletesPatched: report.length,
    unmatchedHandles: unmatched,
    report,
  });
}
