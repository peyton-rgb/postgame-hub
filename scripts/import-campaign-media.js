#!/usr/bin/env node
// Import campaign media from Google Drive into Supabase.
// See ~/Documents/Claude/Projects/POSTGAME HUB/CLAUDE-CODE_media-import-brief.md
//
// Usage:
//   node --env-file=.env.local scripts/import-campaign-media.js \
//     --campaign <slug> [--dry-run] [--athlete "Name"] [--limit N] [--manifest <path>] [--no-curate]
//
// Curation (on by default): per folder, perceptual-hash de-dups images and keeps the
// top N by quality (sharpness + contrast + resolution). Solo folders cap at 5, team
// folders cap at 8. Videos are never capped — all videos pass through.
//
// At upload time each image also gets:
//   - focal_x/focal_y (smartcrop saliency)
//   - phash (64-bit dHash)
//   - quality_score
//   - resized _w400.webp / _w800.webp / _w1600.webp variants
//   - cross-campaign drive_file_id collision guard (a Drive file appearing in
//     two campaigns of the same brand is almost always a misfiled folder)
//   - Hamming-18 de-dup against existing media in the same campaign
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//               GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const smartcrop = require('smartcrop-sharp');
const ffmpeg = require('fluent-ffmpeg');
const tus = require('tus-js-client');

// -------- args --------
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const CAMPAIGN_SLUG = getArg('--campaign');
const DRY_RUN = args.includes('--dry-run');
const CURATE = !args.includes('--no-curate');
const ATHLETE_FILTER = getArg('--athlete'); // optional, case-insensitive substring
const LIMIT_PER_ATHLETE = parseInt(getArg('--limit') || '0', 10) || null;
const MANIFEST_PATH =
  getArg('--manifest') ||
  '/Users/billjula/Documents/Claude/Projects/POSTGAME HUB/content_import_manifest.csv';

// Curation tuning — applies to images only; videos are never capped.
const CURATION = {
  soloCap: 5,        // per-athlete folder
  teamCap: 8,        // shared/team folder
  hashThreshold: 18, // bits of Hamming distance below which two images are considered near-duplicates (64-bit dHash)
  thumbSize: 400,    // Drive thumbnail size to fetch for scoring
  concurrency: 8,    // parallel image scoring requests
};

// Thumbnail variants written next to each original image (e.g.
// `<basename>.w800.webp`). The campaign page reads w400 for tile renders,
// w800 for medium views, w1600 for the full-bleed hero rotation.
const IMAGE_VARIANTS = [
  { suffix: 'w1600', width: 1600, quality: 82 },
  { suffix: 'w800',  width: 800,  quality: 80 },
  { suffix: 'w400',  width: 400,  quality: 78 },
];

if (!CAMPAIGN_SLUG) {
  console.error('Usage: --campaign <slug> [--dry-run] [--athlete "Name"] [--limit N] [--manifest <path>]');
  process.exit(1);
}

// -------- env --------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const G_CID = process.env.GOOGLE_CLIENT_ID;
const G_CSEC = process.env.GOOGLE_CLIENT_SECRET;
const G_REF = process.env.GOOGLE_REFRESH_TOKEN;
for (const [k, v] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SUPABASE_KEY,
  GOOGLE_CLIENT_ID: G_CID,
  GOOGLE_CLIENT_SECRET: G_CSEC,
  GOOGLE_REFRESH_TOKEN: G_REF,
})) {
  if (!v) {
    console.error(`Missing env: ${k}. Run with: node --env-file=.env.local ...`);
    process.exit(1);
  }
}

// -------- clients --------
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const oauth2 = new google.auth.OAuth2(G_CID, G_CSEC);
oauth2.setCredentials({ refresh_token: G_REF });
const drive = google.drive({ version: 'v3', auth: oauth2 });

const BUCKET = 'campaign-media';
// Supabase standard upload (POST) caps at ~50MB. Anything bigger has to go via
// the TUS resumable endpoint, which honors the bucket's full file_size_limit.
const RESUMABLE_THRESHOLD = 49 * 1024 * 1024;
const SKIP_EXT = new Set(['.cr2']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v', '.avi', '.mkv', '.webm', '.wmv', '.mpg', '.mpeg', '.mxf']);
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.tif', '.tiff', '.bmp']);
// HEIC/HEIF are Apple's iPhone-camera default. sharp's bundled libvips on
// macOS doesn't ship a libheif plugin, so we transcode to JPEG (libheif's
// heif-convert CLI) BEFORE sharp ever sees the file. That way every image
// downstream — variants, focal point, phash — works on a normal JPEG.
const HEIC_EXT = new Set(['.heic', '.heif']);

// -------- utils --------
const ACCENT_RE = /[̀-ͯ]/g;
const QUOTE_RE = /[‘’‚‛'ʼ]/g;
function slugify(s) {
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(ACCENT_RE, '')
    .toLowerCase()
    .replace(QUOTE_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function normName(s) {
  return (s || '').normalize('NFD').replace(ACCENT_RE, '').toLowerCase().replace(QUOTE_RE, '').replace(/\s+/g, ' ').trim();
}
function sanitizeFilename(s) {
  return s.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/_+/g, '_');
}
function ext(name) {
  const m = name && name.match(/\.[A-Za-z0-9]+$/);
  return m ? m[0].toLowerCase() : '';
}
function fileType(mimeType, name) {
  const e = ext(name);
  if (IMAGE_EXT.has(e)) return 'image';
  if (VIDEO_EXT.has(e)) return 'video';
  if ((mimeType || '').startsWith('image/')) return 'image';
  if ((mimeType || '').startsWith('video/')) return 'video';
  return null;
}
function folderIdFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/folders\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
function parseCsv(text) {
  // Minimal CSV parser that handles quoted fields with commas.
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* ignore */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).filter(r => r.some(x => x && x.length)).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
    return obj;
  });
}

// -------- Drive --------
async function listFolderRecursive(folderId, parentName = '') {
  const out = [];
  async function walk(fid, fname) {
    let pageToken = null;
    do {
      const r = await drive.files.list({
        q: `'${fid}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, mimeType, size, md5Checksum, thumbnailLink, imageMediaMetadata(width,height), videoMediaMetadata(width,height,durationMillis))',
        pageSize: 1000,
        pageToken,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'allDrives',
      });
      for (const f of r.data.files || []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          await walk(f.id, f.name);
        } else if (f.mimeType !== 'application/vnd.google-apps.shortcut') {
          out.push({ ...f, parentFolder: fname });
        }
      }
      pageToken = r.data.nextPageToken;
    } while (pageToken);
  }
  await walk(folderId, parentName || folderId);
  return out;
}

async function downloadDriveFile(fileId, destPath) {
  const dest = fs.createWriteStream(destPath);
  const res = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
  await new Promise((resolve, reject) => {
    res.data.on('end', resolve).on('error', reject).pipe(dest);
  });
}

// -------- ffmpeg helpers --------
function probe(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => err ? reject(err) : resolve(data));
  });
}
function transcodeToMp4(input, output) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-movflags +faststart', '-pix_fmt yuv420p', '-preset veryfast', '-crf 22'])
      .on('end', resolve).on('error', reject)
      .save(output);
  });
}
// HEIC → JPEG via libheif's heif-convert. Quality 92 is visually lossless
// vs the source. We resolve only on exit code 0 so a missing binary
// (heif-convert not in PATH) surfaces clearly. Falls back to surfacing the
// error so the file is skipped — never half-imports a HEIC.
function transcodeHeicToJpeg(input, output, quality = 92) {
  return new Promise((resolve, reject) => {
    const proc = spawn('heif-convert', ['-q', String(quality), input, output], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (e) => reject(new Error(`heif-convert spawn failed: ${e.message} (install via: brew install libheif)`)));
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`heif-convert exit ${code}: ${stderr.trim().slice(0, 200)}`));
    });
  });
}

function posterFrame(input, output, ts = '00:00:01') {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .seekInput(ts)
      .frames(1)
      .outputOptions(['-q:v 3'])
      .on('end', resolve).on('error', reject)
      .save(output);
  });
}

// -------- curation helpers (image-only, perceptual hash + quality) --------
async function fetchThumbnailBuffer(thumbnailLink) {
  if (!thumbnailLink) return null;
  // Bump Drive's default thumbnail size for better scoring fidelity.
  const url = thumbnailLink.replace(/=s\d+$/, `=s${CURATION.thumbSize}`);
  // OAuth token attached automatically via the Drive client's underlying transport.
  const headers = {};
  try {
    const t = await oauth2.getAccessToken();
    if (t?.token) headers['Authorization'] = `Bearer ${t.token}`;
  } catch (_) { /* try unauthenticated */ }
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function downloadDriveBuffer(fileId) {
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data);
}

async function scoreImage(file) {
  // Prefer the Drive thumbnail for speed; fall back to full file if needed.
  let buf = null;
  try { buf = await fetchThumbnailBuffer(file.thumbnailLink); } catch (_) {}
  if (!buf) {
    try { buf = await downloadDriveBuffer(file.id); } catch (e) {
      return { error: e.message };
    }
  }

  // Normalize to a 64×64 grayscale matrix for contrast + edge density.
  let gray;
  try {
    gray = await sharp(buf, { failOn: 'none' })
      .resize(64, 64, { fit: 'cover' })
      .grayscale()
      .raw()
      .toBuffer();
  } catch (e) {
    return { error: `sharp failed: ${e.message}` };
  }

  let sum = 0, sumSq = 0;
  for (let i = 0; i < gray.length; i++) { sum += gray[i]; sumSq += gray[i] * gray[i]; }
  const mean = sum / gray.length;
  const variance = sumSq / gray.length - mean * mean;
  const stddev = Math.sqrt(Math.max(0, variance)); // contrast proxy

  let edgeSum = 0, edgeN = 0;
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 63; x++) {
      edgeSum += Math.abs(gray[y * 64 + x] - gray[y * 64 + x + 1]);
      edgeN++;
    }
  }
  for (let y = 0; y < 63; y++) {
    for (let x = 0; x < 64; x++) {
      edgeSum += Math.abs(gray[y * 64 + x] - gray[(y + 1) * 64 + x]);
      edgeN++;
    }
  }
  const sharpness = edgeSum / edgeN; // edge-density proxy

  // 64-bit dHash on a 9×8 grid.
  let hashBuf;
  try {
    hashBuf = await sharp(buf, { failOn: 'none' })
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();
  } catch (e) {
    return { error: `dHash failed: ${e.message}` };
  }
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (hashBuf[y * 9 + x] > hashBuf[y * 9 + x + 1]) {
        hash |= 1n << BigInt(y * 8 + x);
      }
    }
  }

  const w = file.imageMediaMetadata?.width || 0;
  const h = file.imageMediaMetadata?.height || 0;
  const resScore = w * h > 0 ? Math.log2(w * h) : 0;

  // Quality is a weighted blend; sharpness dominates because blurry shots are the
  // primary failure mode in this dataset. Tweakable via constants if needed.
  const quality = sharpness * 1.0 + stddev * 0.5 + resScore * 0.2;
  return { hash, quality, sharpness, stddev, resScore, width: w, height: h };
}

function hamming(a, b) {
  let x = a ^ b;
  let d = 0;
  while (x !== 0n) {
    if (x & 1n) d++;
    x >>= 1n;
  }
  return d;
}

function curateImages(scored, cap, threshold) {
  // Greedy: walk by quality desc, keep an image only if it's > threshold bits away
  // from every already-kept hash. Stop at cap. Track reason for culling.
  const sorted = [...scored].sort((a, b) => b.quality - a.quality);
  const kept = [];
  const culled = [];
  for (const img of sorted) {
    if (kept.length >= cap) { culled.push({ ...img, reason: 'over_cap' }); continue; }
    let dupOf = null;
    for (const k of kept) {
      if (hamming(img.hash, k.hash) <= threshold) { dupOf = k.driveId; break; }
    }
    if (dupOf) culled.push({ ...img, reason: 'near_dup', dupOf });
    else kept.push(img);
  }
  return { kept, culled };
}

async function uploadResumable({ bucket, objectPath, filePath, contentType }) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const fileSize = fs.statSync(filePath).size;
    const upload = new tus.Upload(fileStream, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${SUPABASE_KEY}`,
        'x-upsert': 'true',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: objectPath,
        contentType,
        cacheControl: '3600',
      },
      // Supabase requires 6MB chunks (last chunk can be smaller).
      chunkSize: 6 * 1024 * 1024,
      uploadSize: fileSize,
      onError: (err) => reject(err),
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

async function uploadToStorage({ objectPath, filePath, contentType }) {
  const size = fs.statSync(filePath).size;
  if (size > RESUMABLE_THRESHOLD) {
    await uploadResumable({ bucket: BUCKET, objectPath, filePath, contentType });
    return;
  }
  const buf = fs.readFileSync(filePath);
  const r = await supabase.storage.from(BUCKET).upload(objectPath, buf, { contentType, upsert: true });
  if (r.error) throw new Error(`storage upload failed: ${r.error.message}`);
}

async function mapConcurrent(items, fn, concurrency = 8) {
  const out = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      try { out[i] = await fn(items[i], i); }
      catch (e) { out[i] = { error: e.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

// -------- image attribute computation (focal point + phash + quality) --------
function variantPath(originalStoragePath, suffix) {
  return originalStoragePath.replace(/\.[a-zA-Z0-9]+$/, `.${suffix}.webp`);
}

async function computeImageAttrs(buf) {
  let meta = {};
  try { meta = await sharp(buf, { failOn: 'none' }).metadata(); } catch (_) {}
  const w = meta.width || 0;
  const h = meta.height || 0;

  // 64x64 grayscale → contrast (stddev) + edge density (sharpness proxy)
  let gray;
  try {
    gray = await sharp(buf, { failOn: 'none' }).resize(64, 64, { fit: 'cover' }).grayscale().raw().toBuffer();
  } catch (_) {
    return { width: w, height: h, phash: null, focalX: 0.5, focalY: 0.5, quality: 0 };
  }
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

  // 64-bit dHash, returned as 16-char hex
  let hashBuf;
  try {
    hashBuf = await sharp(buf, { failOn: 'none' }).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
  } catch (_) {
    return { width: w, height: h, phash: null, focalX: 0.5, focalY: 0.5, quality };
  }
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (hashBuf[y * 9 + x] > hashBuf[y * 9 + x + 1]) bits |= 1n << BigInt(y * 8 + x);
  }
  const phash = bits.toString(16).padStart(16, '0');

  // Saliency-based focal point via smartcrop (skin-tone + saturation weighted).
  let focalX = 0.5, focalY = 0.5;
  try {
    const target = Math.min(w || 800, h || 800, 800);
    const sc = await smartcrop.crop(buf, { width: target, height: target });
    if (sc.topCrop && w && h) {
      focalX = Math.max(0, Math.min(1, (sc.topCrop.x + sc.topCrop.width / 2) / w));
      focalY = Math.max(0, Math.min(1, (sc.topCrop.y + sc.topCrop.height / 2) / h));
    }
  } catch (_) { /* leave center */ }

  return { width: w, height: h, phash, focalX, focalY, quality };
}

async function makeImageVariant(buf, width, quality) {
  return sharp(buf, { failOn: 'none' })
    .rotate() // honor EXIF orientation
    .resize(width, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

function hammingHex(aHex, bHex) {
  if (!aHex || !bHex) return 64;
  let x = BigInt('0x' + aHex) ^ BigInt('0x' + bHex);
  let d = 0;
  while (x !== 0n) { if (x & 1n) d++; x >>= 1n; }
  return d;
}

// -------- main --------
async function main() {
  const startedAt = new Date();
  const runId = `${CAMPAIGN_SLUG}-${startedAt.toISOString().replace(/[:.]/g, '-')}`;
  console.log(`\nImport run ${runId}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);

  // 1. Load + filter manifest
  const csv = fs.readFileSync(MANIFEST_PATH, 'utf8');
  const allRows = parseCsv(csv);
  const rows = allRows.filter(r => {
    // We match by slug indirectly: rows store brand+campaign labels.
    // We rely on Supabase having a unique recap for the given slug, then group by drive folder.
    return true; // initial filter is done after we know the campaign
  });

  // 2. Resolve campaign (also grab brand_id so we can run the brand-scoped
  //    collision guard against the same brand's other campaigns).
  const { data: camp, error: campErr } = await supabase
    .from('campaign_recaps')
    .select('id, slug, name, client_name, published, public_sections, brand_id')
    .eq('slug', CAMPAIGN_SLUG)
    .maybeSingle();
  if (campErr) throw new Error(`campaign_recaps lookup failed: ${campErr.message}`);
  if (!camp) throw new Error(`No campaign_recap with slug ${CAMPAIGN_SLUG}`);
  console.log(`Campaign: ${camp.name} (${camp.client_name}) — id=${camp.id} published=${camp.published} brand_id=${camp.brand_id || '(none)'}`);

  // 3. Athletes for this campaign
  const { data: athletes, error: aErr } = await supabase
    .from('athletes')
    .select('id, name, ig_handle')
    .eq('campaign_id', camp.id);
  if (aErr) throw new Error(`athletes lookup failed: ${aErr.message}`);
  const nameToAthlete = new Map();
  for (const a of athletes) nameToAthlete.set(normName(a.name), a);
  console.log(`Roster: ${athletes.length} athletes loaded for this campaign`);

  // 4. Pick manifest rows that belong to this campaign by matching athlete names.
  //    We don't have a slug column in the manifest, so we filter rows whose `athlete`
  //    matches a roster name AND collect those rows. Brand/campaign columns are
  //    informational only.
  const matched = [];
  const unmatched = [];
  for (const r of rows) {
    const folderId = folderIdFromUrl(r.drive_content_folder_url);
    if (!folderId) continue;
    const a = nameToAthlete.get(normName(r.athlete));
    if (a) {
      matched.push({ ...r, folderId, athleteId: a.id, athleteName: a.name });
    } else {
      // Maybe useful diagnostically — but only if their brand/campaign text overlaps
      unmatched.push(r);
    }
  }
  // Filter unmatched to rows whose brand/campaign text references our campaign — so we
  // surface only relevant mismatches (UPPERCASE vs Mixed Case etc. inside the same campaign).
  const campKeyparts = [camp.client_name, camp.name].map(s => (s || '').toLowerCase());
  const relevantUnmatched = unmatched.filter(r => {
    const blob = `${r.brand} ${r.campaign}`.toLowerCase();
    return campKeyparts.some(k => k && blob.includes(k.split(/[^a-z0-9]+/)[0]));
  });

  if (!matched.length) {
    console.error('\nNo manifest rows matched the roster for this campaign. Nothing to do.');
    console.error('Hint: athlete names in manifest may not match the loaded roster. Sample unmatched (first 5):');
    for (const r of rows.slice(0, 5)) console.error(`  - ${r.brand} | ${r.campaign} | ${r.athlete}`);
    process.exit(1);
  }

  // 5. Group by folderId (handles team folders shared across N athletes).
  const groups = new Map(); // folderId -> { folderId, athletes: [{athleteId, athleteName, manifestName}], rows: [] }
  for (const m of matched) {
    if (!groups.has(m.folderId)) {
      groups.set(m.folderId, { folderId: m.folderId, athletes: [], rows: [] });
    }
    const g = groups.get(m.folderId);
    if (!g.athletes.some(x => x.athleteId === m.athleteId)) {
      g.athletes.push({ athleteId: m.athleteId, athleteName: m.athleteName, manifestName: m.athlete });
    }
    g.rows.push(m);
  }

  // Optional --athlete filter
  let groupList = [...groups.values()];
  if (ATHLETE_FILTER) {
    const needle = ATHLETE_FILTER.toLowerCase();
    groupList = groupList.filter(g => g.athletes.some(a => a.athleteName.toLowerCase().includes(needle)));
  }

  console.log(`\nMatched ${matched.length} manifest rows in ${groupList.length} Drive folders (${groupList.filter(g=>g.athletes.length>1).length} team folders, ${groupList.filter(g=>g.athletes.length===1).length} per-athlete).`);
  if (relevantUnmatched.length) {
    console.log(`\nUnmatched manifest rows for this campaign (review needed): ${relevantUnmatched.length}`);
    for (const r of relevantUnmatched) console.log(`  ! ${r.athlete}  ig=${r.ig_handle || '-'}  ${r.drive_content_folder_url}`);
  }

  // 6. Pre-load existing media for two pieces of state:
  //    (a) drive_file_id → campaign-scoped dedup (we've already imported this Drive file)
  //    (b) phash → in-campaign Hamming-18 near-dup check at curation time
  const { data: existingMedia, error: emErr } = await supabase
    .from('media')
    .select('id, drive_file_id, phash, type')
    .eq('campaign_id', camp.id)
    .not('drive_file_id', 'is', null);
  if (emErr) throw new Error(`existing media lookup failed: ${emErr.message}`);
  const existingByDriveId = new Map(existingMedia.map(m => [m.drive_file_id, m.id]));
  const existingPhashes = existingMedia
    .filter(m => m.type === 'image' && m.phash)
    .map(m => ({ id: m.id, phash: m.phash }));
  console.log(`Existing media for this campaign: ${existingMedia.length} rows  (${existingPhashes.length} with phash)`);

  // 6b. Brand-scoped collision guard. Build a set of drive_file_ids that exist
  //     under OTHER campaigns of the same brand. A Drive file landing in two
  //     campaigns of one brand is almost always a misfiled folder, so we'll
  //     refuse to re-import it and log the colliding campaign for review.
  const brandCollisionCampaign = new Map(); // drive_file_id -> { campaign_slug, campaign_id }
  if (camp.brand_id) {
    const { data: brandSiblings, error: bsErr } = await supabase
      .from('campaign_recaps')
      .select('id, slug')
      .eq('brand_id', camp.brand_id)
      .neq('id', camp.id);
    if (bsErr) throw new Error(`brand sibling lookup failed: ${bsErr.message}`);
    const siblingIds = (brandSiblings || []).map(c => c.id);
    const slugById = new Map((brandSiblings || []).map(c => [c.id, c.slug]));
    if (siblingIds.length) {
      const { data: crossMedia, error: cmErr } = await supabase
        .from('media')
        .select('drive_file_id, campaign_id')
        .in('campaign_id', siblingIds)
        .not('drive_file_id', 'is', null);
      if (cmErr) throw new Error(`brand cross-media lookup failed: ${cmErr.message}`);
      for (const m of crossMedia || []) {
        brandCollisionCampaign.set(m.drive_file_id, {
          campaign_slug: slugById.get(m.campaign_id) || '?',
          campaign_id: m.campaign_id,
        });
      }
      console.log(`Brand-scope collision index: ${brandCollisionCampaign.size} drive_file_id(s) seen in ${siblingIds.length} sibling campaign(s) of this brand`);
    }
  }

  // 7. Track display_order across the run.
  const { data: dispRows } = await supabase
    .from('media_campaigns')
    .select('display_order')
    .eq('campaign_recap_id', camp.id)
    .order('display_order', { ascending: false })
    .limit(1);
  let nextDisplayOrder = (dispRows && dispRows[0]?.display_order != null ? dispRows[0].display_order : -1) + 1;

  // 8. Walk each folder.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-import-'));
  const log = { runId, campaign: { id: camp.id, slug: camp.slug }, mode: DRY_RUN ? 'dry' : 'live', startedAt, groups: [] };

  let totalListed = 0, totalSkippedCr2 = 0, totalSkippedDup = 0, totalUploaded = 0, totalErrors = 0;
  let totalSkippedCurated = 0, totalScored = 0, totalSkippedCollision = 0, totalVariantsUploaded = 0;

  for (const g of groupList) {
    const isTeam = g.athletes.length > 1;
    const folderLabel = isTeam
      ? `team_${slugify(g.athletes.map(a => a.athleteName).slice(0, 2).join('-'))}_${g.folderId.slice(0,6)}`
      : slugify(g.athletes[0].athleteName);
    const groupLog = { folderId: g.folderId, isTeam, folderLabel, athletes: g.athletes.map(a => a.athleteName), files: [] };
    console.log(`\n— Folder ${g.folderId}  [${isTeam ? 'TEAM' : 'SOLO'}: ${g.athletes.map(a => a.athleteName).join(', ')}]`);

    let files;
    try {
      files = await listFolderRecursive(g.folderId, folderLabel);
    } catch (e) {
      console.error(`  ! drive list failed: ${e.message}`);
      groupLog.error = e.message;
      log.groups.push(groupLog);
      totalErrors++;
      continue;
    }
    totalListed += files.length;
    console.log(`  ${files.length} files in folder`);

    if (LIMIT_PER_ATHLETE) files = files.slice(0, LIMIT_PER_ATHLETE);

    // ---- Curation pre-pass (image-only). Marks images to drop with `curatedDrop`. ----
    // Cap is per-folder and durable across retries: count images already imported from
    // this folder (drive_file_ids matching the folder's known files) and treat them as
    // used slots, so a re-run can never push us above the cap.
    const curatedDrop = new Map(); // driveId -> { reason, dupOf?, score? }
    if (CURATE) {
      const cap = isTeam ? CURATION.teamCap : CURATION.soloCap;
      const allFolderImages = files.filter(f => {
        const e2 = ext(f.name);
        if (SKIP_EXT.has(e2)) return false;
        return fileType(f.mimeType, f.name) === 'image';
      });
      const alreadyImported = allFolderImages.filter(f => existingByDriveId.has(f.id)).length;
      const eligibleImages = allFolderImages.filter(f => !existingByDriveId.has(f.id));
      const remaining = Math.max(0, cap - alreadyImported);

      if (alreadyImported > 0) {
        console.log(`  Folder cap state: ${alreadyImported}/${cap} already imported, ${remaining} slot(s) left, ${eligibleImages.length} eligible new image(s)`);
      }

      if (remaining === 0 && eligibleImages.length > 0) {
        for (const im of eligibleImages) curatedDrop.set(im.id, { reason: 'over_cap_existing' });
        console.log(`  Cap already saturated → dropping all ${eligibleImages.length} new image(s)`);
      } else if (eligibleImages.length > remaining) {
        console.log(`  Scoring ${eligibleImages.length} new images (effective cap=${remaining}, hamming=${CURATION.hashThreshold} bits)...`);
        const scored = await mapConcurrent(eligibleImages, async (f) => {
          const r = await scoreImage(f);
          return { driveId: f.id, name: f.name, ...r };
        }, CURATION.concurrency);
        totalScored += scored.length;
        let valid = scored.filter(s => s.hash !== undefined);
        const unscoreable = scored.filter(s => s.hash === undefined);
        if (unscoreable.length) {
          console.log(`  ! ${unscoreable.length} images could not be scored — keeping them by default`);
        }
        // Hamming-18 dedup against the campaign's already-imported phashes
        // (catches near-duplicates of shots we already have on file).
        if (existingPhashes.length) {
          const phashHex = (bi) => bi.toString(16).padStart(16, '0');
          let droppedVsExisting = 0;
          valid = valid.filter(s => {
            const candidateHex = phashHex(s.hash);
            const near = existingPhashes.find(e => hammingHex(candidateHex, e.phash) <= CURATION.hashThreshold);
            if (near) {
              curatedDrop.set(s.driveId, { reason: 'near_dup_existing', dupOf: near.id });
              droppedVsExisting++;
              return false;
            }
            return true;
          });
          if (droppedVsExisting) console.log(`  Existing-phash dedup: dropped ${droppedVsExisting} new image(s) within ${CURATION.hashThreshold} bits of an already-imported shot`);
        }
        const { kept, culled } = curateImages(valid, remaining, CURATION.hashThreshold);
        for (const c of culled) curatedDrop.set(c.driveId, { reason: c.reason, dupOf: c.dupOf, quality: c.quality });
        console.log(`  Curated: kept ${kept.length} of ${valid.length} (${culled.filter(c=>c.reason==='near_dup').length} near-dup, ${culled.filter(c=>c.reason==='over_cap').length} over cap)`);
      } else if (eligibleImages.length > 0) {
        console.log(`  Curation skipped: ${eligibleImages.length} eligible image(s) ≤ remaining cap ${remaining}`);
      }
    }

    for (const f of files) {
      const e = ext(f.name);
      const type = fileType(f.mimeType, f.name);
      const fileLog = { driveId: f.id, name: f.name, mime: f.mimeType, size: f.size, type, action: null };

      if (SKIP_EXT.has(e)) {
        console.log(`  - SKIP cr2: ${f.name}`);
        fileLog.action = 'skip_cr2';
        totalSkippedCr2++;
        groupLog.files.push(fileLog);
        continue;
      }
      if (!type) {
        console.log(`  - SKIP non-media (${f.mimeType}): ${f.name}`);
        fileLog.action = 'skip_non_media';
        groupLog.files.push(fileLog);
        continue;
      }
      if (existingByDriveId.has(f.id)) {
        console.log(`  - DUP (already imported): ${f.name}`);
        fileLog.action = 'skip_dup';
        fileLog.existingMediaId = existingByDriveId.get(f.id);
        totalSkippedDup++;
        groupLog.files.push(fileLog);
        continue;
      }
      if (brandCollisionCampaign.has(f.id)) {
        const collide = brandCollisionCampaign.get(f.id);
        console.log(`  ! BRAND COLLISION: ${f.name} (drive_file_id already in campaign "${collide.campaign_slug}" — likely misfiled). Skipping.`);
        fileLog.action = 'skip_brand_collision';
        fileLog.collidesWith = collide;
        totalSkippedCollision++;
        groupLog.files.push(fileLog);
        continue;
      }
      if (curatedDrop.has(f.id)) {
        const c = curatedDrop.get(f.id);
        console.log(`  - SKIP curated (${c.reason}): ${f.name}`);
        fileLog.action = `skip_curated_${c.reason}`;
        fileLog.curated = c;
        totalSkippedCurated++;
        groupLog.files.push(fileLog);
        continue;
      }

      // Plan storage paths (deterministic on drive id).
      // - HEIC images will be transcoded to JPEG before sharp ever sees them,
      //   so the planned storage_path ends in `.jpg` from the start (and the
      //   dry-run preview shows the correct final path).
      // - File-extension stripping is case-insensitive — iPhone exports are
      //   typically ".HEIC" while our SKIP/IMAGE sets use lowercase.
      const isHeic = type === 'image' && HEIC_EXT.has(e);
      const idPrefix = f.id.slice(0, 12);
      const baseNoExt = sanitizeFilename(f.name.replace(/\.[A-Za-z0-9]+$/, ''));
      let storedExt = isHeic ? '.jpg' : (e || '');
      let storagePath = `${camp.slug}/${folderLabel}/${idPrefix}-${baseNoExt}${storedExt}`;
      let posterStoragePath = null;
      let willTranscode = false;
      if (type === 'video' && e !== '.mp4') {
        willTranscode = true;
        storagePath = `${camp.slug}/${folderLabel}/${idPrefix}-${baseNoExt}.mp4`;
      }
      if (type === 'video') {
        posterStoragePath = `${camp.slug}/${folderLabel}/posters/${idPrefix}-${baseNoExt}.jpg`;
      }

      fileLog.storagePath = storagePath;
      fileLog.posterStoragePath = posterStoragePath;
      fileLog.willTranscode = willTranscode;
      fileLog.isHeic = isHeic;

      if (DRY_RUN) {
        const tag = isHeic ? 'image(heic→jpg)' : (willTranscode ? 'video(transcode)' : type);
        console.log(`  + PLAN ${tag}: ${f.name}  →  ${storagePath}`);
        fileLog.action = 'dry_plan';
        groupLog.files.push(fileLog);
        continue;
      }

      // Live: download → (HEIC transcode? / video transcode + poster) → upload
      // After download localOrig points at the HEIC bytes; after the HEIC
      // transcode step it's reassigned to the JPEG. Everything downstream
      // (sharp variants, focal point, phash) reads from localOrig.
      let localOrig = path.join(tmpRoot, `${idPrefix}-${baseNoExt}${e || ''}`);
      const localUpload = willTranscode
        ? path.join(tmpRoot, `${idPrefix}-${baseNoExt}.mp4`)
        : null;
      const localPoster = type === 'video'
        ? path.join(tmpRoot, `${idPrefix}-${baseNoExt}.jpg`)
        : null;

      try {
        await downloadDriveFile(f.id, localOrig);

        if (isHeic) {
          const jpegPath = path.join(tmpRoot, `${idPrefix}-${baseNoExt}.jpg`);
          await transcodeHeicToJpeg(localOrig, jpegPath, 92);
          try { fs.unlinkSync(localOrig); } catch (_) {}
          localOrig = jpegPath; // every downstream step now reads JPEG bytes
        }

        let width = null, height = null;
        if (type === 'image') {
          try {
            const meta = await sharp(localOrig).metadata();
            width = meta.width || null; height = meta.height || null;
          } catch (_) { /* extremely rare on JPEG; ignore */ }
        }

        if (willTranscode) await transcodeToMp4(localOrig, localUpload);

        if (type === 'video') {
          try {
            await posterFrame(localUpload, localPoster, '00:00:01');
          } catch (_) {
            // try 0.5s if 1s fails on short clips
            try { await posterFrame(localUpload, localPoster, '00:00:00.5'); } catch (_) { /* give up */ }
          }
          try {
            const probed = await probe(localUpload);
            const v = (probed.streams || []).find(s => s.codec_type === 'video');
            if (v) { width = v.width || null; height = v.height || null; }
          } catch (_) {}
        }

        // Upload main asset (auto-switches to TUS for files > RESUMABLE_THRESHOLD)
        // For images localUpload is the localOrig file (possibly a transcoded
        // JPEG if the source was HEIC); for videos it's the transcoded mp4.
        const uploadSource = willTranscode ? localUpload : localOrig;
        const uploadContentType = willTranscode
          ? 'video/mp4'
          : (isHeic ? 'image/jpeg' : (f.mimeType || 'application/octet-stream'));
        await uploadToStorage({ objectPath: storagePath, filePath: uploadSource, contentType: uploadContentType });

        let thumbnailUrl = null;
        if (localPoster && fs.existsSync(localPoster)) {
          // Posters are always tiny — keep the simple POST path.
          await uploadToStorage({ objectPath: posterStoragePath, filePath: localPoster, contentType: 'image/jpeg' });
          thumbnailUrl = supabase.storage.from(BUCKET).getPublicUrl(posterStoragePath).data.publicUrl;
        }

        // For images, compute focal point / phash / quality from the downloaded
        // bytes and generate the w400/w800/w1600 thumbnail variants alongside
        // the original. (Videos use their poster for tile rendering and don't
        // need focal/phash here.)
        let focalX = null, focalY = null, phashHex = null, qualityScore = null;
        if (type === 'image') {
          try {
            const imgBuf = fs.readFileSync(localOrig);
            const attrs = await computeImageAttrs(imgBuf);
            focalX = attrs.focalX;
            focalY = attrs.focalY;
            phashHex = attrs.phash;
            qualityScore = attrs.quality;
            if (!width || !height) { width = attrs.width || width; height = attrs.height || height; }
            for (const v of IMAGE_VARIANTS) {
              const body = await makeImageVariant(imgBuf, v.width, v.quality);
              const vp = variantPath(storagePath, v.suffix);
              const up = await supabase.storage.from(BUCKET).upload(vp, body, {
                contentType: 'image/webp', upsert: true,
              });
              if (up.error) throw new Error(`variant ${v.suffix} upload failed: ${up.error.message}`);
              totalVariantsUploaded++;
            }
          } catch (e) {
            console.error(`  ! image attrs/variants failed for ${f.name}: ${e.message}`);
            // Don't abort the row — original is uploaded; page can still render via the original URL.
          }
        }

        const fileUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
        const resolution = (width && height) ? `${width}x${height}` : null;
        const uploadedSize = fs.statSync(uploadSource).size;

        // Insert media row. For team folders athlete_id stays null; per-athlete sets it.
        const mediaInsert = {
          athlete_id: isTeam ? null : g.athletes[0].athleteId,
          campaign_id: camp.id,
          type,
          file_url: fileUrl,
          thumbnail_url: thumbnailUrl,
          drive_file_id: f.id,
          storage_path: storagePath,
          storage_bucket: BUCKET,
          source_system: 'drive',
          source_id: f.id,
          file_size_bytes: uploadedSize,
          content_type: uploadContentType,
          resolution,
          is_video_thumbnail: false,
          focal_x: focalX,
          focal_y: focalY,
          phash: phashHex,
          quality_score: qualityScore,
        };
        const { data: mRow, error: mErr } = await supabase.from('media').insert(mediaInsert).select('id').single();
        if (mErr) throw new Error(`media insert failed: ${mErr.message}`);

        const mcInsert = {
          media_id: mRow.id,
          campaign_recap_id: camp.id,
          section: 'gallery',
          display_order: nextDisplayOrder++,
        };
        const { error: mcErr } = await supabase
          .from('media_campaigns')
          .upsert(mcInsert, { onConflict: 'media_id,campaign_recap_id' });
        if (mcErr) throw new Error(`media_campaigns insert failed: ${mcErr.message}`);

        // Fan out media_athletes to every athlete on the folder
        const maRows = g.athletes.map(a => ({ media_id: mRow.id, athlete_id: a.athleteId }));
        const { error: maErr } = await supabase
          .from('media_athletes')
          .upsert(maRows, { onConflict: 'media_id,athlete_id' });
        if (maErr) throw new Error(`media_athletes insert failed: ${maErr.message}`);

        fileLog.action = 'uploaded';
        fileLog.mediaId = mRow.id;
        fileLog.fileUrl = fileUrl;
        fileLog.thumbnailUrl = thumbnailUrl;
        existingByDriveId.set(f.id, mRow.id);
        // Track this run's new phashes so later folders in the same run can
        // dedup against them (e.g. an athlete in both a solo and a team
        // folder shouldn't end up with two near-identical hero shots).
        if (type === 'image' && phashHex) existingPhashes.push({ id: mRow.id, phash: phashHex });
        totalUploaded++;
        console.log(`  + OK ${type}${willTranscode ? '(transcoded)' : ''}: ${f.name}  →  ${storagePath}`);
      } catch (e) {
        fileLog.action = 'error';
        fileLog.error = e.message;
        totalErrors++;
        console.error(`  ! ERR ${f.name}: ${e.message}`);
      } finally {
        for (const p of [localOrig, localUpload, localPoster]) {
          if (p && fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (_) {} }
        }
      }
      groupLog.files.push(fileLog);
    }
    log.groups.push(groupLog);
  }

  // 9. Bump show_media flag
  if (!DRY_RUN && totalUploaded > 0) {
    const current = camp.public_sections || {};
    if (!current.show_media) {
      const { error } = await supabase
        .from('campaign_recaps')
        .update({ public_sections: { ...current, show_media: true } })
        .eq('id', camp.id);
      if (error) console.error(`! failed to set show_media: ${error.message}`);
      else console.log('\nSet public_sections.show_media = true');
    }
  }

  // 10. Cleanup tmp + write run log
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  const logDir = path.join(__dirname, '.import-runs');
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `${runId}.json`);
  log.summary = {
    totalListed, totalSkippedCr2, totalSkippedDup, totalSkippedCurated,
    totalSkippedCollision, totalScored, totalUploaded, totalVariantsUploaded,
    totalErrors, curate: CURATE, hashThreshold: CURATION.hashThreshold,
  };
  log.finishedAt = new Date();
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  console.log(`\n— Summary —`);
  console.log(`  listed:                ${totalListed}`);
  console.log(`  skip_cr2:              ${totalSkippedCr2}`);
  console.log(`  skip_dup:              ${totalSkippedDup}`);
  console.log(`  skip_brand_collision:  ${totalSkippedCollision}`);
  if (CURATE) {
    console.log(`  scored:                ${totalScored}`);
    console.log(`  skip_curated:          ${totalSkippedCurated}`);
    console.log(`  hashThreshold:         ${CURATION.hashThreshold} bits`);
  }
  console.log(`  ${DRY_RUN ? 'planned' : 'uploaded'}:               ${DRY_RUN ? '(see above)' : totalUploaded}`);
  if (!DRY_RUN) console.log(`  variants uploaded:     ${totalVariantsUploaded}`);
  console.log(`  errors:                ${totalErrors}`);
  console.log(`Log: ${logPath}`);
  console.log(`Campaign published flag (unchanged): ${camp.published}`);
}

main().catch(e => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
