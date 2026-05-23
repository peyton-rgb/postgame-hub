#!/usr/bin/env node
// One-off: generate _w1600.webp variants for the landscape image media rows
// of a campaign, so the full-bleed hero has crisp source images without
// burning bandwidth on the originals. Idempotent (upsert: true).
//
// Usage:
//   node --env-file=.env.local scripts/add-hero-variant.js --campaign <slug>

const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const getArg = (f) => {
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const CAMPAIGN_SLUG = getArg('--campaign');
if (!CAMPAIGN_SLUG) { console.error('Usage: --campaign <slug>'); process.exit(1); }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const BUCKET = 'campaign-media';

function variantPath(storagePath, suffix) {
  return storagePath.replace(/\.[a-zA-Z0-9]+$/, `.${suffix}.webp`);
}

async function processOne(m) {
  const { data, error } = await supabase.storage.from(BUCKET).download(m.storage_path);
  if (error) throw new Error(`download: ${error.message}`);
  const buf = Buffer.from(await data.arrayBuffer());
  const body = await sharp(buf, { failOn: 'none' })
    .rotate()
    .resize(1600, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
  const target = variantPath(m.storage_path, 'w1600');
  const up = await supabase.storage.from(BUCKET).upload(target, body, {
    contentType: 'image/webp', upsert: true,
  });
  if (up.error) throw new Error(`upload: ${up.error.message}`);
  return target;
}

async function main() {
  const { data: camp } = await supabase
    .from('campaign_recaps').select('id, slug').eq('slug', CAMPAIGN_SLUG).maybeSingle();
  if (!camp) throw new Error('campaign not found');

  // Landscape only — width > height — to keep hero candidates aligned with the prototype.
  const { data: rows } = await supabase
    .from('media')
    .select('id, storage_path, resolution')
    .eq('campaign_id', camp.id)
    .eq('type', 'image')
    .not('storage_path', 'is', null);
  const landscape = (rows || []).filter(r => {
    if (!r.resolution) return false;
    const [w, h] = r.resolution.split('x').map(Number);
    return w > h;
  });
  console.log(`Generating _w1600.webp for ${landscape.length} landscape image(s)`);

  // Concurrency 4 — sharp + upload bound, not CPU-bound.
  let idx = 0, ok = 0, err = 0;
  const workers = Array.from({ length: 4 }, async () => {
    while (true) {
      const i = idx++;
      if (i >= landscape.length) break;
      const m = landscape[i];
      try { const t = await processOne(m); console.log(`  ok ${t}`); ok++; }
      catch (e) { console.error(`  ! ${m.storage_path}: ${e.message}`); err++; }
    }
  });
  await Promise.all(workers);
  console.log(`Done. ok=${ok} err=${err}`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
