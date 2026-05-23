#!/usr/bin/env node
// Re-dedup pass on a campaign at a tighter Hamming threshold than the
// import-time curation used. For each folder (athlete or team), groups images
// into near-dup clusters by 64-bit dHash within `--threshold` bits, keeps the
// highest quality_score in each cluster, deletes the rest (rows + variants).
//
// Usage:
//   node --env-file=.env.local scripts/redup-campaign.js \
//     --campaign <slug> [--threshold 18] [--dry-run] [--apply]
//
// Default is dry-run unless --apply is passed.

const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const CAMPAIGN_SLUG = getArg('--campaign');
const THRESHOLD = parseInt(getArg('--threshold') || '18', 10);
const APPLY = args.includes('--apply');

if (!CAMPAIGN_SLUG) {
  console.error('Usage: --campaign <slug> [--threshold 18] [--apply]');
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Run with --env-file=.env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function hamming(aHex, bHex) {
  let x = BigInt('0x' + aHex) ^ BigInt('0x' + bHex);
  let d = 0;
  while (x !== 0n) {
    if (x & 1n) d++;
    x >>= 1n;
  }
  return d;
}

function folderOf(storagePath) {
  // "diamond-sports-dicks/isaiah-nolan/abc.jpg" -> "diamond-sports-dicks/isaiah-nolan"
  return storagePath.substring(0, storagePath.lastIndexOf('/'));
}

function variantPaths(originalPath) {
  return ['w800', 'w400'].map(suf =>
    originalPath.replace(/\.[a-zA-Z0-9]+$/, `.${suf}.webp`)
  );
}

async function main() {
  const { data: camp, error: cErr } = await supabase
    .from('campaign_recaps')
    .select('id, slug, name')
    .eq('slug', CAMPAIGN_SLUG)
    .maybeSingle();
  if (cErr || !camp) throw new Error(`campaign lookup failed: ${cErr?.message || 'not found'}`);

  console.log(`\nRe-dedup for ${camp.name} (${camp.slug})  threshold=${THRESHOLD} bits  ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  const { data: rows, error: mErr } = await supabase
    .from('media')
    .select('id, type, storage_path, phash, quality_score, file_url')
    .eq('campaign_id', camp.id)
    .eq('type', 'image')
    .not('phash', 'is', null)
    .order('storage_path');
  if (mErr) throw mErr;
  console.log(`Images with phash: ${rows.length}`);

  const missing = rows.filter(r => r.phash == null).length;
  if (missing) console.log(`  ! ${missing} images missing phash (skipped) — run backfill-media-attrs.js first`);

  // Group by folder
  const groups = new Map();
  for (const r of rows) {
    const f = folderOf(r.storage_path);
    if (!groups.has(f)) groups.set(f, []);
    groups.get(f).push(r);
  }

  // Greedy cluster within each folder, sorted by quality desc.
  const toDelete = []; // {row, dupOf}
  for (const [folder, items] of groups) {
    if (items.length < 2) continue;
    const sorted = [...items].sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
    const kept = [];
    for (const r of sorted) {
      let dupOf = null;
      for (const k of kept) {
        if (hamming(r.phash, k.phash) <= THRESHOLD) { dupOf = k; break; }
      }
      if (dupOf) toDelete.push({ row: r, dupOf });
      else kept.push(r);
    }
    if (sorted.length !== kept.length) {
      console.log(`\n[${folder}]  ${items.length} → ${kept.length}  (drop ${items.length - kept.length})`);
      for (const r of items) {
        const drop = toDelete.find(t => t.row.id === r.id);
        const tag = drop
          ? `DROP  (dup of ${drop.dupOf.storage_path.split('/').pop()} @${hamming(r.phash, drop.dupOf.phash)} bits)`
          : 'keep';
        console.log(`  ${tag.padEnd(70)} ${r.storage_path.split('/').pop()}  q=${(r.quality_score||0).toFixed(1)}  phash=${r.phash}`);
      }
    }
  }

  console.log(`\nTotal to drop: ${toDelete.length}`);
  if (!APPLY) {
    console.log('Dry-run only. Pass --apply to delete.');
    return;
  }
  if (toDelete.length === 0) return;

  // Build storage path list (originals + w800 + w400)
  const ids = toDelete.map(t => t.row.id);
  const storagePaths = [];
  for (const t of toDelete) {
    if (!t.row.storage_path) continue;
    storagePaths.push(t.row.storage_path);
    for (const v of variantPaths(t.row.storage_path)) storagePaths.push(v);
  }

  // Storage first.
  const { data: rm, error: rmErr } = await supabase.storage.from('campaign-media').remove(storagePaths);
  if (rmErr) throw new Error(`storage remove failed: ${rmErr.message}`);
  console.log(`Removed ${rm.length} storage object(s).`);

  let r1 = await supabase.from('media_athletes').delete().in('media_id', ids);
  if (r1.error) throw r1.error;
  let r2 = await supabase.from('media_campaigns').delete().in('media_id', ids);
  if (r2.error) throw r2.error;
  let r3 = await supabase.from('media').delete().in('id', ids);
  if (r3.error) throw r3.error;
  console.log(`Deleted ${ids.length} DB row(s).`);

  const { count } = await supabase
    .from('media')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', camp.id);
  console.log(`Total media rows for ${camp.slug} now: ${count}`);
}

main().catch(e => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
