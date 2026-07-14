// ============================================================
// Seed the Raising Cane's × Fanatics Fest package roster
//
// Inserts the campaign talent list (scripts/data/canes-talent-seed.csv)
// into `package_talent` for the seeded Cane's asset package. Idempotent:
// each row is keyed by (package_id, slug) and skipped if it already exists,
// so re-running never duplicates.
//
// Run with:
//   node --env-file=.env.local scripts/seed-canes-package.ts
//
// Node native type-stripping runs this .ts file directly, so we import
// @supabase/supabase-js and read the CSV by relative path — no bundler,
// no "@/" alias.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PACKAGE_ID = '647a9b36-3862-40ba-98a4-4b816f88eed0'; // Cane's × Fanatics Fest

// --- Env guard ---
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run with: node --env-file=.env.local scripts/seed-canes-package.ts'
  );
  process.exit(1);
}

// --- Minimal CSV parser (handles quoted fields + doubled quotes) ---
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

// name -> url-safe slug (matches the on-page tag-download naming)
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const csvPath = join(__dirname, 'data', 'canes-talent-seed.csv');
  const parsed = parseCsv(readFileSync(csvPath, 'utf8'));

  // Build rows with unique slugs (disambiguate collisions with -2, -3, …).
  const seenSlugs = new Set<string>();
  const talent = parsed.map((r) => {
    const name = (r.name ?? '').trim();
    let slug = slugify(name);
    let base = slug;
    let n = 2;
    while (seenSlugs.has(slug)) slug = `${base}-${n++}`;
    seenSlugs.add(slug);
    const subtext = (r.subtext ?? '').trim();
    return {
      package_id: PACKAGE_ID,
      name,
      subtext: subtext || null,
      status: (r.status ?? '').trim() || null,
      sort_order: Number.parseInt(r.sort_order ?? '0', 10) || 0,
      slug,
    };
  });

  // Idempotency: skip slugs already present for this package.
  const { data: existing, error: exErr } = await supabase
    .from('package_talent')
    .select('slug')
    .eq('package_id', PACKAGE_ID);
  if (exErr) {
    console.error('Failed to read existing talent:', exErr.message);
    process.exit(1);
  }
  const have = new Set((existing ?? []).map((r: { slug: string }) => r.slug));
  const toInsert = talent.filter((t) => !have.has(t.slug));

  console.log(
    `Parsed ${talent.length} rows · ${have.size} already seeded · inserting ${toInsert.length}`
  );

  if (toInsert.length) {
    const { error } = await supabase.from('package_talent').insert(toInsert);
    if (error) {
      console.error('Insert failed:', error.message);
      process.exit(1);
    }
  }

  const { count, error: cErr } = await supabase
    .from('package_talent')
    .select('*', { count: 'exact', head: true })
    .eq('package_id', PACKAGE_ID);
  if (cErr) {
    console.error('Count failed:', cErr.message);
    process.exit(1);
  }
  console.log(`Done. package_talent now holds ${count} rows for this package.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
