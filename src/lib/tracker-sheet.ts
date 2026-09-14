// src/lib/tracker-sheet.ts
// ─────────────────────────────────────────────────────────────
// Writes one athlete row into a campaign's Performance Tracker sheet, on
// their first finished submission. Find-or-append by IG handle — an
// athlete who already has a row (whether from a prior submission or a human
// filling in the tracker by hand) is never overwritten; only a brand-new
// handle gets a new row.
//
// Column layout matches the Sep 2026 tracker rebuild (see the xlsx work
// earlier this project — "All Metrics + Platforms" tab, Content Folder
// inserted right after Last Name):
//   A First Name · B Last Name · C Content Folder · D Content Rating ·
//   E IG Handle · F IG Followers · G Reach Level · H Colleges · I Sport
// Rows 1–3 are headers/calibration (see the tracker's own row-3 comment,
// "CALCULATIONS: DO NOT ERASE THIS LINE") — real athlete data starts row 4.
//
// This is best-effort by design: the athlete's file is already safely saved
// (Drive + tier3_submissions) by the time this runs, so a tracker-sheet
// hiccup must never surface as a failure to the athlete. Callers should
// wrap this in try/catch and log, not throw onward — see handleFinalize in
// /api/submit/[token]/route.ts.
// ─────────────────────────────────────────────────────────────

import { google } from "googleapis";
import { getGoogleAuth } from "./google-auth";

const TAB_NAME = "All Metrics + Platforms";
const DATA_START_ROW = 4;
const IG_HANDLE_COLUMN = "E";

const COLUMNS = {
  firstName: "A",
  lastName: "B",
  contentFolder: "C",
  igHandle: "E",
  colleges: "H",
} as const;

// ── Brand Master Tracker sync ───────────────────────────────────
//
// One tab per campaign inside "{Brand} Master Tracker", each holding that
// campaign's RECAP SUMMARY dashboard — the headline numbers (Total Athletes,
// Impressions, Engagements, etc.) plus the per-platform breakdown — as
// static values, not formulas. A formula referencing 'All Metrics +
// Platforms' would break the moment it's copied into a file that doesn't
// have that sheet, so this reads RECAP SUMMARY's already-computed results
// and writes those numbers, not the formulas that produced them.

const RECAP_SUMMARY_RANGE = "'RECAP SUMMARY'!B2:I16";

/**
 * Read a campaign tracker's RECAP SUMMARY dashboard as plain values. Returns
 * the raw 2D grid exactly as the Sheets API renders it — headline row,
 * blank spacer rows, and the per-platform table all included, since that's
 * the whole point: a faithful copy of what a human sees on that tab.
 */
export async function readRecapSummaryValues(trackerSheetId: string): Promise<string[][]> {
  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: trackerSheetId,
    range: RECAP_SUMMARY_RANGE,
  });
  return (res.data.values ?? []) as string[][];
}

/**
 * Write a campaign's RECAP SUMMARY values into a same-named tab inside the
 * Brand Master Tracker, creating the tab if it doesn't exist yet and fully
 * clearing it first if it does — "overwrite nightly," not "append."
 */
export async function writeCampaignTab(
  masterTrackerId: string,
  tabName: string,
  values: string[][]
): Promise<void> {
  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: masterTrackerId,
    fields: "sheets.properties(title)",
  });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === tabName);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: masterTrackerId,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    });
  } else {
    // Fully overwrite, not append — clear whatever shape the tab had before
    // writing today's values, so a shrunk table doesn't leave stale rows
    // behind from a wider run.
    await sheets.spreadsheets.values.clear({
      spreadsheetId: masterTrackerId,
      range: `'${tabName}'!A1:Z1000`,
    });
  }

  if (values.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: masterTrackerId,
      range: `'${tabName}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }
}

export interface TrackerAthleteInput {
  trackerSheetId: string;
  firstName: string;
  lastName: string;
  igHandle: string;
  /** Null when not asked for (e.g. a videographer submission) — left blank
   *  in the sheet rather than writing an empty string over a cell a human
   *  might fill in later. */
  school: string | null;
  /** The athlete's Content subfolder in Drive — written as a clickable
   *  =HYPERLINK, matching the Content Folder column's intended use. */
  contentFolderId: string;
}

export interface TrackerAthleteResult {
  created: boolean;
  rowNumber: number;
}

/** Strip a leading "@" and normalize case/whitespace so "@Jane_Doe" and
 *  "jane_doe " match the same tracker row. */
function cleanHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@/, "");
}

/** =HYPERLINK("url","label") — escape embedded quotes for the formula. */
function hyperlink(url: string, label: string): string {
  const safeUrl = url.replace(/"/g, '""');
  const safeLabel = label.replace(/"/g, '""');
  return `=HYPERLINK("${safeUrl}","${safeLabel}")`;
}

/**
 * Ensure an athlete has a row in their campaign's tracker. Looks up the IG
 * handle in column E first; if found, does nothing and returns that row
 * (created: false). If not found, appends a new row with just First Name,
 * Last Name, IG Handle, Colleges and the Content Folder link — every other
 * column is left blank for a human (or a later automation) to fill in.
 */
export async function upsertTrackerAthlete(
  input: TrackerAthleteInput
): Promise<TrackerAthleteResult> {
  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });

  const handleCol = await sheets.spreadsheets.values.get({
    spreadsheetId: input.trackerSheetId,
    range: `'${TAB_NAME}'!${IG_HANDLE_COLUMN}${DATA_START_ROW}:${IG_HANDLE_COLUMN}`,
  });
  const existingHandles = handleCol.data.values ?? [];

  const wantHandle = cleanHandle(input.igHandle);
  for (let i = 0; i < existingHandles.length; i++) {
    const cell = (existingHandles[i]?.[0] ?? "").toString();
    if (cleanHandle(cell) === wantHandle) {
      return { created: false, rowNumber: DATA_START_ROW + i };
    }
  }

  // No existing row — append below the last one seen (or the first data row
  // if the tab is otherwise empty).
  const rowNumber = DATA_START_ROW + existingHandles.length;
  const contentFolderUrl = `https://drive.google.com/drive/folders/${input.contentFolderId}`;

  const data: { range: string; values: string[][] }[] = [
    { range: `'${TAB_NAME}'!${COLUMNS.firstName}${rowNumber}`, values: [[input.firstName]] },
    { range: `'${TAB_NAME}'!${COLUMNS.lastName}${rowNumber}`, values: [[input.lastName]] },
    { range: `'${TAB_NAME}'!${COLUMNS.igHandle}${rowNumber}`, values: [[input.igHandle]] },
    {
      range: `'${TAB_NAME}'!${COLUMNS.contentFolder}${rowNumber}`,
      values: [[hyperlink(contentFolderUrl, "Open")]],
    },
  ];
  if (input.school) {
    data.push({ range: `'${TAB_NAME}'!${COLUMNS.colleges}${rowNumber}`, values: [[input.school]] });
  }

  // USER_ENTERED so the Content Folder cell's =HYPERLINK is parsed as a real
  // formula, not stored as literal text (RAW would do the latter).
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: input.trackerSheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });

  return { created: true, rowNumber };
}
