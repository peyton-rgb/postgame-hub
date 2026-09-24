// scripts/posting/load-approved-content.ts
// ─────────────────────────────────────────────────────────────
// Load the approved Cane's files from Drive into posting instructions.
//
// Run:
//   npx tsx --env-file=.env.local scripts/posting/load-approved-content.ts --campaign <id>          # dry run
//   npx tsx --env-file=.env.local scripts/posting/load-approved-content.ts --campaign <id> --apply  # writes
//
// 20 athletes × (Reel + cover + 3–5 feed photos) is 122 files. Doing it
// through the staff editor means 122 round trips, and a 45–79 MB video will
// not survive a 60-second Vercel function. This does the same work locally,
// through the SAME helpers the attach route uses, so a file loaded here is
// indistinguishable from one attached by hand:
//
//   downloadAndUpload()  — Drive bytes → campaign-media
//   removeUpload()       — deletes a replaced copy
//   storage path         — posting/<campaign>/<package>/<slot>-<ts>-<name>
//
// It writes ONLY: posting_packages.video_url, .cover_url, .video_status,
// .updated_at, and rows in posting_package_files. Captions, status, sent_at,
// live_url, posted_at, dates and tokens are never touched.
//
// Idempotent. A slot already holding the same file is skipped; a slot holding
// a different file is replaced and the old upload removed.
// ─────────────────────────────────────────────────────────────

// Node's --env-file leaves a trailing newline on values written by
// `vercel env pull` (it stores them as "…\n"). Every helper below reads
// process.env directly, so normalise once, here, before anything else —
// an untrimmed URL makes every Storage call 404.
for (const k of Object.keys(process.env)) {
  const v = process.env[k];
  if (typeof v === 'string') process.env[k] = v.trim();
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { downloadAndUpload, removeUpload, sanitizeFileName } from '@/lib/drive-import';
import { getDriveClient, isDriveRateLimit, driveSleep } from '@/lib/google-drive';

// ---- Drive folders to ignore ------------------------------------------------
// Every Reel also sits in a flat staging folder; same bytes, wrong home. Always
// take the copy in the athlete's own Videos folder.
const IGNORED_PARENTS = new Set([
  '16jG4UNW7yUoqX-AFY2GKfgTszyAGIJJJ', // canes-fb-delivery staging
  '1Z7a20XpstFA74YV40zJsJ697Xxs3hYn6', // third Parker Livingstone copy
]);

// Athletes with no FINAL reel or cover — raw camera files only. Not ours to load.
const OUT_OF_SCOPE = new Set(['isaac brown', 'randy pittman jr.', 'randy pittman jr']);

type Slot = 'video' | 'cover' | 'photo';

type DriveFile = { id: string; name: string; mimeType: string; size: string | null; parent: string | null };

type Parsed = { athlete: string; slot: Slot; position: number; file: DriveFile };

type PackageRow = {
  id: string;
  athlete_name: string;
  deliverable_key: string | null;
  posting_campaign_id: string | null;
  video_url: string | null;
  cover_url: string | null;
  video_status: string | null;
};

type PhotoRow = {
  id: string;
  package_id: string;
  position: number;
  drive_file_id: string | null;
  storage_path: string | null;
  file_name: string | null;
};

// ---- args -------------------------------------------------------------------

const argv = process.argv.slice(2);
function arg(name: string): string | null {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1] ?? null) : null;
}
const APPLY = argv.includes('--apply');
const CAMPAIGN = arg('campaign');

if (!CAMPAIGN) {
  console.error('Missing --campaign <posting_campaign_id>');
  process.exit(1);
}

// ---- clients ----------------------------------------------------------------

function serviceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Drive calls, retried on rateLimitExceeded with backoff. */
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 5): Promise<T> {
  let wait = 1000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= tries || !isDriveRateLimit(err)) throw err;
      console.log(`    rate limited on ${label}; retrying in ${wait}ms (${attempt}/${tries - 1})`);
      await driveSleep(wait);
      wait *= 2;
    }
  }
}

// ---- name parsing -----------------------------------------------------------

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

// "{Athlete} {Asset} {NN} - Raising Cane's Football 2026 - FINAL.{ext}"
// "Cover Photo" must be tested before "Photo", or every cover reads as photo 1.
const NAME_RE = /^(.+?)\s+(Cover Photo|Reel|Photo)\s+(\d{1,2})\s*-\s*Raising Cane.s Football 2026\s*-\s*FINAL\.[a-z0-9]+$/i;

function parseName(f: DriveFile): Parsed | null {
  const m = NAME_RE.exec(f.name.trim());
  if (!m) return null;
  const asset = m[2].toLowerCase();
  const slot: Slot = asset === 'reel' ? 'video' : asset === 'cover photo' ? 'cover' : 'photo';
  return { athlete: m[1].trim(), slot, position: parseInt(m[3], 10), file: f };
}

// ---- Drive listing ----------------------------------------------------------

async function listFinalFiles(): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const res = await withRetry('files.list', () =>
      drive.files.list({
        // No apostrophe in the term, so the query needs no escaping.
        q: "name contains 'Football 2026 - FINAL' and trashed = false",
        fields: 'nextPageToken, files(id, name, mimeType, size, parents)',
        pageSize: 1000,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: 'allDrives',
        pageToken,
      })
    );
    for (const f of res.data.files ?? []) {
      out.push({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType ?? '',
        size: f.size ?? null,
        parent: f.parents?.[0] ?? null,
      });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

// ---- helpers ----------------------------------------------------------------

/** The attach route's path, reproduced exactly. */
function storagePathFor(campaignId: string, packageId: string, slot: Slot, fileName: string): string {
  return `posting/${campaignId}/${packageId}/${slot}-${Date.now()}-${sanitizeFileName(fileName)}`;
}

/**
 * Whether a stored URL already holds this Drive file.
 *
 * posting_packages has no drive_file_id for video/cover, so the check is the
 * sanitised file name the attach route bakes into the storage path. Photos
 * carry drive_file_id and are compared on that instead.
 */
function urlHoldsFile(url: string | null, fileName: string): boolean {
  if (!url) return false;
  try {
    return decodeURIComponent(new URL(url).pathname).endsWith(`-${sanitizeFileName(fileName)}`);
  } catch {
    return false;
  }
}

const OWN_UPLOAD = /\/storage\/v1\/object\/public\/campaign-media\/(posting\/.+)$/;
function ownStoragePath(url: string | null): string | null {
  if (!url) return null;
  try {
    const m = OWN_UPLOAD.exec(new URL(url).pathname);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function mb(size: string | null): string {
  const n = Number(size ?? 0);
  return n ? `${(n / 1048576).toFixed(1)} MB` : '?';
}

// ---- main -------------------------------------------------------------------

async function main() {
  const supabase = serviceSupabase();

  const { data: pkgData, error: pkgErr } = await supabase
    .from('posting_packages')
    .select('id, athlete_name, deliverable_key, posting_campaign_id, video_url, cover_url, video_status')
    .eq('posting_campaign_id', CAMPAIGN);
  if (pkgErr) throw new Error(`Loading packages failed: ${pkgErr.message}`);
  const packages = (pkgData as unknown as PackageRow[]) ?? [];
  if (!packages.length) throw new Error(`No posting_packages for campaign ${CAMPAIGN}`);

  // athlete → { reel, feed }
  const byAthlete = new Map<string, { name: string; reel?: PackageRow; feed?: PackageRow }>();
  for (const p of packages) {
    const key = norm(p.athlete_name);
    const entry = byAthlete.get(key) ?? { name: p.athlete_name.trim() };
    if (p.deliverable_key === 'reel') entry.reel = p;
    else if (p.deliverable_key === 'feed') entry.feed = p;
    byAthlete.set(key, entry);
  }

  const { data: photoData, error: photoErr } = await supabase
    .from('posting_package_files')
    .select('id, package_id, position, drive_file_id, storage_path, file_name')
    .in('package_id', packages.map((p) => p.id));
  if (photoErr) throw new Error(`Loading photos failed: ${photoErr.message}`);
  const existingPhotos = (photoData as unknown as PhotoRow[]) ?? [];
  const photosByPackage = new Map<string, PhotoRow[]>();
  for (const r of existingPhotos) {
    const list = photosByPackage.get(r.package_id) ?? [];
    list.push(r);
    photosByPackage.set(r.package_id, list);
  }

  console.log(`Campaign ${CAMPAIGN}`);
  console.log(`  ${packages.length} posting_packages · ${byAthlete.size} athletes · ${existingPhotos.length} photos already loaded`);
  console.log(`  mode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN (writes nothing)'}\n`);

  console.log('Searching Drive…');
  const all = await listFinalFiles();
  const ignored = all.filter((f) => f.parent && IGNORED_PARENTS.has(f.parent));
  const usable = all.filter((f) => !(f.parent && IGNORED_PARENTS.has(f.parent)));
  console.log(`  ${all.length} FINAL files · ${ignored.length} in ignored staging folders · ${usable.length} usable\n`);

  const unparsed: DriveFile[] = [];
  const parsed: Parsed[] = [];
  for (const f of usable) {
    const p = parseName(f);
    if (p) parsed.push(p);
    else unparsed.push(f);
  }

  // athlete → slot → files
  type Plan = {
    name: string;
    matched: boolean;
    video?: Parsed;
    cover?: Parsed;
    photos: Parsed[];
    duplicates: string[];
  };
  const plans = new Map<string, Plan>();
  const unmatchedFiles: Parsed[] = [];
  const outOfScopeFiles: Parsed[] = [];

  for (const p of parsed) {
    const key = norm(p.athlete);
    if (OUT_OF_SCOPE.has(key)) {
      outOfScopeFiles.push(p);
      continue;
    }
    if (!byAthlete.has(key)) {
      unmatchedFiles.push(p);
      continue;
    }
    const plan = plans.get(key) ?? { name: byAthlete.get(key)!.name, matched: true, photos: [], duplicates: [] };
    if (p.slot === 'video') {
      if (plan.video) plan.duplicates.push(`${p.file.name} (second Reel)`);
      else plan.video = p;
    } else if (p.slot === 'cover') {
      if (plan.cover) plan.duplicates.push(`${p.file.name} (second cover)`);
      else plan.cover = p;
    } else {
      if (plan.photos.some((x) => x.position === p.position)) {
        plan.duplicates.push(`${p.file.name} (second photo at position ${p.position})`);
      } else {
        plan.photos.push(p);
      }
    }
    plans.set(key, plan);
  }
  for (const plan of Array.from(plans.values())) plan.photos.sort((a, b) => a.position - b.position);

  // ---- report ----
  console.log('Per athlete');
  console.log('  ' + 'athlete'.padEnd(20) + 'video  cover  photos');
  let vTotal = 0, cTotal = 0, pTotal = 0;
  const rowsWithNothing: string[] = [];
  for (const key of Array.from(byAthlete.keys()).sort()) {
    const entry = byAthlete.get(key)!;
    const plan = plans.get(key);
    const v = plan?.video ? '✓' : '✗';
    const c = plan?.cover ? '✓' : '✗';
    const n = plan?.photos.length ?? 0;
    if (plan?.video) vTotal++;
    if (plan?.cover) cTotal++;
    pTotal += n;
    if (!plan || (!plan.video && !plan.cover && n === 0)) rowsWithNothing.push(entry.name);
    console.log(`  ${entry.name.padEnd(20)}  ${v}      ${c}      ${n}`);
  }
  console.log(`  ${''.padEnd(20)}  ${String(vTotal).padStart(2)}     ${String(cTotal).padStart(2)}     ${pTotal}`);

  const dupes = Array.from(plans.values()).flatMap((p) => p.duplicates.map((d) => `${p.name}: ${d}`));

  console.log('\nFiles that matched no athlete row: ' + (unmatchedFiles.length || 'none'));
  for (const f of unmatchedFiles) console.log(`  ${f.athlete} — ${f.file.name}`);

  console.log('Out of scope (no FINAL reel/cover; skipped): ' +
    (outOfScopeFiles.length ? `${outOfScopeFiles.length} files` : 'none'));
  const oosNames = Array.from(new Set(outOfScopeFiles.map((f) => f.athlete)));
  for (const n of oosNames) console.log(`  ${n}`);

  console.log('Athlete rows that got nothing: ' + (rowsWithNothing.length || 'none'));
  for (const n of rowsWithNothing) console.log(`  ${n}`);

  console.log('Unreadable file names: ' + (unparsed.length || 'none'));
  for (const f of unparsed.slice(0, 10)) console.log(`  ${f.name}`);

  console.log('Duplicate matches: ' + (dupes.length || 'none'));
  for (const d of dupes) console.log(`  ${d}`);

  // ---- what --apply would actually do, slot by slot ----
  // A dry run that only counts matches hides the interesting cases: a slot
  // already holding the right file, and one holding a different file that
  // would be overwritten. Both are decided here, with no writes.
  let willLoad = 0, willSkip = 0, willReplace = 0;
  const skipNotes: string[] = [];
  const replaceNotes: string[] = [];
  for (const key of Array.from(plans.keys()).sort()) {
    const plan = plans.get(key)!;
    const entry = byAthlete.get(key)!;
    for (const [slot, hit] of [['video', plan.video], ['cover', plan.cover]] as const) {
      if (!hit || !entry.reel) continue;
      const current = slot === 'video' ? entry.reel.video_url : entry.reel.cover_url;
      if (urlHoldsFile(current, hit.file.name)) {
        willSkip++;
        skipNotes.push(`${plan.name} ${slot} — already holds ${hit.file.name}`);
      } else if (current) {
        willReplace++;
        replaceNotes.push(`${plan.name} ${slot} — replaces a different file`);
      } else {
        willLoad++;
      }
    }
    if (!entry.feed) continue;
    const already = photosByPackage.get(entry.feed.id) ?? [];
    for (const hit of plan.photos) {
      const atPos = already.find((r) => r.position === hit.position);
      if (atPos?.drive_file_id === hit.file.id) {
        willSkip++;
        skipNotes.push(`${plan.name} photo ${hit.position} — already loaded`);
      } else if (atPos) {
        willReplace++;
        replaceNotes.push(`${plan.name} photo ${hit.position} — replaces a different file`);
      } else {
        willLoad++;
      }
    }
  }

  console.log(`\nPlanned writes: ${willLoad} to load · ${willSkip} already loaded (skip) · ${willReplace} to replace`);
  for (const n of skipNotes) console.log(`  skip:    ${n}`);
  for (const n of replaceNotes) console.log(`  replace: ${n}`);

  if (!APPLY) {
    console.log('\nDry run — nothing written. Re-run with --apply to load these files.');
    return;
  }

  // ---- apply ----
  console.log('\nApplying…');
  let uploaded = 0, skipped = 0, replaced = 0, failed = 0;

  for (const key of Array.from(plans.keys()).sort()) {
    const plan = plans.get(key)!;
    const entry = byAthlete.get(key)!;
    console.log(`\n  ${plan.name}`);

    // --- Reel row: video + cover ---
    const reel = entry.reel;
    if (reel) {
      for (const [slot, hit] of [['video', plan.video], ['cover', plan.cover]] as const) {
        if (!hit) continue;
        const column = slot === 'video' ? 'video_url' : 'cover_url';
        const current = slot === 'video' ? reel.video_url : reel.cover_url;
        if (urlHoldsFile(current, hit.file.name)) {
          console.log(`    ${slot}: already loaded (${hit.file.name}) — skipped`);
          skipped++;
          continue;
        }
        const isReplace = !!current;
        const path = storagePathFor(CAMPAIGN!, reel.id, slot, hit.file.name);
        try {
          console.log(`    ${slot}: copying ${hit.file.name} (${mb(hit.file.size)})…`);
          const { publicUrl } = await withRetry(`upload ${slot}`, () =>
            downloadAndUpload(supabase, { fileId: hit.file.id, fileName: hit.file.name, storagePath: path })
          );
          const patch: Record<string, unknown> = { [column]: publicUrl, updated_at: new Date().toISOString() };
          // The brief marks a loaded reel approved; the cover has no status column.
          if (slot === 'video') patch.video_status = 'Approved';
          const { error } = await supabase.from('posting_packages').update(patch).eq('id', reel.id);
          if (error) {
            await removeUpload(supabase, path);
            throw new Error(error.message);
          }
          const old = ownStoragePath(current);
          if (old && old !== path) {
            await removeUpload(supabase, old).catch((e) => console.log(`      old upload not removed: ${e}`));
          }
          if (isReplace) { replaced++; console.log(`    ${slot}: replaced`); }
          else { uploaded++; console.log(`    ${slot}: loaded`); }
          if (slot === 'video') reel.video_url = publicUrl; else reel.cover_url = publicUrl;
        } catch (e: any) {
          failed++;
          console.log(`    ${slot}: FAILED — ${e?.message ?? e}`);
        }
      }
    } else if (plan.video || plan.cover) {
      console.log('    no reel row for this athlete — video/cover skipped');
    }

    // --- Feed row: carousel photos ---
    const feed = entry.feed;
    if (feed) {
      const already = photosByPackage.get(feed.id) ?? [];
      for (const hit of plan.photos) {
        const atPos = already.find((r) => r.position === hit.position);
        if (atPos?.drive_file_id === hit.file.id) {
          console.log(`    photo ${hit.position}: already loaded — skipped`);
          skipped++;
          continue;
        }
        const path = storagePathFor(CAMPAIGN!, feed.id, 'photo', hit.file.name);
        try {
          console.log(`    photo ${hit.position}: copying ${hit.file.name} (${mb(hit.file.size)})…`);
          const { publicUrl } = await withRetry('upload photo', () =>
            downloadAndUpload(supabase, { fileId: hit.file.id, fileName: hit.file.name, storagePath: path })
          );
          const row = {
            package_id: feed.id,
            kind: 'photo' as const,
            position: hit.position,
            url: publicUrl,
            storage_path: path,
            drive_file_id: hit.file.id,
            file_name: hit.file.name,
          };
          if (atPos) {
            const { error } = await supabase.from('posting_package_files').update(row).eq('id', atPos.id);
            if (error) { await removeUpload(supabase, path); throw new Error(error.message); }
            if (atPos.storage_path && atPos.storage_path !== path) {
              await removeUpload(supabase, atPos.storage_path).catch(() => {});
            }
            replaced++;
            console.log(`    photo ${hit.position}: replaced`);
          } else {
            const { error } = await supabase.from('posting_package_files').insert(row);
            if (error) { await removeUpload(supabase, path); throw new Error(error.message); }
            uploaded++;
            console.log(`    photo ${hit.position}: loaded`);
          }
        } catch (e: any) {
          failed++;
          console.log(`    photo ${hit.position}: FAILED — ${e?.message ?? e}`);
        }
      }
    } else if (plan.photos.length) {
      console.log('    no feed row for this athlete — photos skipped');
    }
  }

  console.log(`\nDone. loaded ${uploaded} · replaced ${replaced} · skipped ${skipped} · failed ${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error('\nFailed:', e?.message ?? e);
  process.exit(1);
});
