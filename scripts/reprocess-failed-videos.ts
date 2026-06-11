// ============================================================
// Reprocess failed videos via the Fly worker (no Vercel timeout)
//
// ~46 inspo_items are stuck at tagging_status='failed' — videos that
// need frame extraction + tagging. The browser reprocess route hits
// Vercel's 300s function ceiling. This script calls the Fly worker's
// /process endpoint directly, one video at a time, so there's no
// Vercel involvement and no ceiling. The worker owns everything
// downstream (frames → /api/tag → tags + embedding + thumbnail +
// status update).
//
// This script NEVER writes to the database — the worker / Hub own all
// status changes.
//
// Run with:
//   node --env-file=.env.local scripts/reprocess-failed-videos.ts
//   node --env-file=.env.local scripts/reprocess-failed-videos.ts --limit 5
// ============================================================

import { createClient } from '@supabase/supabase-js';

// --- Env guard ---
const FFMPEG_WORKER_URL = process.env.FFMPEG_WORKER_URL;
const FFMPEG_WORKER_SECRET = process.env.FFMPEG_WORKER_SECRET;
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing: string[] = [];
if (!FFMPEG_WORKER_URL) missing.push('FFMPEG_WORKER_URL');
if (!FFMPEG_WORKER_SECRET) missing.push('FFMPEG_WORKER_SECRET');
if (!NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (missing.length) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      `Run with: node --env-file=.env.local scripts/reprocess-failed-videos.ts`
  );
  process.exit(1);
}

// --- Args: --limit N (default: all) ---
function parseLimit(argv: string[]): number | null {
  const idx = argv.indexOf('--limit');
  if (idx === -1) return null;
  const raw = argv[idx + 1];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`Invalid --limit value: ${raw}. Must be a positive integer.`);
    process.exit(1);
  }
  return n;
}

const limit = parseLimit(process.argv.slice(2));

// Pacing between videos — Claude rate-limit headroom. Keep this.
const PACING_MS = 16000;

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Build human_tags, omitting null/undefined fields.
function buildHumanTags(row: {
  athlete_name: string | null;
  content_type: string | null;
  tech_notes: string | null;
}): Record<string, string> {
  const human: Record<string, string> = {};
  if (row.athlete_name != null) human.athlete_name = row.athlete_name;
  if (row.content_type != null) human.content_type = row.content_type;
  if (row.tech_notes != null) human.tech_notes = row.tech_notes;
  return human;
}

async function main() {
  let query = supabase
    .from('inspo_items')
    .select('id, file_url, athlete_name, content_type, tech_notes')
    .eq('tagging_status', 'failed')
    .not('file_url', 'is', null)
    .order('created_at', { ascending: true });

  if (limit != null) {
    query = query.limit(limit);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error(`Query failed: ${error.message}`);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log("No failed videos to reprocess (tagging_status='failed' AND file_url IS NOT NULL).");
    return;
  }

  console.log(
    `Reprocessing ${rows.length} failed video(s)${limit != null ? ` (limit ${limit})` : ' (all)'}. ` +
      `Pacing ${PACING_MS / 1000}s between videos — this will take a while.`
  );

  const failedIds: string[] = [];
  let succeeded = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const label = `[${i + 1}/${rows.length}] ${row.id}`;

    try {
      const res = await fetch(`${FFMPEG_WORKER_URL}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ffmpeg-secret': FFMPEG_WORKER_SECRET!,
        },
        body: JSON.stringify({
          video_url: row.file_url,
          inspo_item_id: row.id,
          human_tags: buildHumanTags(row),
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        failedIds.push(row.id);
        console.error(`✗ ${label} — HTTP ${res.status}: ${errBody}`);
      } else {
        succeeded++;
        console.log(`✓ ${label}`);
      }
    } catch (err) {
      failedIds.push(row.id);
      console.error(
        `✗ ${label} — ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // Pace before the next video (skip the wait after the last one).
    if (i < rows.length - 1) {
      await sleep(PACING_MS);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed:    ${failedIds.length}`);
  if (failedIds.length) {
    console.log('Failed ids:');
    for (const id of failedIds) console.log(`  ${id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
