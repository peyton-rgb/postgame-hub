#!/usr/bin/env node
// Backfill thumbnail_url (a poster frame) for VIDEO media rows that don't have one.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-video-posters.js \
//     [--campaign <slug-or-id>] [--dry-run] [--limit N]
//
//   Omit --campaign to backfill EVERY campaign in one run.
//
// Selects media where type = 'video', thumbnail_url IS NULL, and
// is_video_thumbnail is not true — scoped to one campaign when --campaign is
// given, or across all campaigns when it is omitted. For each: downloads the video from storage, extracts a
// frame at ~1s (0.5s fallback for very short clips) with ffmpeg, uploads the JPG
// to a posters/ path alongside the video, and sets thumbnail_url on the row.
//
// Idempotent: the "thumbnail_url IS NULL" filter means a re-run only touches
// videos still missing a poster. --dry-run lists what it would do, writing
// nothing (no download, no ffmpeg, no upload, no DB update).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');
const ffmpeg = require('fluent-ffmpeg');

// -------- args --------
const args = process.argv.slice(2);
const getArg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};
const CAMPAIGN = getArg('--campaign'); // optional — omit to backfill all campaigns
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(getArg('--limit') || '0', 10) || null;

// -------- env --------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Run with --env-file=.env.local (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const BUCKET = 'campaign-media';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// -------- ffmpeg poster (same approach as import-campaign-media.js) --------
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

// -------- storage helpers --------
// Resolve the object path within BUCKET for a media row. Prefer the stored
// storage_path; otherwise parse it out of the public file_url (event imports
// set file_url but may leave storage_path null).
function objectPathFor(m) {
  if (m.storage_path) return m.storage_path;
  const marker = `/object/public/${BUCKET}/`;
  const i = (m.file_url || '').indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(m.file_url.slice(i + marker.length).split('?')[0]);
}

// posters/ path alongside the video: "<dir>/posters/<base>.jpg"
function posterPathFor(objectPath) {
  const dir = path.posix.dirname(objectPath);
  const base = path.posix.basename(objectPath).replace(/\.[^.]+$/, '');
  return path.posix.join(dir, 'posters', `${base}.jpg`);
}

// -------- main --------
async function main() {
  // Resolve campaign by id (if it looks like a UUID) or by slug — only when
  // --campaign is given. Omitted → backfill every campaign.
  let camp = null;
  if (CAMPAIGN) {
    const sel = supabase.from('campaign_recaps').select('id, slug, name');
    const { data, error: cErr } = await (
      UUID_RE.test(CAMPAIGN) ? sel.eq('id', CAMPAIGN) : sel.eq('slug', CAMPAIGN)
    ).maybeSingle();
    if (cErr || !data) throw new Error(`campaign lookup failed: ${cErr?.message || 'not found'} (${CAMPAIGN})`);
    camp = data;
    console.log(`\nVideo-poster backfill for ${camp.name} (${camp.slug})  id=${camp.id}`);
  } else {
    console.log(`\nVideo-poster backfill for ALL campaigns`);
  }
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`);

  // Videos with no poster yet — optionally scoped to one campaign. Excludes
  // is_video_thumbnail rows; the thumbnail_url IS NULL filter keeps it idempotent.
  let q = supabase
    .from('media')
    .select('id, type, file_url, storage_path, thumbnail_url')
    .eq('type', 'video')
    .is('thumbnail_url', null)
    .not('is_video_thumbnail', 'is', true)
    .order('created_at');
  if (camp) q = q.eq('campaign_id', camp.id);
  if (LIMIT) q = q.limit(LIMIT);
  const { data: rows, error: mErr } = await q;
  if (mErr) throw new Error(`media lookup failed: ${mErr.message}`);
  console.log(`Found ${rows.length} video row(s) with no thumbnail_url.\n`);

  let processed = 0, errors = 0;
  const tmpRoot = DRY_RUN ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'pg-poster-'));

  for (const m of rows) {
    const objectPath = objectPathFor(m);
    if (!objectPath) {
      console.log(`  ! ${m.id}: can't resolve storage path (no storage_path, unparseable file_url) — skipping`);
      errors++;
      continue;
    }
    const posterPath = posterPathFor(objectPath);

    if (DRY_RUN) {
      console.log(`  ${m.id}`);
      console.log(`    video : ${objectPath}`);
      console.log(`    poster: ${posterPath}`);
      processed++;
      continue;
    }

    const localVideo = path.join(tmpRoot, `${m.id}${path.extname(objectPath) || '.mp4'}`);
    const localPoster = path.join(tmpRoot, `${m.id}.jpg`);
    try {
      // Download the video from storage.
      const { data: blob, error: dErr } = await supabase.storage.from(BUCKET).download(objectPath);
      if (dErr) throw new Error(`download failed: ${dErr.message}`);
      fs.writeFileSync(localVideo, Buffer.from(await blob.arrayBuffer()));

      // Extract a frame at ~1s; fall back to 0.5s for very short clips.
      try {
        await posterFrame(localVideo, localPoster, '00:00:01');
      } catch (_) {
        await posterFrame(localVideo, localPoster, '00:00:00.5');
      }
      if (!fs.existsSync(localPoster) || fs.statSync(localPoster).size === 0) {
        throw new Error('ffmpeg produced no poster frame');
      }

      // Upload the poster JPG.
      const { error: uErr } = await supabase.storage.from(BUCKET).upload(
        posterPath, fs.readFileSync(localPoster), { contentType: 'image/jpeg', upsert: true }
      );
      if (uErr) throw new Error(`upload failed: ${uErr.message}`);
      const thumbnailUrl = supabase.storage.from(BUCKET).getPublicUrl(posterPath).data.publicUrl;

      // Persist thumbnail_url on the video row.
      const { error: updErr } = await supabase
        .from('media')
        .update({ thumbnail_url: thumbnailUrl })
        .eq('id', m.id);
      if (updErr) throw new Error(`update failed: ${updErr.message}`);

      console.log(`  ✓ ${m.id} → ${posterPath}`);
      processed++;
    } catch (e) {
      console.error(`  ! ${m.id} (${objectPath}): ${e.message}`);
      errors++;
    } finally {
      try { if (fs.existsSync(localVideo)) fs.unlinkSync(localVideo); } catch (_) {}
      try { if (fs.existsSync(localPoster)) fs.unlinkSync(localPoster); } catch (_) {}
    }
  }

  if (tmpRoot) { try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {} }

  console.log(`\n— Summary —`);
  console.log(`  ${DRY_RUN ? 'would process' : 'processed'}: ${processed}`);
  console.log(`  errors: ${errors}`);
}

main().catch(e => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
