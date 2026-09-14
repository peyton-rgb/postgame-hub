#!/usr/bin/env node
// scripts/cvs-26-spring-merge.js
// ─────────────────────────────────────────────────────────────
// Brief 07 / decision 7 — merge the duplicate "26 Spring Epic Beauty" rows.
//
// Two campaign_recaps rows carry this name:
//   A  4dd34b3c…  Hub-native, lifecycle=closed, published, 418 athletes,
//                 30 media, hero + thumbnail, Drive folder w/ 203 media.
//                 admin_campaign_id holds a UUID, not the usual numeric id.
//   B  83702fc8…  admin 857, draft, unpublished, and completely empty —
//                 0 athletes, 0 media, 0 rosters, no folder.
//
// A absorbs B, then B is deleted:
//   · A.admin_campaign_id  ← '857'   (A's UUID is recorded in the log first)
//   · A.tracker_url        ← B's corrected 2026 tracker link (gid 1684065158)
//   · A.tracker_sheet_id   ← B's sheet id
//   · B deleted
//
// Carrying tracker_url across is what makes this a merge rather than a
// delete: the main Phase B script fixed B's gid, and that fix would be lost
// when B goes. A has no tracker link of its own.
//
// Run AFTER scripts/cvs-tracker-phase-b.js.
//   node --env-file=.env.local scripts/cvs-26-spring-merge.js          (dry run)
//   node --env-file=.env.local scripts/cvs-26-spring-merge.js --apply  (writes)
//
// The delete is irreversible, so before removing B the script re-checks every
// table that references a campaign and aborts if anything at all points at B.
// B's full row is written to docs/briefs/runs/ first.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const A = '4dd34b3c-8929-4130-887a-d388ca21f0b1'; // keep
const B = '83702fc8-579a-465d-9fa9-79595c13de56'; // delete

// Every table holding a campaign reference, and the column it uses.
const REFS = [
  ['asset_metrics','campaign_id'], ['asset_packages','campaign_recap_id'], ['athletes','campaign_id'],
  ['bts_submissions','campaign_id'], ['campaign_briefs','campaign_id'], ['campaign_rosters','campaign_id'],
  ['collab_containers','campaign_id'], ['content_queue','campaign_id'], ['contracts','campaign_id'],
  ['deal_tracker','campaign_id'], ['final_assets','campaign_id'], ['inspo_items','campaign_id'],
  ['media','campaign_id'], ['media_campaigns','campaign_recap_id'], ['moodboards','campaign_id'],
  ['pages','campaign_id'], ['posting_packages','campaign_id'], ['recap_intake_flags','campaign_id'],
  ['review_sessions','campaign_id'], ['slot_assignments','recap_id'], ['submission_links','campaign_id'],
  ['submissions','campaign_id'], ['tasks','campaign_id'], ['tier3_submissions','campaign_id'],
  ['tier3_submissions','recap_id'],
];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function refCounts(id) {
  const found = [];
  for (const [table, col] of REFS) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, id);
    if (error) { found.push([`${table}.${col}`, `ERROR ${error.message}`]); continue; }
    if (count) found.push([`${table}.${col}`, count]);
  }
  return found;
}

(async () => {
  console.log(APPLY ? '*** APPLY MODE — writing to Supabase ***' : '*** DRY RUN — no writes. Pass --apply to write. ***');

  const { data: rows, error } = await supabase.from('campaign_recaps')
    .select('*').in('id', [A, B]);
  if (error) throw error;

  const a = rows.find(r => r.id === A);
  const b = rows.find(r => r.id === B);
  if (!a) { console.error(`\n✗ Row A (${A}) not found — nothing to merge into. Aborting.`); process.exit(1); }
  if (!b) { console.log(`\n= Row B (${B}) is already gone. Merge appears to have run already.`); }

  console.log('\n──────────── A — surviving row ────────────');
  console.log(`  id                 ${a.id}`);
  console.log(`  name / slug        ${a.name}  /  ${a.slug}`);
  console.log(`  lifecycle / pub    ${a.lifecycle_status} / ${a.published}`);
  console.log(`  admin_campaign_id  ${a.admin_campaign_id}`);
  console.log(`  tracker_url        ${a.tracker_url ?? 'null'}`);
  console.log(`  drive_folder_id    ${a.drive_folder_id ?? 'null'}`);
  const aRefs = await refCounts(A);
  console.log(`  references         ${aRefs.map(([k, v]) => `${k}=${v}`).join('  ') || '(none)'}`);

  if (b) {
    console.log('\n──────────── B — row to delete ────────────');
    console.log(`  id                 ${b.id}`);
    console.log(`  name / slug        ${b.name}  /  ${b.slug}`);
    console.log(`  lifecycle / pub    ${b.lifecycle_status} / ${b.published}`);
    console.log(`  admin_campaign_id  ${b.admin_campaign_id}`);
    console.log(`  tracker_url        ${b.tracker_url ?? 'null'}`);
    console.log(`  drive_folder_id    ${b.drive_folder_id ?? 'null'}`);

    const bRefs = await refCounts(B);
    console.log(`  references         ${bRefs.map(([k, v]) => `${k}=${v}`).join('  ') || '(none)'}`);

    if (bRefs.length) {
      console.error('\n✗ ABORT — B is not empty. Something references it:');
      bRefs.forEach(([k, v]) => console.error(`     ${k} = ${v}`));
      console.error('  The audit found B empty; that has changed. Re-check before deleting.');
      process.exit(1);
    }
  }

  console.log('\n──────────── changes ────────────');
  const patch = {};
  if (b) {
    if (a.admin_campaign_id !== '857')      { console.log(`  admin_campaign_id   old: ${a.admin_campaign_id}\n                      new: 857`); patch.admin_campaign_id = '857'; }
    if (!a.tracker_url && b.tracker_url)    { console.log(`  tracker_url         old: null\n                      new: ${b.tracker_url}`); patch.tracker_url = b.tracker_url; }
    if (!a.tracker_sheet_id && b.tracker_sheet_id) { console.log(`  tracker_sheet_id    old: null\n                      new: ${b.tracker_sheet_id}`); patch.tracker_sheet_id = b.tracker_sheet_id; }
    console.log(`  delete row B        ${B}`);
  }
  if (!Object.keys(patch).length && !b) { console.log('  (nothing to do)'); return; }

  if (!APPLY) { console.log('\nDry run — no writes. Re-run with --apply.'); return; }

  // Back up B before it goes.
  if (b) {
    const out = path.resolve(__dirname, '..', 'docs', 'briefs', 'runs', 'cvs-26-spring-merge-deleted-row.json');
    fs.writeFileSync(out, JSON.stringify({ deleted_at: new Date().toISOString(), merged_into: A, row: b }, null, 2));
    console.log(`\n  backup written: ${path.relative(path.resolve(__dirname, '..'), out)}`);
  }

  if (Object.keys(patch).length) {
    const { error: uErr } = await supabase.from('campaign_recaps').update(patch).eq('id', A);
    if (uErr) { console.error(`✗ update of A failed: ${uErr.message} — B NOT deleted.`); process.exit(1); }
    console.log('  ✓ A updated');
  }

  if (b) {
    const { error: dErr } = await supabase.from('campaign_recaps').delete().eq('id', B);
    if (dErr) { console.error(`✗ delete of B failed: ${dErr.message}`); process.exit(1); }
    console.log('  ✓ B deleted');
  }

  const { data: after } = await supabase.from('campaign_recaps')
    .select('id,name,lifecycle_status,published,admin_campaign_id,tracker_url').eq('id', A).single();
  console.log('\n──────────── after ────────────');
  console.log(`  ${after.name}  ${after.lifecycle_status}/${after.published}  admin=${after.admin_campaign_id}`);
  console.log(`  tracker_url: ${after.tracker_url}`);
  const { count: dupes } = await supabase.from('campaign_recaps')
    .select('*', { count: 'exact', head: true }).eq('name', '26 Spring Epic Beauty');
  console.log(`  rows now named "26 Spring Epic Beauty": ${dupes}`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
