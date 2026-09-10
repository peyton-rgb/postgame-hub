#!/usr/bin/env node
// scripts/cvs-ingest-08-publish.js
// ─────────────────────────────────────────────────────────────
// Brief 08 Phase 2 — pick a hero and publish the 8 `delivered` CVS rows.
// Report: docs/briefs/runs/cvs-ingest-08.md
//
// The brief says "pick a hero — same rule as brief 04". Brief 04 defined no such
// rule: its docs never mention hero, and nothing in the app picks one (the column
// is only ever read as a card cover, `hero_image_url || thumbnail_url`, and set by
// hand in OptInEditor). So this uses the ranking the ingest already computes:
//
//   hero = the highest `quality_score` IMAGE imported for the campaign
//          (sharpness + contrast + resolution, the same score curation ranks by)
//
// Videos are excluded — the column feeds an <img>. A campaign with no imported
// image is left with a null hero rather than given a poster frame; that is
// surfaced in the log, not silently patched.
//
// Publishing: `update published = true` is enough on its own. Verified against the
// live schema — trg_sync_recap_publish_state sets status='published' in the same
// write, and trg_recap_lifecycle_status carries an explicit guard so a row that is
// already 'delivered' stays 'delivered' rather than flipping to 'closed'.
// (Brief 04's warning about that trigger predates the fix that landed in #260.)
//
// The three `active` rows are NOT touched — they are live campaigns.
//
// Run:  node --env-file=.env.local scripts/cvs-ingest-08-publish.js           # dry run
//       node --env-file=.env.local scripts/cvs-ingest-08-publish.js --apply   # writes
// ─────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');
const APPLY = process.argv.includes('--apply');

// The 7 delivered rows approved for publish. The 3 active ones (Community Captains,
// Fall ExtraCare x Epic, RX Strategic Markets) stay active and unpublished, and PNW
// Content is held back — see below.
const TARGETS = [
  ['43319346-4a04-4123-9df0-fc1b96e134ab', 'Bloomington CFP Event'],
  ['6e8b601f-1abc-4051-b17c-7ab03beddbde', 'CVS - Spotted at CVS'],
  ['971d344d-a526-4d3b-a221-00fef445972a', 'CVS Epic Beauty'],
  ['f2223120-0c9f-433a-91c0-a932a55c1162', 'CVS June'],
  ['66fb2d1f-2942-4cc6-991b-3ed940b52732', 'Epic Beauty + Unaltered Beauty'],
  ['165332db-856d-4a1a-a85d-6b1663577a7e', 'Extra Extra Big Deals January'],
  ['ec697283-d195-43ac-9644-f8e26421f5cd', "Valentine's Day"],
  // PNW Content is deliberately absent. It is `delivered`, but its ingest is still
  // gated behind an unrelated render batch and it has 0 media — publishing it would
  // put an empty campaign in the brand portal. Add it back once its media lands.
];

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  console.log(APPLY ? '*** APPLY MODE — writing to Supabase ***' : '*** DRY RUN — no writes. Pass --apply to write. ***');
  let heroSet = 0, published = 0, noImage = 0, failed = 0;

  for (const [id, label] of TARGETS) {
    const { data: row, error } = await supabase.from('campaign_recaps')
      .select('id,name,status,published,lifecycle_status,admin_is_active,hero_image_url,thumbnail_url')
      .eq('id', id).single();
    if (error || !row) { console.log(`\n✗ ${label}: row not found`); failed++; continue; }

    console.log(`\n── ${row.name}`);
    if (row.lifecycle_status !== 'delivered') {
      console.log(`   ✗ REFUSING — lifecycle_status is '${row.lifecycle_status}', expected 'delivered'. Skipped.`);
      failed++; continue;
    }

    // hero: best-quality image imported for this campaign
    const { data: best } = await supabase.from('media')
      .select('id,file_url,quality_score,type')
      .eq('campaign_id', id).eq('type', 'image')
      .order('quality_score', { ascending: false, nullsFirst: false })
      .limit(1);
    const hero = best?.[0] ?? null;

    const patch = {};
    if (!row.hero_image_url && hero) {
      console.log(`   hero_image_url  old: null`);
      console.log(`                   new: ${hero.file_url.slice(0, 78)}…  (quality_score ${hero.quality_score})`);
      patch.hero_image_url = hero.file_url;
    } else if (row.hero_image_url) {
      console.log(`   hero_image_url  already set — left alone`);
    } else {
      console.log(`   hero_image_url  ⚠ no image media for this campaign — left null (thumbnail_url ${row.thumbnail_url ? 'is set, card will use it' : 'also null'})`);
      noImage++;
    }

    if (!row.published) { console.log(`   published       old: false → new: true  (status ${row.status} → published; lifecycle stays delivered)`); patch.published = true; }
    else console.log(`   published       already true`);

    if (!Object.keys(patch).length) { console.log('   (nothing to do)'); continue; }

    if (APPLY) {
      const { error: uErr } = await supabase.from('campaign_recaps').update(patch).eq('id', id);
      if (uErr) { console.log(`   ✗ update failed: ${uErr.message}`); failed++; continue; }
      const { data: after } = await supabase.from('campaign_recaps')
        .select('status,published,lifecycle_status').eq('id', id).single();
      console.log(`   ✓ status=${after.status} published=${after.published} lifecycle_status=${after.lifecycle_status}`);
      if (after.lifecycle_status !== 'delivered') console.log(`   ⚠ lifecycle_status moved to '${after.lifecycle_status}' — expected delivered.`);
    }
    if (patch.hero_image_url) heroSet++;
    if (patch.published) published++;
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`TOTAL  heroes ${APPLY ? 'set' : 'to set'}: ${heroSet}   ${APPLY ? 'published' : 'to publish'}: ${published}   no image available: ${noImage}   failed: ${failed}`);
  console.log('\nNot touched (active): Community Captains, Fall ExtraCare x Epic, RX Strategic Markets');
  console.log('Held back (delivered, 0 media): PNW Content — publish once its ingest runs');
  if (failed) process.exit(1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
