// ============================================================
// DELETE /api/posting-packages/[id]/places — staff clear one place a post is up
// Body: { place: 'instagram' | 'tiktok' | 'x' | 'story' }
//
// Staff only, on the staff member's own session (RLS: is_staff()).
//   • a link: deletes that platform's posting_package_links row. Clearing the
//     Instagram link also clears live_url when it holds the same link, so the
//     athlete page offers the step again.
//   • story: deletes the story_screenshot row, then its file through the
//     Storage API (service role — the bucket is written server-side only).
//
// posted_at is NEVER unset here: a post already marked Posted (the payment
// trigger) stays marked, and the panel shows a warning line instead.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/supabase-server';
import { getHubStaff } from '@/lib/staff-auth';
import { removeUpload } from '@/lib/drive-import';
import { LINK_COLUMNS, STORY_COLUMNS, groupLinks, type PostLinkRow, type StoryShot } from '@/lib/posting-packages';

export const dynamic = 'force-dynamic';

const PLACES = ['instagram', 'tiktok', 'x', 'story'] as const;
type Place = (typeof PLACES)[number];

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await getHubStaff();
  if (!staff.ok) {
    return NextResponse.json(
      { error: staff.reason === 'anon' ? 'Not authenticated' : 'Staff only' },
      { status: staff.reason === 'anon' ? 401 : 403 }
    );
  }
  const body = await request.json().catch(() => ({}));
  const place = body?.place as Place;
  if (!PLACES.includes(place)) {
    return NextResponse.json({ error: "place must be 'instagram', 'tiktok', 'x' or 'story'" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data: pkg, error: pkgError } = await supabase
    .from('posting_packages')
    .select('id, live_url')
    .eq('id', params.id)
    .maybeSingle();
  if (pkgError) return NextResponse.json({ error: pkgError.message }, { status: 500 });
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

  if (place === 'story') {
    const { data: shot, error } = await supabase
      .from('posting_package_files')
      .select(STORY_COLUMNS)
      .eq('package_id', pkg.id)
      .eq('kind', 'story_screenshot')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (shot) {
      const { error: delError } = await supabase
        .from('posting_package_files')
        .delete()
        .eq('id', (shot as unknown as StoryShot).id)
        .eq('kind', 'story_screenshot');
      if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
      const path = (shot as unknown as StoryShot).storage_path;
      // Only ever a file this feature stored for this post.
      if (path && path.startsWith(`posting/story-screenshots/${pkg.id}/`)) {
        await removeUpload(createServiceSupabase(), path).catch((e) =>
          console.error('[posting places] screenshot file not removed:', path, e)
        );
      }
    }
  } else {
    const { data: row, error } = await supabase
      .from('posting_package_links')
      .select(LINK_COLUMNS)
      .eq('package_id', pkg.id)
      .eq('platform', place)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const removed = row as unknown as PostLinkRow | null;
    if (removed) {
      const { error: delError } = await supabase.from('posting_package_links').delete().eq('id', removed.id);
      if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });
    }
    if (place === 'instagram' && pkg.live_url && (!removed || pkg.live_url === removed.url)) {
      const { error: liveError } = await supabase
        .from('posting_packages')
        .update({ live_url: null, updated_at: new Date().toISOString() })
        .eq('id', pkg.id);
      if (liveError) return NextResponse.json({ error: liveError.message }, { status: 500 });
    }
  }

  // Answer with what's left, so the panel can re-render from the truth.
  const [{ data: linkRows }, { data: storyRow }] = await Promise.all([
    supabase.from('posting_package_links').select(LINK_COLUMNS).eq('package_id', pkg.id),
    supabase.from('posting_package_files').select(STORY_COLUMNS).eq('package_id', pkg.id).eq('kind', 'story_screenshot').maybeSingle(),
  ]);
  const { data: fresh } = await supabase.from('posting_packages').select('live_url, posted_at, status').eq('id', pkg.id).maybeSingle();
  return NextResponse.json({
    links: groupLinks((linkRows as unknown as PostLinkRow[] | null) ?? [])[pkg.id] ?? {},
    story: (storyRow as unknown as StoryShot | null) ?? null,
    package: fresh,
  });
}
