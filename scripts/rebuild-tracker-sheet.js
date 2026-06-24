#!/usr/bin/env node
// scripts/rebuild-tracker-sheet.js
// ─────────────────────────────────────────────────────────────
// One-time (re)builder for the NBA Draft asset-tracker sheet structure + styling.
// Keeps the look in code so a rebuild always comes back styled correctly.
//
// ⚠️  DESTRUCTIVE: clears ALL content + formatting, then rebuilds the header.
//     Only run when intentionally resetting the tracker (data rows are wiped;
//     Drive files are untouched and rows get re-written by the export flow).
//
// Layout (15 cols, two-row header; data starts row 3):
//   A  Athlete            (vertical-merged A1:A2)
//   B  Original photo     (vertical-merged B1:B2, reserved)
//   C–H Thumbnail w/ graphic → Reels, Story, TikTok, Shorts, IG feed, LinkedIn
//   I  Original video     (vertical-merged I1:I2, reserved)
//   J–O Video w/ graphic  → Reels, Story, TikTok, Shorts, IG feed, LinkedIn (reserved)
//
// Styling: header rows 1–2 and column A (all data rows) → black #07070a bg, bold white text.
//
// Run:  node --env-file=.env.local scripts/rebuild-tracker-sheet.js
// ─────────────────────────────────────────────────────────────

const { google } = require('googleapis');

const SHEET_ID = '1Av15uc0dqbCWljdhUO2CBerrDXIrzf2GswpcZtTcqMA';
const BG = { red: 7 / 255, green: 7 / 255, blue: 10 / 255 };   // #07070a
const WHITE = { red: 1, green: 1, blue: 1 };
const PLATFORMS = ['Reels', 'Story', 'TikTok', 'Shorts', 'IG feed', 'LinkedIn'];

(async () => {
  try {
    const o = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    o.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const sheets = google.sheets({ version: 'v4', auth: o });

    // 1. Metadata — sheetId (numeric), tab title, grid size.
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
      fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',
    });
    const props = meta.data.sheets[0].properties;
    const sheetId = props.sheetId;
    const tab = props.title;
    const rowCount = props.gridProperties.rowCount;
    let colCount = props.gridProperties.columnCount;
    console.log(`Tab "${tab}" | sheetId ${sheetId} | grid ${rowCount}x${colCount}`);

    // 2. Ensure ≥15 columns, unmerge everything, clear all values + formatting.
    const req1 = [];
    if (colCount < 15) { req1.push({ appendDimension: { sheetId, dimension: 'COLUMNS', length: 15 - colCount } }); colCount = 15; }
    req1.push({ unmergeCells: { range: { sheetId } } });
    req1.push({ repeatCell: { range: { sheetId }, cell: {}, fields: 'userEnteredValue,userEnteredFormat' } });
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: req1 } });

    // 3. Write header text to the (now unmerged) grid — merge afterward keeps top-left.
    const row1 = ['Athlete', 'Original photo', 'Thumbnail w/ graphic', '', '', '', '', '', 'Original video', 'Video w/ graphic', '', '', '', '', ''];
    const row2 = ['', '', ...PLATFORMS, '', ...PLATFORMS];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID, range: `'${tab}'!A1:O2`, valueInputOption: 'RAW',
      requestBody: { values: [row1, row2] },
    });

    // 4. Merges + formatting + freeze.
    const mergeV = (c) => ({ mergeCells: { mergeType: 'MERGE_ALL', range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: c, endColumnIndex: c + 1 } } });
    const mergeH = (c1, c2) => ({ mergeCells: { mergeType: 'MERGE_ALL', range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: c1, endColumnIndex: c2 } } });
    const headerFmt = { backgroundColor: BG, textFormat: { bold: true, foregroundColor: WHITE }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE' };
    const colAFmt = { backgroundColor: BG, textFormat: { bold: true, foregroundColor: WHITE }, verticalAlignment: 'MIDDLE' };
    const req2 = [
      mergeV(0),        // A1:A2  Athlete
      mergeV(1),        // B1:B2  Original photo
      mergeH(2, 8),     // C1:H1  Thumbnail w/ graphic
      mergeV(8),        // I1:I2  Original video
      mergeH(9, 15),    // J1:O1  Video w/ graphic
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 15 }, cell: { userEnteredFormat: headerFmt }, fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)' } },
      { repeatCell: { range: { sheetId, startRowIndex: 2, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: colAFmt }, fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)' } },
      { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 2, frozenColumnCount: 1 } }, fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount' } },
    ];
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests: req2 } });
    console.log('Applied: structure + merges + black/white formatting + frozen header.');

    // 5. Readback to confirm.
    const back = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets(merges,properties(gridProperties(frozenRowCount,frozenColumnCount,columnCount)))' });
    const merges = back.data.sheets[0].merges || [];
    console.log('MERGES:', merges.length, '(expect 5)');
    console.log('FROZEN:', JSON.stringify(back.data.sheets[0].properties.gridProperties));
    const hv = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `'${tab}'!A1:O2` });
    console.log('ROW1:', JSON.stringify((hv.data.values || [])[0]));
    console.log('ROW2:', JSON.stringify((hv.data.values || [])[1]));
    console.log('RESULT: TRACKER REBUILT');
  } catch (e) {
    console.log('REBUILD ERROR:', e.code || '', e.message, e.errors ? JSON.stringify(e.errors) : '');
  }
})();
