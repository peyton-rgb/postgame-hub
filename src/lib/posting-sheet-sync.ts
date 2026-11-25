// ============================================================
// Mirror an athlete's posted link into a campaign's Google Sheet.
//
// When an athlete pastes a link on /deliver/[token], writeLink() saves it in
// posting_package_links. For campaigns listed in SHEET_SYNC below, this also
// writes the same link into the team's tracking sheet, so nobody has to copy
// links over by hand.
//
// How it finds the cell:
//   • Row:    the athlete's IG handle, matched against the tab's "IG Handle"
//             column (names don't line up between the Hub and the sheet —
//             e.g. "O'Neal" vs "O'Neil" — handles do).
//   • Column: by HEADER TEXT, not letter, so inserting a column in the sheet
//             doesn't send links to the wrong place.
//
// Safety:
//   • Never overwrites: a cell that already has anything in it is left alone
//     (same rule as the Hub itself — a saved link is never replaced).
//   • Best effort: any failure is logged and swallowed. The athlete's link is
//     already saved in the Hub; a sheet hiccup must never show them an error.
// ============================================================

import { google } from 'googleapis';
import { getGoogleAuth } from '@/lib/google-auth';
import { createLiveServiceSupabase } from '@/lib/supabase-server';
import type { Platform } from '@/lib/post-link';

type SheetTarget = {
  spreadsheetId: string;
  tab: string;
  /** Header of the column holding the athlete's IG handle. */
  handleHeader: string;
  /** deliverable_key → platform → column header. Platforms left out are not mirrored. */
  columns: Record<string, Partial<Record<Platform, string>>>;
};

// posting_campaigns.id → where its links go.
const SHEET_SYNC: Record<string, SheetTarget> = {
  // Raising Cane's · Caniac Ambassador · Basketball 2027 — internal sheet
  '373c15c7-1cb2-422c-8805-8ecfdd986227': {
    spreadsheetId: '1JZotrWSQcx3t3Sl1Klzpohwwy67xDWlsdrlKWchm7uc', // TEST COPY — revert before merge
    tab: 'Athlete Posting',
    handleHeader: 'IG Handle',
    columns: {
      reel: { instagram: 'IG Reel', tiktok: 'TikTok #1' },
      feed: { instagram: 'IG Feed', tiktok: 'TikTok #2' },
    },
  },
};

const normHandle = (h: unknown) =>
  String(h ?? '').trim().toLowerCase().replace(/^@/, '');
const normHeader = (h: unknown) => String(h ?? '').trim().toLowerCase();

/** 0-based column index → A1 letters (0 → A, 25 → Z, 26 → AA). */
function colLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export type SheetSyncResult =
  | { status: 'written'; cell: string }
  | { status: 'skipped'; reason: string };

/**
 * Write one saved link into its campaign's sheet, if the campaign has one.
 * Never throws.
 */
export async function mirrorLinkToSheet(
  packageId: string,
  platform: Platform,
  url: string
): Promise<SheetSyncResult> {
  try {
    const supabase = createLiveServiceSupabase();
    const { data: pkg, error } = await supabase
      .from('posting_packages')
      .select('posting_campaign_id, deliverable_key, ig_handle')
      .eq('id', packageId)
      .maybeSingle();
    if (error || !pkg) return { status: 'skipped', reason: 'package not found' };

    const target = pkg.posting_campaign_id ? SHEET_SYNC[pkg.posting_campaign_id] : undefined;
    if (!target) return { status: 'skipped', reason: 'campaign has no sheet' };

    const header = target.columns[pkg.deliverable_key ?? '']?.[platform];
    if (!header) return { status: 'skipped', reason: `no column for ${pkg.deliverable_key}/${platform}` };

    const handle = normHandle(pkg.ig_handle);
    if (!handle) return { status: 'skipped', reason: 'athlete has no IG handle' };

    const sheets = google.sheets({ version: 'v4', auth: getGoogleAuth() });
    const quotedTab = `'${target.tab.replace(/'/g, "''")}'`;
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId: target.spreadsheetId,
      range: `${quotedTab}!A1:ZZ500`,
    });
    const rows = data.values ?? [];
    const headers = (rows[0] ?? []).map(normHeader);

    const handleCol = headers.indexOf(normHeader(target.handleHeader));
    const linkCol = headers.indexOf(normHeader(header));
    if (handleCol < 0 || linkCol < 0) {
      console.error('sheet-sync: header missing', { tab: target.tab, handleHeader: target.handleHeader, header });
      return { status: 'skipped', reason: 'header not found' };
    }

    const matches: number[] = [];
    rows.forEach((r, i) => {
      if (i > 0 && normHandle(r[handleCol]) === handle) matches.push(i);
    });
    if (matches.length !== 1) {
      console.error('sheet-sync: handle match count', { handle, count: matches.length });
      return { status: 'skipped', reason: matches.length ? 'handle on more than one row' : 'handle not in sheet' };
    }

    const rowIndex = matches[0];
    const current = String(rows[rowIndex][linkCol] ?? '').trim();
    if (current) return { status: 'skipped', reason: 'cell already filled' };

    const cell = `${colLetter(linkCol)}${rowIndex + 1}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: target.spreadsheetId,
      range: `${quotedTab}!${cell}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[url]] },
    });
    return { status: 'written', cell };
  } catch (err) {
    console.error('sheet-sync: failed', err);
    return { status: 'skipped', reason: 'error' };
  }
}
