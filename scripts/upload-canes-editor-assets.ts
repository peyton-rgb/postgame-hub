// ============================================================
// Upload Raising Cane's × Fanatics Fest editor assets to Storage
//
// One-off, idempotent job (mirrors upload-canes-package-assets.ts — service
// client, no bundler, relative reads):
//
//   1. Graphics — 40 transparent overlay PNGs from the pack's numbered folders
//      to `campaign-media/asset-graphics/canes-fanatics-fest/<category>/<file>`.
//   2. Music — the 6 full-quality UPM instrumental beds from 06_MUSIC to
//      `campaign-media/asset-music/canes-fanatics-fest/<file>`.
//      (SFX later — 07_SFX ships empty, so the page shows an empty state.)
//   3. Manifest — records exactly what it uploaded into
//      `asset_packages.settings` as { graphics, music, sfx }, which is what
//      /pkg/[token] maps over to render the two sections.
//
// Idempotent: an object that already exists is left as-is (not re-uploaded),
// and the manifest is rewritten from the files actually present on disk each
// run, merged into `settings` so unrelated keys survive.
//
// Run with:
//   node --env-file=.env.local scripts/upload-canes-editor-assets.ts
//
// Inputs (override via env):
//   ASSETS_DIR — the unzipped Canes_Editor_Assets `editor_assets` folder
//                (default: scripts/data/canes-editor-assets)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PACKAGE_ID = '647a9b36-3862-40ba-98a4-4b816f88eed0'; // Cane's × Fanatics Fest
const PKG_SLUG = 'canes-fanatics-fest';
const BUCKET = 'campaign-media';
const GRAPHIC_PREFIX = `asset-graphics/${PKG_SLUG}`;
const MUSIC_PREFIX = `asset-music/${PKG_SLUG}`;

// Pack folder -> manifest category. Mirrors GRAPHIC_CATEGORIES in
// src/lib/packages.ts, which orders the filter chips.
const CATEGORY_DIRS: [string, string][] = [
  ['01_HEADLINES', 'headlines'],
  ['02_BADGES', 'badges'],
  ['03_BANNERS', 'banners'],
  ['04_ARCHED', 'arched'],
  ['05_BRAND', 'brand'],
];
const MUSIC_DIR = '06_MUSIC';

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with: node --env-file=.env.local scripts/upload-canes-editor-assets.ts'
  );
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = process.env.ASSETS_DIR || join(__dirname, 'data', 'canes-editor-assets');

// Upload a file only if the object doesn't already exist.
async function uploadIfMissing(path: string, buf: Buffer, contentType: string) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType, upsert: false });
  if (error) {
    // Duplicate is fine (idempotent). Anything else is a real failure.
    const dup = /exist|dupl|409/i.test(error.message || '');
    if (!dup) throw new Error(`upload ${path}: ${error.message}`);
    return false;
  }
  return true;
}

function listFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(ext) && !f.startsWith('.'))
    .sort(); // numeric filename prefixes make lexical sort the pack's own order
}

// "01_sauce_dunk.png" -> "Sauce Dunk". Strips only the leading index prefix, so
// "63_1996_tag.png" keeps its year -> "1996 Tag".
function labelFromFile(file: string): string {
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+_/, '')
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// "01_Balling_Out_UPM_LLPM1065_4.mp3" -> "Balling Out". Everything from the
// `_UPM_` library code onward is catalogue noise, not a title.
function titleFromTrack(file: string): string {
  const stem = file.replace(/\.[^.]+$/, '').replace(/^\d+_/, '');
  return stem.split('_UPM_')[0].split('_').filter(Boolean).join(' ');
}

// TRACKS.txt is the source of truth for titles + run times; filename-derived
// values are the fallback if a line is missing or reformatted.
// Line shape: "<file>.mp3   <Title>            1:13"
function parseTracks(dir: string): Map<string, { title: string; len: string }> {
  const out = new Map<string, { title: string; len: string }>();
  const path = join(dir, 'TRACKS.txt');
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^(\S+\.mp3)\s+(.+?)\s+(\d+:\d{2})\s*$/);
    if (m) out.set(m[1], { title: m[2].trim(), len: m[3] });
  }
  return out;
}

async function uploadGraphics() {
  const graphics: { category: string; file: string; label: string }[] = [];
  let added = 0;
  let present = 0;

  for (const [folder, category] of CATEGORY_DIRS) {
    const dir = join(ASSETS_DIR, folder);
    const files = listFiles(dir, '.png');
    if (!files.length) {
      console.warn(`  ! no PNGs in ${folder} — skipping`);
      continue;
    }
    for (const file of files) {
      const objectPath = `${GRAPHIC_PREFIX}/${category}/${file}`;
      const isNew = await uploadIfMissing(objectPath, readFileSync(join(dir, file)), 'image/png');
      isNew ? added++ : present++;
      graphics.push({ category, file, label: labelFromFile(file) });
    }
  }

  console.log(`Graphics: ${graphics.length} in manifest · ${added} uploaded · ${present} already present`);
  return graphics;
}

async function uploadMusic() {
  const dir = join(ASSETS_DIR, MUSIC_DIR);
  const files = listFiles(dir, '.mp3');
  const tracks = parseTracks(dir);
  const music: { file: string; title: string; len?: string }[] = [];
  let added = 0;
  let present = 0;

  for (const file of files) {
    const objectPath = `${MUSIC_PREFIX}/${file}`;
    const isNew = await uploadIfMissing(objectPath, readFileSync(join(dir, file)), 'audio/mpeg');
    isNew ? added++ : present++;
    const meta = tracks.get(file);
    music.push({ file, title: meta?.title || titleFromTrack(file), len: meta?.len });
  }

  console.log(`Music: ${music.length} in manifest · ${added} uploaded · ${present} already present`);
  if (files.length && !tracks.size) console.warn('  ! TRACKS.txt not parsed — titles derived from filenames');
  return music;
}

async function writeManifest(
  graphics: { category: string; file: string; label: string }[],
  music: { file: string; title: string; len?: string }[]
) {
  const { data: pkg, error: rErr } = await supabase
    .from('asset_packages')
    .select('settings')
    .eq('id', PACKAGE_ID)
    .single();
  if (rErr) throw new Error(`read asset_packages: ${rErr.message}`);

  // Merge, don't clobber: `settings` is the package's general-purpose bag and
  // may hold keys this script knows nothing about. SFX ship later; preserve any
  // existing list rather than resetting it to [].
  const settings = {
    ...(pkg?.settings ?? {}),
    graphics,
    music,
    sfx: (pkg?.settings as any)?.sfx ?? [],
  };

  const { error: uErr } = await supabase
    .from('asset_packages')
    .update({ settings })
    .eq('id', PACKAGE_ID);
  if (uErr) throw new Error(`write settings: ${uErr.message}`);
  console.log(`Manifest: settings.graphics=${graphics.length} settings.music=${music.length} settings.sfx=${settings.sfx.length}`);
}

async function main() {
  if (!existsSync(ASSETS_DIR)) {
    console.error(
      `Assets folder not found: ${ASSETS_DIR}\n` +
        'Unzip Canes_Editor_Assets.zip and point ASSETS_DIR at its `editor_assets` folder.'
    );
    process.exit(1);
  }
  const graphics = await uploadGraphics();
  const music = await uploadMusic();
  await writeManifest(graphics, music);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
