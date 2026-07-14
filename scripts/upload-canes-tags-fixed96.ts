// ============================================================
// Overwrite the pre-rendered top-100 Cane's name-tag PNGs with the fixed-size
// (name = 96px, no auto-fit) re-render, so the stored tags match what the live
// generator (renderTag in PackageClient.tsx) now produces.
//
// One-off, idempotent (service client, no bundler, relative reads). Mirrors the
// tag-upload half of upload-canes-package-assets.ts, but:
//   • upsert: true  — OVERWRITES each existing object in place (the original
//     script used upsert:false and skipped existing objects).
//   • It does NOT touch package_talent.tag_url — the object paths are unchanged,
//     so every tag_url already points at the (now-refreshed) bytes.
//
// The target object path is the one tag_url already points at
// (asset-tags/canes-fanatics-fest/<db-slug>.png). For 98 of 100 the source PNG
// filename equals that slug; two accented names diverge (the seed slug dropped a
// trailing/interior char), so they're mapped explicitly in ALIASES.
//
// CDN: Supabase invalidates the object's CDN cache on upsert, so the new bytes
// serve without a path/tag_url change. If a hard cache is ever observed, the
// fallback is to append a version query to tag_url — not needed here.
//
// Run with:
//   node --env-file=.env.local scripts/upload-canes-tags-fixed96.ts
//
// Input (override via env):
//   TAGS_DIR — folder holding the 100 fixed-96 PNGs
//              (default: scripts/data/canes-first100-tags-fixed96)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PACKAGE_ID = '647a9b36-3862-40ba-98a4-4b816f88eed0'; // Cane's × Fanatics Fest
const BUCKET = 'campaign-media';
const TAG_PREFIX = 'asset-tags/canes-fanatics-fest';

// DB object slug (from tag_url) -> source PNG filename in TAGS_DIR, for the two
// names whose stored object path diverges from the re-rendered filename.
const ALIASES: Record<string, string> = {
  'carlos-beltr-n': 'carlos-beltran',
  'zlatan-ibrahimovi': 'zlatan-ibrahimovic',
};

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with: node --env-file=.env.local scripts/upload-canes-tags-fixed96.ts'
  );
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const __dirname = dirname(fileURLToPath(import.meta.url));
const tagsDir = process.env.TAGS_DIR || join(__dirname, 'data', 'canes-first100-tags-fixed96');

// The object slug is whatever tag_url already points at — that's the file we
// must overwrite so the URL keeps resolving to the refreshed bytes.
function slugFromTagUrl(url: string): string | null {
  const m = url.match(/\/asset-tags\/canes-fanatics-fest\/(.+?)\.png(?:\?.*)?$/);
  return m ? m[1] : null;
}

function sourceFileFor(slug: string): string {
  const base = ALIASES[slug] || slug;
  return join(tagsDir, `${base}.png`);
}

async function main() {
  const { data: talent, error } = await supabase
    .from('package_talent')
    .select('id, name, tag_url')
    .eq('package_id', PACKAGE_ID)
    .not('tag_url', 'is', null);
  if (error) throw new Error(`read package_talent: ${error.message}`);

  // Resolve every source file up front — abort before uploading if any is
  // missing, so we never do a partial overwrite.
  const jobs: { slug: string; objectPath: string; src: string; name: string }[] = [];
  const missing: string[] = [];
  for (const row of (talent ?? []) as any[]) {
    const slug = slugFromTagUrl(row.tag_url);
    if (!slug) { missing.push(`${row.name}: unparseable tag_url ${row.tag_url}`); continue; }
    const src = sourceFileFor(slug);
    if (!existsSync(src)) { missing.push(`${row.name} (${slug}): no source PNG at ${src}`); continue; }
    jobs.push({ slug, objectPath: `${TAG_PREFIX}/${slug}.png`, src, name: row.name });
  }
  if (missing.length) {
    console.error(`Aborting — ${missing.length} unresolved:\n  ` + missing.join('\n  '));
    process.exit(1);
  }

  let done = 0;
  for (const j of jobs) {
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(j.objectPath, readFileSync(j.src), { contentType: 'image/png', upsert: true });
    if (upErr) throw new Error(`overwrite ${j.objectPath}: ${upErr.message}`);
    done++;
  }
  console.log(`Overwrote ${done}/${jobs.length} tag objects with the fixed-96 re-render (tag_url unchanged).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
