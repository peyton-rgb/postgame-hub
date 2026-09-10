#!/usr/bin/env node
// scripts/cvs-tracker-phase-b.js
// ─────────────────────────────────────────────────────────────
// Phase B of brief 07 — CVS tracker-tab + Drive link repair.
// Audit and approved decisions: docs/briefs/runs/cvs-tracker-audit.md
//
// Applies three kinds of change to campaign_recaps, keyed on the row UUID
// (never admin_campaign_id — it has known duplicates and one row holds a UUID):
//   1. tracker_url        — same spreadsheet, corrected #gid (or null)
//   2. drive_content_folder_id — the folder an ingest should walk
//   3. drive_folder_id    — campaign root, only where a campaign-specific
//                           parent folder exists
//
// Standing rule (Peyton, decision 1): content = the Content subfolder,
// root = its parent campaign folder. Where a media folder sits directly on a
// shared year shelf ("2024", "2025", "Athlete Content 2026") there is no
// campaign-specific parent, so drive_folder_id is deliberately left alone —
// writing a shared shelf id would point many campaigns at one folder.
//
// Run:  node --env-file=.env.local scripts/cvs-tracker-phase-b.js          (dry run)
//       node --env-file=.env.local scripts/cvs-tracker-phase-b.js --apply  (writes)
// ─────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const S2024B = '13Hv4tiyWCPUqJ-euU3dJBUnWsFnVkXQhRD3UOLxEeWE';
const S2025  = '1WQ2HOig9RBn1dAC1WZg0uHXVNZICf8hgBU0e2z9Jkw8';
const S2026  = '1uLiJgwjxSc6vg3sk78Q9ph33RBiY3AoW_eQXBH8VdeM';
const url = (sheet, gid) => `https://docs.google.com/spreadsheets/d/${sheet}/edit?gid=${gid}#gid=${gid}`;

// ── tracker_url: 17 corrections + 1 clear ─────────────────────
const TRACKER = [
  // 2026 Master
  ['ec697283-d195-43ac-9644-f8e26421f5cd', "Valentine's Day",                url(S2026, '578971717'),  'Extra Big Deals → Valentines Day'],
  ['83702fc8-579a-465d-9fa9-79595c13de56', '26 Spring Epic Beauty (admin 857)', url(S2026, '1684065158'), 'Extra Big Deals → Epic Beauty'],
  ['8c64e109-1b5f-40db-85fe-1b2ed6590d86', 'The Tournament',                 url(S2026, '1968908289'), 'Ronald Mcdonald House → March Madness tab (title flagged, not renamed)'],
  ['23a3c0d2-b185-4d71-bd7c-5a7ef4712fb9', 'W/CWS',                          url(S2026, '983669871'),  'SPF → College World Series'],
  ['9e0bae8f-adb9-48fe-805a-62e667cf49d4', "Mother's Day (2026)",            url(S2026, '16945540'),   'no gid → Mother\'s Day'],
  ['43319346-4a04-4123-9df0-fc1b96e134ab', 'Bloomington CFP Event',          url(S2026, '1570003009'), 'none → CFP Event'],
  ['c6fc9c9d-c010-4c1b-809c-6b7cecaa38f7', 'Fall ExtraCare x Epic',          url(S2026, '1220833137'), 'none → Fall Epic Beauty'],
  // 2025 Master
  ['5c62c3f8-8a9f-428e-8ded-302d2e27519c', "Mother's Day 2025",              url(S2025, '1310965878'), "Epic Beauty → Mother's Day"],
  ['275d7916-bb83-4d50-ad65-0a16d3886230', 'Summer/SPF',                     url(S2025, '1653369416'), 'Epic Beauty → Summer SPF'],
  ['aa58fc27-bc14-4a83-ae0a-22a65ff9bbfb', 'Epic Sale Fall 2025',            url(S2025, '229649195'),  'Epic Beauty → Epic Beauty 2 (ThisThat)'],
  ['bc69f05d-e2ea-4474-a3a3-2eab37b7f558', 'Immunization',                   url(S2025, '1726677583'), 'Epic Beauty → IMZ'],
  ['5ca2cfac-258a-4514-a539-5e52fe3d0ad3', 'Halloween',                      url(S2025, '1993793254'), 'PNW → Halloween'],
  ['7dca05c9-5aa1-46c1-b331-94ce962d97d6', 'ExtraCare December',             url(S2025, '1904433336'), 'Holiday → ExtraCare December'],
  ['66fb2d1f-2942-4cc6-991b-3ed940b52732', 'Epic Beauty + Unaltered Beauty', url(S2025, '314403906'),  'no gid → Epic Beauty'],
  // 2024 Postgame/CVS
  ['6e8b601f-1abc-4051-b17c-7ab03beddbde', 'CVS - Spotted at CVS',           url(S2024B, '427151962'), 'Epic Beauty (gid 0) → Spotted at CVS'],
  ['f2223120-0c9f-433a-91c0-a932a55c1162', 'CVS June',                       url(S2024B, '1453160804'),'none → CVS Summer (June)'],
  ['e9b28abd-4c23-4581-9641-aa06fcfe89d5', 'CVS Well Market Gifting',        url(S2024B, '199932386'), 'none → Well Market Gifting (June)'],
  // clear — no matching tab exists in any of the four trackers
  ['80853f71-fcfd-4893-99b1-befde2906b36', 'CVS March Madness',              null,                     'no matching tab → cleared'],
];

// ── drive_content_folder_id: 10 rows ──────────────────────────
const CONTENT = [
  ['66fb2d1f-2942-4cc6-991b-3ed940b52732', 'Epic Beauty + Unaltered Beauty', '1cG-6NPSGkAg7yuEJR4NdEQYu5Lfc4kER', 'Epic Beauty - Spring / Content — 60 media'],
  ['971d344d-a526-4d3b-a221-00fef445972a', 'CVS Epic Beauty (2024)',         '1TaGY-LaR5vvyAW5cQHKirPTvEyP6PtvX', 'CVS Epic Beauty Content — 26 media'],
  ['6e8b601f-1abc-4051-b17c-7ab03beddbde', 'CVS - Spotted at CVS',           '1R-VpD32RTIJr0o-rSVB8KCJO2mkETsYY', 'Content Folder - Tier 1s — 26 media'],
  ['165332db-856d-4a1a-a85d-6b1663577a7e', 'Extra Extra Big Deals January',  '1um06aPXkRbWQIcjj8mekPVy5bQvqeOtn', 'EEBD - January 2026 — 36 media'],
  ['ec697283-d195-43ac-9644-f8e26421f5cd', "Valentine's Day",                '1qeMUTQ5b_mb1ejf-TapPagM9w92BM-ES', 'Valentines - Feb 2026 — 41 media'],
  ['43319346-4a04-4123-9df0-fc1b96e134ab', 'Bloomington CFP Event',          '1asDYvNGCthsyxtpDodr6EesUiAMMM5Y-', 'Indiana CFP Celebration Event — 72 media'],
  ['565012d0-4d3c-4203-a20c-07a043f7a833', 'Community Captains',             '1MFqtWKVLuMFwYOg3_Ke-_6lsRAtgV9Jl', 'Community Captains HQ Event Reel — 6 media'],
  ['c6fc9c9d-c010-4c1b-809c-6b7cecaa38f7', 'Fall ExtraCare x Epic',          '11D4zEh2SJIPPXSkctFKJ9ZJrl5IKyIuS', 'Epic Beauty - Aug — 368 media'],
  ['a4bcd17b-2d43-47bc-b9ac-73fe439f1298', 'PNW Content',                    '1XhcYSmrjxV6VjK6hi1Ln1-9R9k7AP1vz', '2025 PNW + Events — 531 media'],
  ['f2223120-0c9f-433a-91c0-a932a55c1162', 'CVS June',                       '14XljLWmk5ekDwpBJr3d7hOvCLoAMzt9d', 'Summer - June — 18 media'],
];

// ── drive_folder_id: 2 rows (campaign-specific parents only) ──
const ROOT = [
  ['6e8b601f-1abc-4051-b17c-7ab03beddbde', 'CVS - Spotted at CVS',  '1zSIabQG2jdtn3_daeaZL3CCOmOTELCKw', 'Spotted at CVS - May 2024 (parent of the Content folder)'],
  ['aa58fc27-bc14-4a83-ae0a-22a65ff9bbfb', 'Epic Sale Fall 2025',   '1lLfGX3NvHk0JCfge9YwoQbBdxFLyiaHa', 'Epic Beauty - Fall — 0 media, root only per decision 2'],
];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// Spreadsheet URLs share a long common prefix, so a plain truncation hides the
// one part that matters. Render them as "sheet <8 chars>… gid=<n>" instead.
function show(v) {
  if (v === null || v === undefined) return 'null';
  const s = String(v);
  const m = s.match(/\/spreadsheets\/d\/([\w-]+)/);
  if (m) {
    const gid = (s.match(/[#&?]gid=(\d+)/) || [, 'none'])[1];
    return `sheet ${m[1].slice(0, 8)}…  gid=${gid}`;
  }
  return s;
}

async function run(label, column, changes) {
  console.log(`\n${'='.repeat(78)}\n${label}  (${changes.length} rows)\n${'='.repeat(78)}`);
  let changed = 0, already = 0, failed = 0;

  for (const [id, name, value, why] of changes) {
    const { data: before, error: readErr } = await supabase
      .from('campaign_recaps').select(`id,name,${column}`).eq('id', id).single();

    if (readErr || !before) { console.log(`  ✗ ${name}: row not found (${readErr?.message ?? 'no row'})`); failed++; continue; }

    const old = before[column] ?? null;
    if (old === value) { console.log(`  = ${name}\n      already ${show(value)}`); already++; continue; }

    console.log(`  ${APPLY ? '→' : '·'} ${name}   (${why})`);
    console.log(`      old: ${show(old)}`);
    console.log(`      new: ${show(value)}`);

    if (APPLY) {
      const { error } = await supabase.from('campaign_recaps').update({ [column]: value }).eq('id', id);
      if (error) { console.log(`      ✗ FAILED: ${error.message}`); failed++; continue; }
    }
    changed++;
  }
  console.log(`\n  ${APPLY ? 'applied' : 'would change'}: ${changed}   already correct: ${already}   failed: ${failed}`);
  return { changed, already, failed };
}

(async () => {
  console.log(APPLY ? '*** APPLY MODE — writing to Supabase ***' : '*** DRY RUN — no writes. Pass --apply to write. ***');
  const a = await run('1. tracker_url', 'tracker_url', TRACKER);
  const b = await run('2. drive_content_folder_id', 'drive_content_folder_id', CONTENT);
  const c = await run('3. drive_folder_id', 'drive_folder_id', ROOT);

  const tot = (k) => a[k] + b[k] + c[k];
  console.log(`\n${'='.repeat(78)}`);
  console.log(`TOTAL  ${APPLY ? 'applied' : 'would change'}: ${tot('changed')}   already correct: ${tot('already')}   failed: ${tot('failed')}`);
  console.log(`${'='.repeat(78)}`);
  console.log('\nDeliberately NOT touched (see the audit report):');
  console.log('  · Community Captains tracker_url — tab choice still open (decision 6)');
  console.log('  · PNW Content tracker_url — keeps its standalone sheet (decision 5)');
  console.log('  · CVS Holiday Phase 2 + Phase 3 — held, 1 media file only (decision 3)');
  console.log('  · Summer/SPF, Halloween, ExtraCare December, Mother\'s Day 2025 — root already correct, content stays null (decision 2)');
  console.log('  · 26 Spring Epic Beauty merge — scripts/cvs-26-spring-merge.js, run after this');
  console.log('  · CVS x IU Event 2026 Photos — left unlinked (decision 8)');
  console.log('  · lifecycle_status, published, media ingest — out of scope per brief');
  if (tot('failed')) process.exit(1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
