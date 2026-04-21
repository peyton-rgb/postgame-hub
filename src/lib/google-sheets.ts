// src/lib/google-sheets.ts
// ─────────────────────────────────────────────────────────────
// Google Sheets helper — appends rows to the BTS Submissions sheet.
//
// Uses the shared getGoogleAuth() helper (src/lib/google-auth.ts) so
// we authenticate the same way Drive does. The Google account behind
// GOOGLE_REFRESH_TOKEN must have editor access to the BTS Submissions
// sheet and its OAuth consent must include the Sheets scope.
//
// Env vars required:
//   GOOGLE_BTS_SHEET_ID — the spreadsheet ID of the BTS Submissions sheet
//   (plus the three GOOGLE_* vars consumed by getGoogleAuth).
// ─────────────────────────────────────────────────────────────

import { google } from "googleapis";
import { getGoogleAuth } from "./google-auth";

// ── Types ─────────────────────────────────────────────────────

export type BtsSheetRowInput = {
  /** When the submission was received. Rendered to "YYYY-MM-DD HH:MM" in
   *  America/New_York (Postgame is based in Florida). */
  submittedAt: Date;
  athleteName: string;
  /** Null when the brand has been deleted or was never linked. */
  brandName: string | null;
  /** Null when the campaign has been deleted or was never linked. */
  campaignName: string | null;
  /** true → "YES" in the sheet, false → "NO". */
  holdPosting: boolean;
  submitterName: string | null;
  /** Public URL to the uploaded file in Supabase storage. */
  videoUrl: string;
  /** UUID of the bts_submissions row that triggered this append. */
  supabaseId: string;
};

// ── Error class ───────────────────────────────────────────────

/**
 * Wraps any Google Sheets API error with a clean message so the API
 * route can catch it specifically (e.g. to log a sheet_sync_error on
 * the bts_submissions row without failing the user's upload).
 *
 * `cause` holds the original error for debugging; `.message` is a
 * short string suitable for persisting to the database or surfacing
 * in a server log. The API route is expected to wrap errors thrown
 * by appendBtsRow() in this class — appendBtsRow itself does not
 * try/catch, to keep this module pure and the wrapping explicit.
 *
 * Example:
 * ```ts
 * try {
 *   await appendBtsRow(row);
 * } catch (err) {
 *   throw new SheetSyncError("Failed to append BTS row to sheet", err);
 * }
 * ```
 */
export class SheetSyncError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(SheetSyncError.buildMessage(message, cause));
    this.name = "SheetSyncError";
    this.cause = cause;
  }

  private static buildMessage(message: string, cause: unknown): string {
    if (!cause) return message;
    // googleapis errors expose error.response.data.error.message; fall
    // back to .message on plain Errors; last resort: stringify.
    const maybe = cause as {
      response?: { data?: { error?: { message?: string } } };
      message?: string;
    };
    const detail =
      maybe?.response?.data?.error?.message ??
      maybe?.message ??
      String(cause);
    return `${message}: ${detail}`;
  }
}

// ── Helpers ───────────────────────────────────────────────────

/** Format a Date as "YYYY-MM-DD HH:MM" in America/New_York (24-hour). */
function formatEastern(date: Date): string {
  // Intl.DateTimeFormat with en-CA yields ISO-like "YYYY-MM-DD" parts;
  // combined with separate hour/minute fields so we can assemble the
  // exact shape we want ("2026-04-21 14:30") without parsing a locale
  // string. en-CA is stable across Node versions; avoid en-US (M/D/Y).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";

  // `hour` may be "24" at midnight in some ICU builds — normalize.
  const hh = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")} ${hh}:${get("minute")}`;
}

// ── Public API ────────────────────────────────────────────────

/**
 * Appends a single row to the BTS Submissions Google Sheet.
 *
 * Use this after a BTS submission is successfully stored in Supabase
 * (bts_submissions row + file uploaded to storage). The sheet append
 * is a mirror/notification — if this call fails, the caller should
 * log the error to the row's sheet_sync_error column but still return
 * success to the user. Their submission is safe in Supabase either way.
 *
 * Does NOT try/catch internally — errors bubble to the caller, which
 * should wrap them in SheetSyncError before logging/persisting.
 *
 * @param input All fields needed to compose the row. Null brand/campaign
 *   names are rendered as "(unlinked)" in the sheet so the human eye
 *   can spot orphaned submissions.
 * @returns The updatedRange and updatedCells count from the Sheets API.
 */
export async function appendBtsRow(
  input: BtsSheetRowInput
): Promise<{ updatedRange: string; updatedCells: number }> {
  const spreadsheetId = process.env.GOOGLE_BTS_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error(
      "appendBtsRow: missing required env var: GOOGLE_BTS_SHEET_ID"
    );
  }

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });

  // Column order — must match the BTS Submissions sheet layout:
  //   A: Timestamp
  //   B: Athlete
  //   C: Brand
  //   D: Campaign
  //   E: Hold Posting (YES/NO)
  //   F: Submitter
  //   G: Video URL
  //   H: Supabase ID
  //   I: Status              (left blank — human fills in)
  //   J: Scheduled Post Date (left blank — human fills in)
  //   K: Notes               (left blank — human fills in)
  const row: (string | number)[] = [
    formatEastern(input.submittedAt),         // A: Timestamp
    input.athleteName,                        // B: Athlete
    input.brandName ?? "(unlinked)",          // C: Brand
    input.campaignName ?? "(unlinked)",       // D: Campaign
    input.holdPosting ? "YES" : "NO",         // E: Hold Posting
    input.submitterName ?? "",                // F: Submitter
    input.videoUrl,                           // G: Video URL
    input.supabaseId,                         // H: Supabase ID
    "",                                       // I: Status (human fills)
    "",                                       // J: Scheduled Post Date (human fills)
    "",                                       // K: Notes (human fills)
  ];

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return {
    updatedRange: res.data.updates?.updatedRange ?? "",
    updatedCells: res.data.updates?.updatedCells ?? 0,
  };
}
