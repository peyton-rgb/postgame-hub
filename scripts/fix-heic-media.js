#!/usr/bin/env node
// One-off: re-process the HEIC media rows that came in before the importer
// learned to transcode HEIC → JPEG. For each broken row:
//
//   1. Download the HEIC bytes from storage
//   2. heif-convert → JPEG locally
//   3. Compute focal/phash/quality via sharp (works fine on JPEG)
//   4. Generate _w400.webp / _w800.webp / _w1600.webp variants
//   5. Upload JPEG + variants at new `.jpg` storage paths
//   6. Update the media row (storage_path, file_url, content_type, focal_x,
//      focal_y, phash, quality_score)
//   7. Delete the orphaned HEIC original from storage
//
// The importer now handles HEIC inline at import time, so this script is
// only needed for content that landed in storage before the fix.
//
// Usage:
//   node --env-file=.env.local scripts/fix-heic-media.js \
//     --campaign <slug> [--dry-run]

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const sharp = require('sharp');
const smartcrop = require('smartcrop-sharp');
const { createClient } = require('@supabase/supabase-js');

const args = process.argv.slice(2);
const getArg = (f) => {
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const CAMPAIGN_SLUG = getArg('--campaign');
const DRY_RUN = args.includes('--dry-run');

if (!CAMPAIGN_SLUG) { console.error('Usage: --campaign <slug> [--dry-run]'); process.exit(1); }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const BUCKET = 'campaign-media';
const VARIANTS = [
  { suffix: 'w1600', width: 1600, quality: 82 },
  { suffix: 'w800',  width: 800,  quality: 80 },
  { suffix: 'w400',  width: 400,  quality: 78 },
];

function variantPath(storagePath, suffix) {
  return storagePath.replace(/\.[a-zA-Z0-9]+$/, `.${suffix}.webp`);
}
function newJpegPath(oldPath) {
  // Strip one or more trailing `.heic` / `.HEIC`, then add `.jpg`.
  return oldPath.replace(/(\.heic)+$/i, '') + '.jpg';
}

function transcodeHeicToJpeg(input, output, quality = 92) {
  return new Promise((resolve, reject) => {
    const proc = spawn('heif-convert', ['-q', String(quality), input, output], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => reject(new Error(`heif-convert spawn failed: ${e.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`heif-convert exit ${code}: ${stderr.trim().slice(0, 200)}`));
    });
  });
}

// Same algorithm as the importer's computeImageAttrs — duplicated here so
// this one-off doesn't drag in a shared module dependency.
async function computeImageAttrs(buf) {
  const meta = await sharp(buf, { failOn: 'none' }).metadata().catch(() => ({}));
  const w = meta.width || 0, h = meta.height || 0;
  const gray = await sharp(buf, { failOn: 'none' }).resize(64, 64, { fit: 'cover' }).grayscale().raw().toBuffer();
  let sum = 0, sumSq = 0;
  for (let i = 0; i < gray.length; i++) { sum += gray[i]; sumSq += gray[i] * gray[i]; }
  const mean = sum / gray.length;
  const stddev = Math.sqrt(Math.max(0, sumSq / gray.length - mean * mean));
  let edges = 0, edgeN = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 63; x++) { edges += Math.abs(gray[y*64+x] - gray[y*64+x+1]); edgeN++; }
  for (let y = 0; y < 63; y++) for (let x = 0; x < 64; x++) { edges += Math.abs(gray[y*64+x] - gray[(y+1)*64+x]); edgeN++; }
  const sharpness = edges / edgeN;
  const resScore = w * h > 0 ? Math.log2(w * h) : 0;
  const quality = sharpness * 1.0 + stddev * 0.5 + resScore * 0.2;
  const hashBuf = await sharp(buf, { failOn: 'none' }).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (hashBuf[y * 9 + x] > hashBuf[y * 9 + x + 1]) bits |= 1n << BigInt(y * 8 + x);
  }
  const phash = bits.toString(16).padStart(16, '0');
  let focalX = 0.5, focalY = 0.5;
  try {
    const target = Math.min(w || 800, h || 800, 800);
    const sc = await smartcrop.crop(buf, { width: target, height: target });
    if (sc.topCrop && w && h) {
      focalX = Math.max(0, Math.min(1, (sc.topCrop.x + sc.topCrop.width / 2) / w));
      focalY = Math.max(0, Math.min(1, (sc.topCrop.y + sc.topCrop.height / 2) / h));
    }
  } catch (_) {}
  return { width: w, height: h, phash, focalX, focalY, quality };
}

async function makeVariant(buf, width, quality) {
  return sharp(buf, { failOn: 'none' })
    .rotate()
    .resize(width, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

async function main() {
  const { data: camp } = await supabase
    .from('campaign_recaps').select('id, slug, name').eq('slug', CAMPAIGN_SLUG).maybeSingle();
  if (!camp) throw new Error('campaign not found');
  console.log(`\nHEIC backfill for ${camp.name} (${camp.slug})  ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);

  // Candidates: image rows whose storage_path ends in `.heic` (any case).
  // Phash being null is a sufficient secondary signal (the original import
  // failed to compute it), but we go by storage_path so we'd also catch HEIC
  // rows that somehow got a partial backfill earlier.
  const { data: rows, error } = await supabase
    .from('media')
    .select('id, type, storage_path, file_url, content_type')
    .eq('campaign_id', camp.id)
    .eq('type', 'image')
    .ilike('storage_path', '%.heic');
  if (error) throw error;
  console.log(`Broken HEIC rows: ${rows.length}\n`);
  if (!rows.length) return;

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-heic-fix-'));

  let ok = 0, err = 0;
  for (const m of rows) {
    const oldPath = m.storage_path;
    const newPath = newJpegPath(oldPath);
    console.log(`• ${oldPath}`);
    console.log(`  → ${newPath}`);
    if (DRY_RUN) continue;

    const localHeic = path.join(tmpRoot, path.basename(oldPath));
    const localJpeg = localHeic.replace(/(\.heic)+$/i, '') + '.jpg';
    try {
      // 1. Download HEIC bytes
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(oldPath);
      if (dlErr) throw new Error(`download: ${dlErr.message}`);
      fs.writeFileSync(localHeic, Buffer.from(await blob.arrayBuffer()));

      // 2. heif-convert → JPEG
      await transcodeHeicToJpeg(localHeic, localJpeg, 92);

      // 3. Compute attrs
      const jpegBuf = fs.readFileSync(localJpeg);
      const attrs = await computeImageAttrs(jpegBuf);

      // 4. Upload JPEG at new path
      const up = await supabase.storage.from(BUCKET).upload(newPath, jpegBuf, {
        contentType: 'image/jpeg', upsert: true,
      });
      if (up.error) throw new Error(`jpeg upload: ${up.error.message}`);

      // 5. Generate + upload variants
      for (const v of VARIANTS) {
        const body = await makeVariant(jpegBuf, v.width, v.quality);
        const vp = variantPath(newPath, v.suffix);
        const up2 = await supabase.storage.from(BUCKET).upload(vp, body, {
          contentType: 'image/webp', upsert: true,
        });
        if (up2.error) throw new Error(`variant ${v.suffix}: ${up2.error.message}`);
      }

      // 6. Update media row to point at the JPEG
      const newFileUrl = supabase.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;
      const { error: updErr } = await supabase
        .from('media')
        .update({
          storage_path: newPath,
          file_url: newFileUrl,
          content_type: 'image/jpeg',
          file_size_bytes: jpegBuf.length,
          resolution: attrs.width && attrs.height ? `${attrs.width}x${attrs.height}` : null,
          focal_x: attrs.focalX,
          focal_y: attrs.focalY,
          phash: attrs.phash,
          quality_score: attrs.quality,
        })
        .eq('id', m.id);
      if (updErr) throw new Error(`media update: ${updErr.message}`);

      // 7. Delete orphaned HEIC original
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
      if (rmErr) console.error(`  ! HEIC original delete failed (non-fatal): ${rmErr.message}`);

      console.log(`  ok  phash=${attrs.phash}  focal=(${attrs.focalX.toFixed(3)}, ${attrs.focalY.toFixed(3)})  quality=${attrs.quality.toFixed(2)}`);
      ok++;
    } catch (e) {
      console.error(`  ! ${e.message}`);
      err++;
    } finally {
      for (const p of [localHeic, localJpeg]) {
        if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (_) {} }
      }
    }
  }

  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  console.log(`\nDone. ok=${ok} err=${err}`);
}

main().catch(e => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
