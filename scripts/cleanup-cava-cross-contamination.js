#!/usr/bin/env node
// Remove 5 media rows that belong to CAVA 2024 but got imported into the
// Dick's "Diamond Sports" campaign because of a name collision on "Ella Parker"
// (real Ella Parker is in CAVA; the Ella Parker on Dick's is a separate athlete
// whose legit shots live in the team_ella-parker-kasadi-pickering folder).
//
// Deletes:
//   - media + media_campaigns + media_athletes rows
//   - storage objects (originals + any _w800.webp / _w400.webp variants
//     produced by the backfill script)
//
// Direct DELETE on storage.objects is blocked by a Supabase protective trigger,
// so storage removals go through the Storage API.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Run with --env-file=.env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const DRY_RUN = process.argv.includes('--dry-run');

// IDs match the rows surfaced in the diagnostic query.
const MEDIA_IDS = [
  'c7c0a1ff-69ee-432a-9c46-d8b65e7068b0', // IMG_5800 (image)
  '0eab2b1e-98e3-4c78-97a0-4041b00e683d', // Screen_Shot_2024-05-08 (image)
  '3a34b0b0-cf01-48e7-aae5-88b719c6c8fb', // export_1715031734504 (video)
  'b8715389-ce3b-4731-baed-6d539a4c0669', // IMG_5840 (image)
  '543482aa-b101-4c5d-8154-be007e2d43e5', // Attachment-1 (image)
];

function variantPaths(originalPath) {
  return ['w800', 'w400'].map(suf =>
    originalPath.replace(/\.[a-zA-Z0-9]+$/, `.${suf}.webp`)
  );
}

async function main() {
  // 1. Look up the exact rows we're about to delete (defensive).
  const { data: rows, error: lookErr } = await supabase
    .from('media')
    .select('id, type, storage_path, drive_file_id')
    .in('id', MEDIA_IDS);
  if (lookErr) throw lookErr;

  console.log(`Will delete ${rows.length} of ${MEDIA_IDS.length} requested media row(s):`);
  for (const r of rows) console.log(`  - ${r.id}  ${r.type}  ${r.storage_path}`);

  // 2. Collect storage paths to remove (originals + variants + posters for videos).
  const storagePaths = new Set();
  for (const r of rows) {
    if (!r.storage_path) continue;
    storagePaths.add(r.storage_path);
    if (r.type === 'image') {
      for (const v of variantPaths(r.storage_path)) storagePaths.add(v);
    }
    if (r.type === 'video') {
      // Poster path is `<folder>/posters/<basename>.jpg` — the importer
      // builds the basename from <idPrefix>-<sanitizedName>.
      const basename = r.storage_path.split('/').pop().replace(/\.[a-zA-Z0-9]+$/, '');
      const folder = r.storage_path.substring(0, r.storage_path.lastIndexOf('/'));
      storagePaths.add(`${folder}/posters/${basename}.jpg`);
    }
  }
  const paths = [...storagePaths];
  console.log(`\nStorage objects targeted (${paths.length}):`);
  for (const p of paths) console.log(`  - ${p}`);

  if (DRY_RUN) {
    console.log('\nDRY-RUN: no deletes performed.');
    return;
  }

  // 3. Storage first so a partial-failure mid-run can be re-driven from the DB.
  const { data: rm, error: rmErr } = await supabase.storage.from('campaign-media').remove(paths);
  if (rmErr) throw new Error(`storage remove failed: ${rmErr.message}`);
  console.log(`\nRemoved ${rm.length} storage object(s).`);

  // 4. FK rows.
  let r1 = await supabase.from('media_athletes').delete().in('media_id', MEDIA_IDS);
  if (r1.error) throw new Error(`media_athletes delete: ${r1.error.message}`);
  let r2 = await supabase.from('media_campaigns').delete().in('media_id', MEDIA_IDS);
  if (r2.error) throw new Error(`media_campaigns delete: ${r2.error.message}`);
  let r3 = await supabase.from('media').delete().in('id', MEDIA_IDS);
  if (r3.error) throw new Error(`media delete: ${r3.error.message}`);
  console.log('Deleted DB rows.');

  // 5. Sanity counts.
  const { count, error: cErr } = await supabase
    .from('media')
    .select('id', { count: 'exact', head: true })
    .in('id', MEDIA_IDS);
  if (cErr) throw cErr;
  console.log(`media rows remaining for those IDs: ${count}`);

  const { count: campaignTotal } = await supabase
    .from('media')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', '9b5a651f-9225-4a9f-bbd1-a72d0a994a98');
  console.log(`Total media rows for Dick's campaign now: ${campaignTotal}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
