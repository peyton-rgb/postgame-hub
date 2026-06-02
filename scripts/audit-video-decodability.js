#!/usr/bin/env node
// THROWAWAY read-only audit — NO DB or storage writes.
//
//   node --env-file=.env.local scripts/audit-video-decodability.js
//
// Takes the exact rows the backfill targets (type='video', thumbnail_url IS
// NULL, is_video_thumbnail not true, all campaigns) and runs ffprobe on each
// stored file (via its public URL) to classify it OK (decodable) vs CORRUPT
// (moov atom not found / undecodable). Prints counts + the corrupt list with
// campaign, filename, and an import-path clue. Writes nothing anywhere.

const { execFile } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Run with --env-file=.env.local');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const BUCKET = 'campaign-media';
const CONCURRENCY = 4;
const TIMEOUT_MS = 60000;

// Same path resolution as the backfill: prefer storage_path, else parse file_url.
function objectPathFor(m) {
  if (m.storage_path) return m.storage_path;
  const marker = `/object/public/${BUCKET}/`;
  const i = (m.file_url || '').indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(m.file_url.slice(i + marker.length).split('?')[0]);
}

// Guess which import path produced the file, from path/filename shape.
function importClue(objectPath) {
  if (!objectPath) return 'unknown (no path)';
  if (objectPath.includes('/event/')) return 'event / drive-import (/event/ path)';
  const base = objectPath.split('/').pop() || '';
  const prefix = base.split('-')[0] || '';
  if (/^\d+$/.test(prefix)) return 'direct upload (timestamp prefix)';
  if (/[A-Za-z]/.test(prefix) && prefix.length >= 8) return 'bulk import (Drive-ID prefix)';
  return 'unknown';
}

// ffprobe a URL; resolve { status, reason }. Read-only network access only.
function probe(url) {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-of', 'json',
       '-show_entries', 'format=format_name,duration',
       '-show_entries', 'stream=codec_type', url],
      { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (!err) {
          let ok = false;
          try {
            const j = JSON.parse(stdout || '{}');
            ok = !!(j.format && (j.streams || []).some((s) => s.codec_type === 'video'));
          } catch (_) { /* fall through */ }
          return resolve(ok ? { status: 'OK' } : { status: 'CORRUPT', reason: 'no video stream' });
        }
        const s = stderr || '';
        if (/moov atom not found/i.test(s)) return resolve({ status: 'CORRUPT', reason: 'moov atom not found' });
        if (err.killed) return resolve({ status: 'CORRUPT', reason: 'ffprobe timeout' });
        const firstLine = s.split('\n').find(Boolean) || err.message;
        return resolve({ status: 'CORRUPT', reason: firstLine.trim().slice(0, 120) });
      }
    );
  });
}

async function main() {
  const { data: camps } = await supabase.from('campaign_recaps').select('id, slug');
  const slugById = new Map((camps || []).map((c) => [c.id, c.slug]));

  const { data: rows, error } = await supabase
    .from('media')
    .select('id, campaign_id, file_url, storage_path')
    .eq('type', 'video')
    .is('thumbnail_url', null)
    .not('is_video_thumbnail', 'is', true)
    .order('created_at');
  if (error) throw new Error(error.message);
  console.log(`Auditing ${rows.length} video row(s) — OK = '.'  CORRUPT = 'X'\n`);

  const results = new Array(rows.length);
  let idx = 0;
  async function worker() {
    while (idx < rows.length) {
      const i = idx++;
      const m = rows[i];
      const objectPath = objectPathFor(m);
      const clue = importClue(objectPath);
      if (!objectPath) {
        results[i] = { m, objectPath, clue, status: 'CORRUPT', reason: 'no storage path' };
        process.stdout.write('X');
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
      const r = await probe(publicUrl);
      results[i] = { m, objectPath, clue, ...r };
      process.stdout.write(r.status === 'OK' ? '.' : 'X');
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n\n');

  const ok = results.filter((r) => r.status === 'OK');
  const corrupt = results.filter((r) => r.status !== 'OK');

  console.log('— Summary —');
  console.log(`  OK (decodable): ${ok.length}`);
  console.log(`  CORRUPT:        ${corrupt.length}`);
  console.log(`  TOTAL:          ${results.length}\n`);

  const byClue = {};
  for (const r of corrupt) byClue[r.clue] = (byClue[r.clue] || 0) + 1;
  console.log('Corrupt by import-path clue:');
  for (const [k, v] of Object.entries(byClue)) console.log(`  ${String(v).padStart(3)}  ${k}`);
  console.log();

  if (corrupt.length) {
    console.log('— CORRUPT files —');
    for (const r of corrupt) {
      const slug = slugById.get(r.m.campaign_id) || r.m.campaign_id;
      const fname = (r.objectPath || '').split('/').pop() || '(no path)';
      console.log(`  [${slug}] ${fname}`);
      console.log(`       ${r.reason}  |  ${r.clue}`);
    }
  }
}

main().catch((e) => { console.error('FATAL:', e.stack || e.message); process.exit(1); });
