// ============================================================
// Mirror an athlete's posted link into a campaign's Google Sheet.
//
// When an athlete pastes a link on /deliver/[token], writeLink() saves it in
// posting_package_links. For campaigns listed in SHEET_SYNC below, this also
// writes the same link into the team's tracking sheet, so nobody has to copy
// links over by hand.
//
// Story screenshots work the same way, with one extra step: the image is
// first copied into the athlete's own Content folder in Google Drive, and
// the Drive file's link is what goes into the sheet.
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
  /** deliverable_key → column header for the Story screenshot's Drive link. */
  storyColumns?: Record<string, string>;
  /**
   * Where Story screenshots are copied in Drive. Each athlete has a folder
   * named `<athlete_name><athleteFolderSuffix>` inside contentFolderId.
   */
  storyDrive?: {
    contentFolderId: string;
    athleteFolderSuffix: string;
    /** Goes after the dash in the file name: "<Athlete> Story 01 - <fileSuffix>.jpg". */
    fileSuffix: string;
  };
};

// posting_campaigns.id → where its links go.
const SHEET_SYNC: Record<string, SheetTarget> = {
  // Raising Cane's · Caniac Ambassador · Basketball 2027 — internal sheet
  '373c15c7-1cb2-422c-8805-8ecfdd986227': {
    spreadsheetId: '1Cc5yHKAC91YmOr2Xkh18tt2fqBf4kl-jBeOkcnSRhNw',
    tab: 'Athlete Posting',
    handleHeader: 'IG Handle',
    columns: {
      reel: { instagram: 'IG Reel', tiktok: 'TikTok #1' },
      feed: { instagram: 'IG Feed', tiktok: 'TikTok #2' },
    },
    storyColumns: { reel: 'IG Story #1', feed: 'IG Story #2' },
    storyDrive: {
      // "Content - Raising Cane's Basketball 2026" in the Postgame shared drive
      contentFolderId: '1PDde8E5S2KaVnfCBZnC8BbCWzWw3eqaV',
      athleteFolderSuffix: " Content - Raising Cane's Basketball 2026",
      fileSuffix: "Raising Cane's Basketball 2026",
    },
  },
};

/** Which Story this is: 01 goes with the first post (reel), 02 with the second (feed). */
const STORY_NUMBER: Record<string, string> = { reel: '01', feed: '02' };

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

type PackageRow = {
  posting_campaign_id: string | null;
  deliverable_key: string | null;
  ig_handle: string | null;
  athlete_name: string | null;
};

async function loadPackage(packageId: string): Promise<PackageRow | null> {
  const supabase = createLiveServiceSupabase();
  const { data, error } = await supabase
    .from('posting_packages')
    .select('posting_campaign_id, deliverable_key, ig_handle, athlete_name')
    .eq('id', packageId)
    .maybeSingle();
  if (error || !data) return null;
  return data as PackageRow;
}

/**
 * Put `value` in the athlete's row (found by IG handle) under `header`,
 * only if that cell is empty.
 */
async function writeCell(
  target: SheetTarget,
  igHandle: string | null,
  header: string,
  value: string
): Promise<SheetSyncResult> {
  const handle = normHandle(igHandle);
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
  const valueCol = headers.indexOf(normHeader(header));
  if (handleCol < 0 || valueCol < 0) {
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
  const current = String(rows[rowIndex][valueCol] ?? '').trim();
  if (current) return { status: 'skipped', reason: 'cell already filled' };

  const cell = `${colLetter(valueCol)}${rowIndex + 1}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: target.spreadsheetId,
    range: `${quotedTab}!${cell}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
  return { status: 'written', cell };
}

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
    const pkg = await loadPackage(packageId);
    if (!pkg) return { status: 'skipped', reason: 'package not found' };

    const target = pkg.posting_campaign_id ? SHEET_SYNC[pkg.posting_campaign_id] : undefined;
    if (!target) return { status: 'skipped', reason: 'campaign has no sheet' };

    const header = target.columns[pkg.deliverable_key ?? '']?.[platform];
    if (!header) return { status: 'skipped', reason: `no column for ${pkg.deliverable_key}/${platform}` };

    return await writeCell(target, pkg.ig_handle, header, url);
  } catch (err) {
    console.error('sheet-sync: failed', err);
    return { status: 'skipped', reason: 'error' };
  }
}

/**
 * Copy a Story screenshot into the athlete's Content folder in Drive, then
 * put the Drive link in the campaign's sheet. Only for campaigns with
 * storyDrive + storyColumns set. Never creates folders (an athlete with no
 * folder is skipped and logged, so we never make stray duplicates).
 * Never throws.
 */
export async function mirrorStoryToDriveAndSheet(
  packageId: string,
  image: { bytes: Uint8Array; mime: string; ext: string }
): Promise<SheetSyncResult> {
  try {
    const pkg = await loadPackage(packageId);
    if (!pkg) return { status: 'skipped', reason: 'package not found' };

    const target = pkg.posting_campaign_id ? SHEET_SYNC[pkg.posting_campaign_id] : undefined;
    if (!target?.storyDrive || !target.storyColumns) return { status: 'skipped', reason: 'campaign has no story sync' };

    const key = pkg.deliverable_key ?? '';
    const header = target.storyColumns[key];
    const number = STORY_NUMBER[key];
    if (!header || !number) return { status: 'skipped', reason: `no story column for ${key}` };

    const athlete = String(pkg.athlete_name ?? '').trim();
    if (!athlete) return { status: 'skipped', reason: 'athlete has no name' };

    const { findFolderByName, uploadFile } = await import('@/lib/google-drive');
    const folderId = await findFolderByName(
      `${athlete}${target.storyDrive.athleteFolderSuffix}`,
      target.storyDrive.contentFolderId
    );
    if (!folderId) {
      console.error('story-sync: athlete folder not found', { athlete });
      return { status: 'skipped', reason: 'athlete folder not found' };
    }

    const fileName = `${athlete} Story ${number} - ${target.storyDrive.fileSuffix}.${image.ext}`;
    const { url } = await uploadFile(fileName, image.mime, Buffer.from(image.bytes), folderId);

    return await writeCell(target, pkg.ig_handle, header, url);
  } catch (err) {
    console.error('story-sync: failed', err);
    return { status: 'skipped', reason: 'error' };
  }
}
