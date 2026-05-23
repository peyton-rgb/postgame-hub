#!/usr/bin/env node
// One-off cleanup: remove the 4 Isaiah Nolan images that bypassed the cap=5
// during the post-TUS retry. Deletes media + media_campaigns + media_athletes,
// then removes storage objects via the Storage API (direct SQL DELETE on
// storage.objects is blocked by a protective trigger).

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Run with --env-file=.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const MEDIA_IDS = [
  '0004a196-9d72-48eb-9c2f-1c0f000fe765', // DSG-05
  '5d5ca409-9426-40e7-a860-20bdf5fd2f13', // DSG-11
  'bdd9c369-bdc0-47f7-9431-d98da539a495', // DSG-10
  '619c3f88-6493-4ed3-a172-134eae876344', // DSG-12
];
const STORAGE_PATHS = [
  'diamond-sports-dicks/isaiah-nolan/1c8WkjSUhXUg-Isaiah-Nolan-DSG-05.jpg',
  'diamond-sports-dicks/isaiah-nolan/1buPUly6VL_J-Isaiah-Nolan-DSG-11.jpg',
  'diamond-sports-dicks/isaiah-nolan/1ErxFV9byak4-Isaiah-Nolan-DSG-10.jpg',
  'diamond-sports-dicks/isaiah-nolan/1QJi1BnCiIhg-Isaiah-Nolan-DSG-12.jpg',
];

async function main() {
  // Sanity check.
  const { data: present, error: e0 } = await supabase
    .from('media')
    .select('id, file_url')
    .in('id', MEDIA_IDS);
  if (e0) throw e0;
  console.log(`Confirmed ${present.length} of ${MEDIA_IDS.length} media rows present:`);
  for (const r of present) console.log(`  - ${r.id}  ${r.file_url}`);

  // FK rows first.
  let { error: e1 } = await supabase.from('media_athletes').delete().in('media_id', MEDIA_IDS);
  if (e1) throw new Error(`media_athletes delete failed: ${e1.message}`);
  let { error: e2 } = await supabase.from('media_campaigns').delete().in('media_id', MEDIA_IDS);
  if (e2) throw new Error(`media_campaigns delete failed: ${e2.message}`);
  // media rows.
  let { error: e3 } = await supabase.from('media').delete().in('id', MEDIA_IDS);
  if (e3) throw new Error(`media delete failed: ${e3.message}`);
  console.log('Deleted DB rows.');

  // Storage objects.
  const { data: rm, error: e4 } = await supabase.storage.from('campaign-media').remove(STORAGE_PATHS);
  if (e4) throw new Error(`storage remove failed: ${e4.message}`);
  console.log(`Removed ${rm.length} storage object(s).`);

  // Verify.
  const { count: media_left, error: e5 } = await supabase
    .from('media')
    .select('id', { count: 'exact', head: true })
    .in('id', MEDIA_IDS);
  if (e5) throw e5;
  console.log(`media rows remaining for those ids: ${media_left}`);

  const isaiahId = (await supabase
    .from('athletes')
    .select('id')
    .eq('campaign_id', '9b5a651f-9225-4a9f-bbd1-a72d0a994a98')
    .eq('name', 'Isaiah Nolan')
    .single()).data?.id;
  const { data: links } = await supabase
    .from('media_athletes')
    .select('media:media!inner(type)')
    .eq('athlete_id', isaiahId);
  const imgs = links.filter(l => l.media.type === 'image').length;
  const vids = links.filter(l => l.media.type === 'video').length;
  console.log(`Isaiah Nolan now: ${imgs} image(s) + ${vids} video(s)`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
