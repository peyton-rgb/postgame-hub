// ============================================================
// Add the white/reverse overlay variants to the Cane's × Fanatics Fest package
//
// A follow-up drop to upload-canes-editor-assets.ts: 18 white versions of the
// red headline overlays (for dark/busy footage) plus 2 brand-new concepts
// (Hail Mary, Lost in the Sauce) shipped in both red and white — 20 PNGs, all
// headlines. Uploads them to
// `campaign-media/asset-graphics/canes-fanatics-fest/headlines/<file>` and
// splices them into `asset_packages.settings.graphics` so each white card sits
// directly after its red partner, with `dark: true` (dark preview tile).
//
// Idempotent by construction: every run first strips any of these 20 files from
// the manifest, then re-inserts them deterministically, so re-running (or
// running after a partial run) converges to the same result. Files already in
// Storage are left as-is.
//
// Run with:
//   WHITE_DIR=/path/to/Canes_White_Variants \
//     node --env-file=.env.local scripts/upload-canes-white-variants.ts
//
// Inputs (override via env):
//   WHITE_DIR — folder holding the 20 PNGs
//               (default: scripts/data/canes-white-variants)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PACKAGE_ID = '647a9b36-3862-40ba-98a4-4b816f88eed0'; // Cane's × Fanatics Fest
const BUCKET = 'campaign-media';
const HEADLINES_PREFIX = 'asset-graphics/canes-fanatics-fest/headlines';

// Each existing red headline file -> its white variant file. The white card's
// label is the red card's label + " (White)", read from the live manifest so
// the two always read as a pair. Two existing reds (one_love_stack,
// one_love_flag_stack) have no white and are intentionally absent.
const WHITE_FOR: Record<string, string> = {
  '01_sauce_dunk.png': 'w_sauce_dunk.png',
  '04_one_love.png': 'w_one_love.png',
  '08_get_sauced.png': 'w_get_sauced.png',
  '10_game_on.png': 'w_game_on.png',
  '11_spike_it.png': 'w_spike_it.png',
  '12_go_long.png': 'w_go_long.png',
  '14_the_drop.png': 'w_the_drop.png',
  '17_sauce_bath.png': 'w_sauce_bath.png',
  '32_one_city_one_love.png': 'w_one_city_one_love.png',
  '39_game_time.png': 'w_game_time.png',
  '43_sauce_szn.png': 'w_sauce_szn.png',
  '44_dig_in.png': 'w_dig_in.png',
  '51_winner_winner_chicken_dinner.png': 'w_winner_winner_chicken_dinner.png',
  '64_chicken_fingers_stack.png': 'w_chicken_fingers.png',
  '77_chicken_finger_hail_mary.png': 'w_chicken_finger_hail_mary.png',
  '80_the_tank_is_filling.png': 'w_the_tank_is_filling.png',
};

// Brand-new headline concepts, appended after the existing headlines. Each is a
// red card immediately followed by its white variant.
const NEW_CONCEPTS: { file: string; label: string; dark?: boolean }[] = [
  { file: 'hail_mary_red.png', label: 'Hail Mary' },
  { file: 'w_hail_mary.png', label: 'Hail Mary (White)', dark: true },
  { file: 'lost_in_the_sauce_red.png', label: 'Lost In The Sauce' },
  { file: 'w_lost_in_the_sauce.png', label: 'Lost In The Sauce (White)', dark: true },
];

// Every file this script owns — the set it strips before re-inserting so a
// re-run is a no-op rather than a duplicate.
const OWNED_FILES = new Set<string>([
  ...Object.values(WHITE_FOR),
  ...NEW_CONCEPTS.map((c) => c.file),
]);

type Graphic = { category: string; file: string; label: string; dark?: boolean };

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with: node --env-file=.env.local scripts/upload-canes-white-variants.ts'
  );
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
const __dirname = dirname(fileURLToPath(import.meta.url));
const WHITE_DIR = process.env.WHITE_DIR || join(__dirname, 'data', 'canes-white-variants');

async function uploadIfMissing(path: string, buf: Buffer): Promise<boolean> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: 'image/png', upsert: false });
  if (error) {
    const dup = /exist|dupl|409/i.test(error.message || '');
    if (!dup) throw new Error(`upload ${path}: ${error.message}`);
    return false;
  }
  return true;
}

async function main() {
  if (!existsSync(WHITE_DIR)) {
    console.error(`White-variants folder not found: ${WHITE_DIR}\nSet WHITE_DIR to the unzipped Canes_White_Variants folder.`);
    process.exit(1);
  }

  // 1. Upload all 20 files (missing-only).
  let added = 0;
  let present = 0;
  for (const file of Array.from(OWNED_FILES)) {
    const src = join(WHITE_DIR, file);
    if (!existsSync(src)) throw new Error(`missing PNG: ${src}`);
    (await uploadIfMissing(`${HEADLINES_PREFIX}/${file}`, readFileSync(src))) ? added++ : present++;
  }
  console.log(`Files: ${OWNED_FILES.size} owned · ${added} uploaded · ${present} already present`);

  // 2. Read the live manifest and strip anything this script owns (idempotency).
  const { data: pkg, error: rErr } = await supabase
    .from('asset_packages')
    .select('settings')
    .eq('id', PACKAGE_ID)
    .single();
  if (rErr) throw new Error(`read asset_packages: ${rErr.message}`);
  const current: Graphic[] = Array.isArray((pkg?.settings as any)?.graphics)
    ? (pkg!.settings as any).graphics
    : [];
  const base = current.filter((g) => !OWNED_FILES.has(g.file));

  // 3. Interleave: each red headline is followed by its white variant, labelled
  //    off the red's own label so the pair always reads together.
  const out: Graphic[] = [];
  let lastHeadlineIdx = -1;
  for (const g of base) {
    out.push(g);
    if (g.category === 'headlines') lastHeadlineIdx = out.length - 1;
    const white = g.category === 'headlines' ? WHITE_FOR[g.file] : undefined;
    if (white) {
      out.push({ category: 'headlines', file: white, label: `${g.label} (White)`, dark: true });
      lastHeadlineIdx = out.length - 1;
    }
  }

  // 4. The 2 new concepts land right after the existing headlines run.
  const newEntries: Graphic[] = NEW_CONCEPTS.map((c) => ({ category: 'headlines', ...c }));
  const insertAt = lastHeadlineIdx >= 0 ? lastHeadlineIdx + 1 : out.length;
  out.splice(insertAt, 0, ...newEntries);

  // Warn on any white whose red partner never appeared (mapping drift).
  const placed = new Set(out.map((g) => g.file));
  for (const w of Array.from(OWNED_FILES)) if (!placed.has(w)) console.warn(`  ! ${w} not placed — red partner missing from manifest`);

  const settings = { ...(pkg?.settings ?? {}), graphics: out };
  const { error: uErr } = await supabase
    .from('asset_packages')
    .update({ settings })
    .eq('id', PACKAGE_ID);
  if (uErr) throw new Error(`write settings: ${uErr.message}`);

  const whites = out.filter((g) => g.dark).length;
  console.log(`Manifest: ${current.length} -> ${out.length} graphics (${whites} white/dark). Done.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
