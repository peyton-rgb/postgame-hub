// src/lib/w9-sheet.ts
// ─────────────────────────────────────────────────────────────
// Mirrors every videographer W-9 submission (POST /api/w9) into the
// "W-9 Submissions Log" Google Sheet, which sits in Drive next to the
// per-year "<year> W-9s" folders.
//
// The sheet is a convenience view, NOT the record. The PDF in Drive and the
// videographer_w9_submissions row are the record. So /api/w9 calls this LAST,
// and a failure here is logged and swallowed — a videographer must never be
// told their W-9 failed because a spreadsheet hiccuped.
//
// One tab per tax year ("2026", "2027", …) to match the yearly Drive folders.
// The first submission of a new year creates that year's tab with headers.
//
// Column layout — must match the tabs already in the sheet (2026 was
// backfilled by hand on 2026-11-02 in exactly this shape):
//   A Submitted (ET) · B Payee · C First Name · D Last Name · E Business Name
//   F Email · G Phone · H Street Address · I City · J State · K ZIP
//   L W-9 PDF (link) · M Verified · N Notes · O Record ID
// M and N are left blank for staff to fill in.
//
// Env vars required:
//   W9_LOG_SHEET_ID — spreadsheet ID of the W-9 Submissions Log
//   (plus GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN,
//   the same Google login the W-9 route already uses to write the PDF).
// ─────────────────────────────────────────────────────────────

import { google, sheets_v4 } from "googleapis";
import { getGoogleAuth } from "./google-auth";

export const W9_SHEET_HEADERS = [
  "Submitted (ET)",
  "Payee",
  "First Name",
  "Last Name",
  "Business Name",
  "Email",
  "Phone",
  "Street Address",
  "City",
  "State",
  "ZIP",
  "W-9 PDF",
  "Verified",
  "Notes",
  "Record ID",
] as const;

export interface W9SheetRowInput {
  taxYear: number;
  submittedAt: Date;
  businessName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  /** Digits only, as stored on the row. */
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  driveFileId: string;
  fileName: string;
  /** videographer_w9_submissions.id */
  recordId: string;
}

// ── Formatting ────────────────────────────────────────────────

/** "2026-11-02 03:45 PM" in Eastern — the same shape the backfill used. */
function formatEastern(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

/** "9415678565" → "(941) 567-8565"; a leading US "1" is dropped. */
function formatPhone(digits: string): string {
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits;
}

/**
 * Make text typed by a member of the public safe to drop into a sheet.
 *
 * We write with valueInputOption USER_ENTERED (so our own HYPERLINK formula
 * works), which means a cell starting with "=" is run as a formula. This is a
 * public form with no login, so anyone could type "=IMPORTXML(...)" as their
 * business name. A leading apostrophe tells Sheets "this is plain text"; the
 * apostrophe itself is not shown.
 */
function text(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

/** Sheets formula strings escape a double quote by doubling it. */
function formulaString(v: string): string {
  return v.replace(/"/g, '""');
}

export function buildW9Row(input: W9SheetRowInput): string[] {
  const payee = input.businessName || `${input.firstName} ${input.lastName}`;
  const street = input.addressLine2
    ? `${input.addressLine1}, ${input.addressLine2}`
    : input.addressLine1;
  const url = `https://drive.google.com/file/d/${input.driveFileId}/view`;
  return [
    formatEastern(input.submittedAt), // A Submitted (ET)
    text(payee), // B Payee
    text(input.firstName), // C First Name
    text(input.lastName), // D Last Name
    text(input.businessName), // E Business Name
    text(input.email), // F Email
    formatPhone(input.phone), // G Phone
    text(street), // H Street Address
    text(input.city), // I City
    text(input.state), // J State
    // Apostrophe keeps "02026" from becoming the number 2026.
    `'${input.postalCode}`, // K ZIP
    `=HYPERLINK("${formulaString(url)}","${formulaString(input.fileName)}")`, // L W-9 PDF
    "", // M Verified (staff fill in)
    "", // N Notes (staff fill in)
    input.recordId, // O Record ID
  ];
}

// ── Sheet access ──────────────────────────────────────────────

/**
 * Make sure the tab for this tax year exists. On the first W-9 of a new
 * year it adds the tab, writes the header row, bolds it and freezes it, so
 * January needs no manual setup — the same idea as the yearly Drive folder.
 */
async function ensureYearTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  title: string
): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (exists) return;

  const added = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title, index: 0, gridProperties: { frozenRowCount: 1 } },
          },
        },
      ],
    },
  });
  const sheetId = added.data.replies?.[0]?.addSheet?.properties?.sheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [[...W9_SHEET_HEADERS]] },
  });

  if (sheetId != null) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: W9_SHEET_HEADERS.length,
              },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColorStyle: { rgbColor: { red: 0.93, green: 0.93, blue: 0.93 } },
                },
              },
              fields: "userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColorStyle",
            },
          },
        ],
      },
    });
  }
}

/**
 * Add one W-9 submission to the bottom of its tax year's tab.
 * Throws on failure — the caller decides that a failure is non-fatal.
 */
export async function appendW9Row(input: W9SheetRowInput): Promise<void> {
  const spreadsheetId = process.env.W9_LOG_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error("appendW9Row: missing required env var: W9_LOG_SHEET_ID");
  }

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });
  const tab = String(input.taxYear);
  await ensureYearTab(sheets, spreadsheetId, tab);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${tab}'!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [buildW9Row(input)] },
  });
}
