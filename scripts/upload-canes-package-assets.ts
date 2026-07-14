// ============================================================
// Upload Raising Cane's × Fanatics Fest package assets to Storage
//
// Two one-off, idempotent jobs (mirrors seed-canes-package.ts — service
// client, no bundler, relative reads):
//
//   1. Tags — uploads the pre-rendered top-100 name-tag PNGs to
//      `campaign-media/asset-tags/canes-fanatics-fest/<slug>.png` and sets
//      `package_talent.tag_url` to each public URL (matched by sort_order,
//      only where tag_url is currently null). The page then serves those rows
//      as instant downloads instead of canvas-generating on click.
//   2. White logo — uploads the reverse Cane's logo to
//      `campaign-media/brand-kits/<brand_id>/logo-white.png` and sets
//      `brands.logo_white_url` (only if currently null). The dark hero then
//      prefers it via pickHeroLogo (white → dark → primary).
//
// Idempotent: an object that already exists is left as-is (not re-uploaded),
// and tag_url / logo_white_url are only set when null.
//
// Run with:
//   node --env-file=.env.local scripts/upload-canes-package-assets.ts
//
// Inputs (override via env):
//   TAGS_DIR  — folder holding the 100 PNGs + names in the manifest
//               (default: scripts/data/canes-first100-tags)
//   LOGO_FILE — the white-logo PNG
//               (default: scripts/data/canes-logo-white.png)
// The manifest (sort_order,name,slug,file) is committed at
// scripts/data/canes-first100-manifest.csv.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PACKAGE_ID = '647a9b36-3862-40ba-98a4-4b816f88eed0'; // Cane's × Fanatics Fest
const BRAND_ID = 'b4f26813-c443-4a7a-b423-1e8132d070c3'; // Raising Cane's
const BUCKET = 'campaign-media';
const TAG_PREFIX = 'asset-tags/canes-fanatics-fest';
const LOGO_PATH = `brand-kits/${BRAND_ID}/logo-white.png`;

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with: node --env-file=.env.local scripts/upload-canes-package-assets.ts'
  );
  process.exit(1);
}

// --- Minimal CSV parser (quoted fields + doubled quotes) ---
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (field !== '' || row.length) { row.push(field); rows.push(row); }
      field = ''; row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() ?? [];
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const __dirname = dirname(fileURLToPath(import.meta.url));

function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Upload a file only if the object doesn't already exist. Returns the public URL.
async function uploadIfMissing(path: string, buf: Buffer): Promise<string> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'image/png', upsert: false });
  if (error) {
    // Duplicate is fine (idempotent). Anything else is a real failure.
    const dup = /exist|dupl|409/i.test(error.message || '');
    if (!dup) throw new Error(`upload ${path}: ${error.message}`);
  }
  return publicUrl(path);
}

async function uploadTags() {
  const tagsDir = process.env.TAGS_DIR || join(__dirname, 'data', 'canes-first100-tags');
  const manifestPath = join(__dirname, 'data', 'canes-first100-manifest.csv');
  const manifest = parseCsv(readFileSync(manifestPath, 'utf8'));

  // DB rows for this package, keyed by sort_order (the reliable join key — the
  // seed's slug diverges from the manifest slug for a couple of accented names).
  const { data: talent, error: tErr } = await supabase
    .from('package_talent')
    .select('id, sort_order, name, slug, tag_url')
    .eq('package_id', PACKAGE_ID);
  if (tErr) throw new Error(`read package_talent: ${tErr.message}`);
  const bySort = new Map<number, { id: string; slug: string; name: string; tag_url: string | null }>();
  for (const r of (talent ?? []) as any[]) bySort.set(r.sort_order, r);

  let uploaded = 0, linked = 0, skippedLink = 0, missingFile = 0, noRow = 0;
  for (const m of manifest) {
    const so = Number.parseInt(m.sort_order ?? '', 10);
    const file = (m.file ?? '').trim();
    const row = bySort.get(so);
    if (!row) { console.warn(`  ! no package_talent row for sort_order ${so} (${m.name})`); noRow++; continue; }
    if (m.name && row.name && m.name.trim() !== row.name.trim()) {
      console.warn(`  ! name mismatch at sort_order ${so}: manifest="${m.name}" db="${row.name}" — using db row`);
    }
    const filePath = join(tagsDir, file);
    if (!existsSync(filePath)) { console.warn(`  ! missing PNG: ${filePath}`); missingFile++; continue; }

    const objectPath = `${TAG_PREFIX}/${row.slug}.png`;
    const url = await uploadIfMissing(objectPath, readFileSync(filePath));
    uploaded++;

    if (row.tag_url) { skippedLink++; continue; } // only set where null
    const { error: uErr } = await supabase
      .from('package_talent')
      .update({ tag_url: url })
      .eq('id', row.id);
    if (uErr) throw new Error(`set tag_url for ${row.slug}: ${uErr.message}`);
    linked++;
  }
  console.log(
    `Tags: ${uploaded} objects present · ${linked} tag_url set · ${skippedLink} already linked` +
      (missingFile ? ` · ${missingFile} missing files` : '') +
      (noRow ? ` · ${noRow} unmatched rows` : '')
  );
}

async function uploadWhiteLogo() {
  const logoFile = process.env.LOGO_FILE || join(__dirname, 'data', 'canes-logo-white.png');
  if (!existsSync(logoFile)) { console.warn(`Logo: file not found (${logoFile}) — skipping`); return; }

  const url = await uploadIfMissing(LOGO_PATH, readFileSync(logoFile));

  const { data: brand, error: bErr } = await supabase
    .from('brands')
    .select('logo_white_url')
    .eq('id', BRAND_ID)
    .single();
  if (bErr) throw new Error(`read brand: ${bErr.message}`);

  if (brand?.logo_white_url) {
    console.log(`Logo: object present · logo_white_url already set (${brand.logo_white_url})`);
    return;
  }
  const { error: uErr } = await supabase
    .from('brands')
    .update({ logo_white_url: url })
    .eq('id', BRAND_ID);
  if (uErr) throw new Error(`set logo_white_url: ${uErr.message}`);
  console.log(`Logo: object present · logo_white_url set to ${url}`);
}

async function main() {
  await uploadTags();
  await uploadWhiteLogo();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
