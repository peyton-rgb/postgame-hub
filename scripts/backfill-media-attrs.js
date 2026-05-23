#!/usr/bin/env node
// Backfill focal_x/focal_y, phash, quality_score, and thumbnail variants
// (_w800.webp, _w400.webp) for every image row in a campaign.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-media-attrs.js \
//     --campaign <slug> [--dry-run] [--limit N] [--force]
//
// Idempotent: skips images that already have phash + focal_x/y set,
// unless --force is passed.

const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');
const smartcrop = require('smartcrop-sharp');
const { createClient } = require('@supabase/supabase-js');

// -------- args --------
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const CAMPAIGN_SLUG = getArg('--campaign');
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const LIMIT = parseInt(getArg('--limit') || '0', 10) || null;

if (!CAMPAIGN_SLUG) {
  console.error('Usage: --campaign <slug> [--dry-run] [--limit N] [--force]');
  process.exit(1);
}

// -------- env --------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Run with --env-file=.env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const BUCKET = 'campaign-media';
const VARIANTS = [
  { suffix: 'w800', width: 800, quality: 80 },
  { suffix: 'w400', width: 400, quality: 78 },
];

// -------- helpers --------
function variantPath(originalStoragePath, suffix) {
  // Replace the file extension with `.<suffix>.webp`.
  // e.g. ".../1xyz-IMG_001.jpg" -> ".../1xyz-IMG_001.w800.webp"
  return originalStoragePath.replace(/\.[a-zA-Z0-9]+$/, `.${suffix}.webp`);
}

async function downloadStorageBuffer(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error) throw new Error(`download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

// 64-bit dHash on 9x8 grayscale → 16-char hex string.
async function computeDHash(buf) {
  const raw = await sharp(buf, { failOn: 'none' })
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (raw[y * 9 + x] > raw[y * 9 + x + 1]) {
        bits |= 1n << BigInt(y * 8 + x);
      }
    }
  }
  return bits.toString(16).padStart(16, '0');
}

async function computeQualityScore(buf, widthOpt, heightOpt) {
  // 64x64 grayscale to compute contrast (stddev) + edge density (sharpness proxy).
  const gray = await sharp(buf, { failOn: 'none' })
    .resize(64, 64, { fit: 'cover' })
    .grayscale()
    .raw()
    .toBuffer();
  let sum = 0, sumSq = 0;
  for (let i = 0; i < gray.length; i++) { sum += gray[i]; sumSq += gray[i] * gray[i]; }
  const mean = sum / gray.length;
  const stddev = Math.sqrt(Math.max(0, sumSq / gray.length - mean * mean));
  let edges = 0, edgeN = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 63; x++) { edges += Math.abs(gray[y * 64 + x] - gray[y * 64 + x + 1]); edgeN++; }
  }
  for (let y = 0; y < 63; y++) {
    for (let x = 0; x < 64; x++) { edges += Math.abs(gray[y * 64 + x] - gray[(y + 1) * 64 + x]); edgeN++; }
  }
  const sharpness = edges / edgeN;
  const px = (widthOpt || 0) * (heightOpt || 0);
  const resScore = px > 0 ? Math.log2(px) : 0;
  return sharpness * 1.0 + stddev * 0.5 + resScore * 0.2;
}

async function computeFocalPoint(buf, meta) {
  // smartcrop weighs skin tones + saturation + saliency. Ask for a square crop;
  // its centroid gives a robust focal point for either landscape or portrait crops.
  try {
    const target = Math.min(meta.width || 800, meta.height || 800, 800);
    const result = await smartcrop.crop(buf, { width: target, height: target });
    const tc = result.topCrop;
    if (!tc || !meta.width || !meta.height) return { x: 0.5, y: 0.5, score: 0 };
    const x = (tc.x + tc.width / 2) / meta.width;
    const y = (tc.y + tc.height / 2) / meta.height;
    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
      score: tc.score?.total || 0,
    };
  } catch (e) {
    return { x: 0.5, y: 0.5, score: 0, error: e.message };
  }
}

async function makeVariant(buf, width, quality) {
  return sharp(buf, { failOn: 'none' })
    .rotate() // honor EXIF orientation so we don't store sideways thumbs
    .resize(width, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

async function uploadVariant(storagePath, body) {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, body, {
    contentType: 'image/webp',
    upsert: true,
  });
  if (error) throw new Error(`upload ${storagePath} failed: ${error.message}`);
}

// -------- main --------
async function main() {
  // Resolve campaign
  const { data: camp, error: cErr } = await supabase
    .from('campaign_recaps')
    .select('id, slug, name')
    .eq('slug', CAMPAIGN_SLUG)
    .maybeSingle();
  if (cErr || !camp) throw new Error(`campaign lookup failed: ${cErr?.message || 'not found'}`);
  console.log(`\nBackfill for ${camp.name} (${camp.slug})  id=${camp.id}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}${FORCE ? '  --force' : ''}`);

  // Fetch all image media for the campaign
  let q = supabase
    .from('media')
    .select('id, type, storage_path, content_type, file_url, focal_x, focal_y, phash, quality_score, resolution')
    .eq('campaign_id', camp.id)
    .eq('type', 'image')
    .order('created_at');
  if (LIMIT) q = q.limit(LIMIT);
  const { data: rows, error: mErr } = await q;
  if (mErr) throw new Error(`media lookup failed: ${mErr.message}`);
  console.log(`Found ${rows.length} image rows in this campaign.\n`);

  let processed = 0, skipped = 0, errors = 0, variantsUploaded = 0;

  for (const m of rows) {
    const need = FORCE || m.phash == null || m.focal_x == null || m.quality_score == null;
    if (!need) {
      skipped++;
      continue;
    }
    if (!m.storage_path) {
      console.log(`  ! ${m.id} has no storage_path; skipping`);
      errors++;
      continue;
    }

    try {
      const buf = await downloadStorageBuffer(m.storage_path);
      const meta = await sharp(buf, { failOn: 'none' }).metadata();
      const w = meta.width || null;
      const h = meta.height || null;

      const phash = await computeDHash(buf);
      const focal = await computeFocalPoint(buf, meta);
      const quality = await computeQualityScore(buf, w, h);

      console.log(`  ${m.storage_path}`);
      console.log(`    phash=${phash}  focal=(${focal.x.toFixed(3)}, ${focal.y.toFixed(3)})  quality=${quality.toFixed(2)}`);

      if (!DRY_RUN) {
        // Generate + upload thumbnail variants.
        for (const v of VARIANTS) {
          const body = await makeVariant(buf, v.width, v.quality);
          await uploadVariant(variantPath(m.storage_path, v.suffix), body);
          variantsUploaded++;
        }

        // Persist attributes.
        const update = {
          focal_x: focal.x,
          focal_y: focal.y,
          phash,
          quality_score: quality,
        };
        if (w && h && !m.resolution) update.resolution = `${w}x${h}`;
        const { error: uErr } = await supabase.from('media').update(update).eq('id', m.id);
        if (uErr) throw new Error(`update failed: ${uErr.message}`);
      }
      processed++;
    } catch (e) {
      console.error(`  ! ${m.storage_path}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n— Summary —`);
  console.log(`  processed: ${processed}`);
  console.log(`  skipped (already done): ${skipped}`);
  console.log(`  variants uploaded: ${variantsUploaded}`);
  console.log(`  errors: ${errors}`);
}

main().catch(e => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
