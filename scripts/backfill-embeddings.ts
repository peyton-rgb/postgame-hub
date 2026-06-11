// ============================================================
// Backfill embeddings for inspo_items
//
// Generates an OpenAI embedding for inspo_items rows that were
// tagged but never embedded, and writes it to the `embedding`
// column ONLY (no tagging_status / semantics changes).
//
// Run with:
//   node --env-file=.env.local scripts/backfill-embeddings.ts
//   node --env-file=.env.local scripts/backfill-embeddings.ts --limit 18
//
// Node native type-stripping runs this .ts file directly, so the
// shared module is imported by RELATIVE path with an explicit .ts
// extension — the "@/" alias is a bundler concern and won't resolve
// under bare node.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { buildEmbeddingInput, generateEmbedding } from '../src/lib/services/embeddings.ts';

// --- Env guard ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing: string[] = [];
if (!OPENAI_API_KEY) missing.push('OPENAI_API_KEY');
if (!NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (missing.length) {
  console.error(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      `Run with: node --env-file=.env.local scripts/backfill-embeddings.ts`
  );
  process.exit(1);
}

// --- Args: --limit N (default 1) ---
function parseLimit(argv: string[]): number {
  const idx = argv.indexOf('--limit');
  if (idx === -1) return 1;
  const raw = argv[idx + 1];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`Invalid --limit value: ${raw}. Must be a positive integer.`);
    process.exit(1);
  }
  return n;
}

const limit = parseLimit(process.argv.slice(2));

const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data: rows, error } = await supabase
    .from('inspo_items')
    .select(
      'id, visual_description, sport, school, context_tags, social_tags, pro_tags, search_phrases, brief_fit'
    )
    .is('embedding', null)
    .eq('tagging_status', 'tagged')
    .not('visual_description', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error(`Query failed: ${error.message}`);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('No rows to backfill (embedding IS NULL AND tagging_status = \'tagged\' AND visual_description IS NOT NULL).');
    return;
  }

  console.log(`Backfilling ${rows.length} row(s) (limit ${limit})...`);

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const input = buildEmbeddingInput(row);
      const embedding = await generateEmbedding(input);

      const { error: updateError } = await supabase
        .from('inspo_items')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', row.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      success++;
      console.log(`✓ ${row.id} — ${embedding.length} dimensions`);
    } catch (err) {
      failed++;
      console.error(
        `✗ ${row.id} — ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  console.log(`Done. ${success} succeeded, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
