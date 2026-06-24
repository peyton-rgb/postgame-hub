#!/usr/bin/env node
// scripts/style-tracker-sheet.js
// ─────────────────────────────────────────────────────────────
// Non-destructive styling for the NBA Draft asset tracker:
//   • centers ALL text (whole grid)
//   • draws a full thin grid (gray, visible on black + white)
//   • heavier WHITE borders around column A and the two header rows
//     (so the Athlete column + header stand out from the data grid)
//
// Safe to run anytime — only changes formatting, never clears data.
// Run after scripts/rebuild-tracker-sheet.js, or on its own to re-apply.
//
// Run:  node --env-file=.env.local scripts/style-tracker-sheet.js
// ─────────────────────────────────────────────────────────────

const { google } = require('googleapis');

const SHEET_ID = '1Av15uc0dqbCWljdhUO2CBerrDXIrzf2GswpcZtTcqMA';
const THIN = { red: 0.6, green: 0.6, blue: 0.6 };   // #999 — reads on both black + white
const HEAVY = { red: 1, green: 1, blue: 1 };          // white — pops on the black A / header
const COLS = 15;          // A–O
const GRID_ROWS = 80;     // grid through row 80 (covers the full 60-pick draft + buffer)

(async () => {
  try {
    const o = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    o.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const sheets = google.sheets({ version: 'v4', auth: o });

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets.properties(sheetId,title,gridProperties(rowCount))',
    });
    const props = meta.data.sheets[0].properties;
    const sheetId = props.sheetId;
    const gridRows = Math.min(GRID_ROWS, props.gridProperties.rowCount);

    const thin = { style: 'SOLID', color: THIN };
    const heavy = { style: 'SOLID_MEDIUM', color: HEAVY };

    const requests = [
      // 1. Center ALL text (whole grid) — only touches horizontalAlignment, keeps bg/bold/etc.
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: props.gridProperties.rowCount, startColumnIndex: 0, endColumnIndex: COLS }, cell: { userEnteredFormat: { horizontalAlignment: 'CENTER' } }, fields: 'userEnteredFormat.horizontalAlignment' } },
      // 2. Full thin grid over the table (outer + inner gridlines).
      { updateBorders: { range: { sheetId, startRowIndex: 0, endRowIndex: gridRows, startColumnIndex: 0, endColumnIndex: COLS }, top: thin, bottom: thin, left: thin, right: thin, innerHorizontal: thin, innerVertical: thin } },
      // 3. Heavier white frame around the two header rows (incl. the header↔data divider).
      { updateBorders: { range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: COLS }, top: heavy, bottom: heavy, left: heavy, right: heavy } },
      // 4. Heavier white edges down column A (divides the Athlete column from the data).
      { updateBorders: { range: { sheetId, startRowIndex: 0, endRowIndex: gridRows, startColumnIndex: 0, endColumnIndex: 1 }, left: heavy, right: heavy } },
    ];
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
    console.log(`Styled "${props.title}": centered all text, full grid to row ${gridRows}, heavy white borders on column A + header.`);
  } catch (e) {
    console.log('STYLE ERROR:', e.code || '', e.message, e.errors ? JSON.stringify(e.errors) : '');
  }
})();
