#!/usr/bin/env node
// One-time: give every media row a REAL thumbnail.
//
// WHY. `thumbnail_url` is not a thumbnail on most rows — it is either null or
// byte-identical to `file_url`, so "serving the thumbnail" meant serving the
// original: a mean of 2.0MB and up to 7.4MB into a 240px tile. Measured on the
// Content page's first 40 tiles, that was 78.21MB a page. The portal has been
// routing every tile through the render endpoint to compensate, which fixes
// the bytes but puts a transform call on the critical path of every tile, for
// every viewer, forever.
//
// This generates the 600px rendition ONCE, stores it in the bucket, and writes
// the URL to `thumbnail_url`. After it runs, tiles read `thumbnail_url`
// directly and the transform endpoint is only a fallback for rows this job
// could not do.
//
// THE SOURCE IS THE RENDER ENDPOINT FIRST, sharp second. The endpoint already
// produces exactly the rendition the tiles were being served and it transcodes
// the `.HEIC` rows that no browser paints and that sharp cannot decode without
// libheif — so it is the primary path.
//
// It REFUSES very large originals, though: 16 of CVS's rows are 27-33MB and
// 45-50 megapixels, and the transform answers 400 on every one. Those get
// resized locally with sharp instead. That is also a live bug this job fixes —
// the portal routes tiles through the transform today, so those 16 have been
// rendering as broken images.
//
// VIDEO ROWS ARE RESIZED FROM THEIR POSTER, not from the video. An image
// transform cannot open an .mp4, but a video row that already has a poster
// carries it in thumbnail_url — and on this data those posters are stored at
// FULL SIZE: 103 of CVS's rows, averaging 3,957KB, the largest 22.12MB. They
// are the heaviest tiles on the Content page, so they are exactly what this
// job is for. A video row with no poster at all is skipped; it needs
// scripts/backfill-video-posters.js first.
//
// Usage:
//   node --env-file=.env.local scripts/generate-portal-thumbnails.js \
//     --brand <brand-id> [--dry-run] [--limit N] [--concurrency N]

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');

const args = process.argv.slice(2);
const getArg = (f, d = null) => {
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d;
};
const BRAND = getArg('--brand');
const DRY_RUN = args.includes('--dry-run');
const LIMIT = Number(getArg('--limit', '0')) || 0;
// 3, not 6: the transform endpoint 429s above that on this project.
const CONCURRENCY = Number(getArg('--concurrency', '3')) || 3;

if (!BRAND) {
  console.error('Usage: --brand <brand-id> [--dry-run] [--limit N] [--concurrency N]');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const BUCKET = 'campaign-media';
const OBJECT_MARKER = '/storage/v1/object/public/';
const RENDER_MARKER = '/storage/v1/render/image/public/';
const WIDTH = 600;
const QUALITY = 70;
const VIDEO = /\.(mp4|mov|m4v|webm|avi|mkv)($|\?)/i;

/** The transform URL for an object URL, or null if it is not a storage object. */
function renderUrl(url) {
  if (!url || !url.includes(OBJECT_MARKER)) return null;
  return (
    url.replace(OBJECT_MARKER, RENDER_MARKER) +
    (url.includes('?') ? '&' : '?') +
    `width=${WIDTH}&quality=${QUALITY}`
  );
}

async function main() {
  // SCOPE COMES FROM portal_campaigns — the same view the Content page reads.
  // The first cut filtered campaign_recaps with .neq('lifecycle_status',
  // 'draft') by hand, and the two did not agree: the job saw 411 media rows
  // where the page showed 522. Two hand-matched filters are two things to
  // keep in sync; reading the app's own view makes the scopes identical by
  // construction.
  const { data: campaigns, error: cErr } = await supabase
    .from('portal_campaigns')
    .select('id')
    .eq('brand_id', BRAND);
  if (cErr) throw cErr;
  const ids = (campaigns || []).map((c) => c.id);
  if (!ids.length) {
    console.log('No campaigns for that brand.');
    return;
  }

  // PostgREST caps a response at 1000 rows, so page through by created_at.
  const rows = [];
  const PAGE = 500;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await supabase
      .from('media')
      .select('id, campaign_id, type, file_url, thumbnail_url')
      .in('campaign_id', ids)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }

  const needs = [];
  let already = 0;
  let videoSkipped = 0;
  let noSource = 0;
  for (const m of rows) {
    const file = (m.file_url || '').trim();
    const thumb = (m.thumbnail_url || '').trim();
    // ONLY A THUMBNAIL THIS JOB MADE COUNTS AS DONE.
    //
    // The first cut skipped any thumbnail that merely DIFFERED from file_url,
    // and that was wrong: distinct is not small. Measured across CVS's 104
    // such rows, those "thumbnails" average 3,957KB and the largest is
    // 22.12MB — they are full-size images (video poster frames, mostly) that
    // happen to live at another path. Serving them directly was worse than
    // the transform call they replaced: the same 40-tile page went from
    // 9.69MB through the transform to 25.23MB reading thumbnail_url.
    //
    // A path under portal-thumbs/ is the one thing that proves a row has a
    // 600px rendition, so that is the test.
    if (thumb.includes('/portal-thumbs/')) { already++; continue; }
    // The source is the poster for a video row, the file itself otherwise.
    const isVideo = VIDEO.test(file);
    const source = isVideo ? thumb : file || thumb;
    if (!source) { noSource++; continue; }
    if (isVideo && (!thumb || VIDEO.test(thumb))) { videoSkipped++; continue; }
    if (!renderUrl(source)) { noSource++; continue; }
    needs.push({ ...m, source });
  }

  console.log(`media rows for brand: ${rows.length}`);
  console.log(`  already have a generated thumbnail: ${already}`);
  console.log(`  video with no poster (skipped):    ${videoSkipped}`);
  console.log(`  no usable source (skipped):        ${noSource}`);
  console.log(`  TO GENERATE:                       ${needs.length}`);

  const work = LIMIT ? needs.slice(0, LIMIT) : needs;
  if (DRY_RUN) {
    console.log(`\n--dry-run: nothing written. Would generate ${work.length}.`);
    return;
  }

  let done = 0, failed = 0, bytes = 0, localCount = 0;
  const failures = [];

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // The transform endpoint rate-limits, and a first run at concurrency 6 lost
  // 108 of 307 rows to 429s. Retry with exponential backoff and jitter: a 429
  // means "later", not "no".
  async function fetchThumb(src, attempt = 0) {
    const res = await fetch(src);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < 5) {
      const wait = 800 * 2 ** attempt + Math.floor(Math.random() * 400);
      await sleep(wait);
      return fetchThumb(src, attempt + 1);
    }
    throw new Error(`transform ${res.status}`);
  }

  // Fallback for originals the transform refuses: pull the file and resize it
  // here. limitInputPixels is raised because these ARE the huge ones — the
  // default 268MP guard is about untrusted input, and this is our own bucket.
  async function localThumb(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`source ${res.status}`);
    const original = Buffer.from(await res.arrayBuffer());
    return sharp(original, { limitInputPixels: 1_000_000_000 })
      .rotate()
      .resize({ width: WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();
  }

  async function processOne(m) {
    const src = renderUrl(m.source);
    try {
      let buf;
      let via = 'transform';
      try {
        buf = await fetchThumb(src);
      } catch (transformErr) {
        buf = await localThumb(m.source);
        via = 'sharp';
      }
      if (buf.length === 0) throw new Error('empty body');
      if (via === 'sharp') localCount++;

      // Keyed by media id: stable, collision-free, and it makes the mapping
      // back to the row obvious when someone is looking at the bucket.
      const path = `portal-thumbs/${m.id}.jpg`;
      const up = await supabase.storage.from(BUCKET).upload(path, buf, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000',
      });
      if (up.error) throw up.error;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: updErr } = await supabase
        .from('media')
        .update({ thumbnail_url: pub.publicUrl })
        .eq('id', m.id);
      if (updErr) throw updErr;

      bytes += buf.length;
      done++;
      if (done % 25 === 0) console.log(`  ${done}/${work.length}…`);
    } catch (err) {
      failed++;
      failures.push({ id: m.id, url: m.source, error: String(err.message || err) });
    }
  }

  // A small pool: the transform endpoint is a shared service and 400 parallel
  // requests is how you find its rate limit.
  const queue = [...work];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        await processOne(queue.shift());
        // A breath between requests. The endpoint is shared with the live
        // site's own image loads.
        await sleep(120);
      }
    })
  );

  console.log(`\ngenerated: ${done}  (${done - localCount} via transform, ${localCount} resized locally)`);
  console.log(`failed:    ${failed}`);
  console.log(`total size: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`mean size:  ${done ? Math.round(bytes / done / 1024) : 0} KB`);
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures.slice(0, 20)) console.log(`  ${f.id} ${f.error}`);
    if (failures.length > 20) console.log(`  …and ${failures.length - 20} more`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
