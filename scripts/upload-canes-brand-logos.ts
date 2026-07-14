// ============================================================
// Upload the real Raising Cane's web logo variants to Storage and
// point the brand-kit columns at them.
//
// One-off, idempotent job (mirrors upload-canes-package-assets.ts —
// service client, no bundler, relative reads). Uploads the three official
// web PNGs to `campaign-media/brand-kits/<brand_id>/` and sets the matching
// `brands` columns:
//
//   logo_primary_url → full-color RGB logo        (canes-logo-rgb.png)
//   logo_white_url   → white / reverse (on dark)  (canes-logo-white.png)
//   logo_light_url   → black 1-color (on light)   (canes-logo-black.png)
//
// logo_dark_url and logo_mark_url are left untouched — there is no distinct
// dark-background lockup or standalone paw mark in the official set.
//
// Fresh object names (never previously referenced) so the public CDN serves
// the new files immediately instead of a stale cache of an overwritten path.
// This intentionally replaces the earlier logo_light_url, which pointed at a
// wrong flat-path upload (…-eh2i3fii.png).
//
// Idempotent: re-running upserts the same objects and re-sets the same three
// URLs. Columns are set unconditionally (not only-if-null) because the point
// is to correct existing values.
//
// Run with:
//   node --env-file=.env.local scripts/upload-canes-brand-logos.ts
//
// Inputs (override via env — point these at the official logo folder):
//   LOGO_RGB   — full-color RGB PNG   (default: scripts/data/canes-brand-logos/rgb.png)
//   LOGO_WHITE — white/reverse PNG    (default: scripts/data/canes-brand-logos/white.png)
//   LOGO_BLACK — black 1-color PNG    (default: scripts/data/canes-brand-logos/black.png)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BRAND_ID = 'b4f26813-c443-4a7a-b423-1e8132d070c3'; // Raising Cane's
const BUCKET = 'campaign-media';
const PREFIX = `brand-kits/${BRAND_ID}`;

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with: node --env-file=.env.local scripts/upload-canes-brand-logos.ts'
  );
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data', 'canes-brand-logos');

// column, storage object name, local source file
const VARIANTS = [
  { column: 'logo_primary_url', object: 'canes-logo-rgb.png', src: process.env.LOGO_RGB || join(dataDir, 'rgb.png') },
  { column: 'logo_white_url', object: 'canes-logo-white.png', src: process.env.LOGO_WHITE || join(dataDir, 'white.png') },
  { column: 'logo_light_url', object: 'canes-logo-black.png', src: process.env.LOGO_BLACK || join(dataDir, 'black.png') },
] as const;

function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function main() {
  const update: Record<string, string> = {};

  for (const v of VARIANTS) {
    if (!existsSync(v.src)) throw new Error(`missing source PNG: ${v.src}`);
    const objectPath = `${PREFIX}/${v.object}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, readFileSync(v.src), { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`upload ${objectPath}: ${error.message}`);
    const url = publicUrl(objectPath);
    update[v.column] = url;
    console.log(`Uploaded ${objectPath} → ${v.column}`);
  }

  const { error: uErr } = await supabase.from('brands').update(update).eq('id', BRAND_ID);
  if (uErr) throw new Error(`update brands: ${uErr.message}`);

  console.log('Set columns:');
  for (const [k, val] of Object.entries(update)) console.log(`  ${k} = ${val}`);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
