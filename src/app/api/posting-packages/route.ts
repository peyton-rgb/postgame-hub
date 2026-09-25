// ============================================================
// GET /api/posting-packages  — List posting packages
// POST /api/posting-packages — Create a new posting package
//
// Posting packages are delivery bundles sent to athletes/creators.
// They contain the video, caption variants, hashtags, FTC notes,
// and posting window — everything an athlete needs to post.
//
// Staff only (access_level staff/admin/exec, the /dashboard boundary):
// 401 signed out, 403 signed in as anyone else. RLS on posting_packages
// enforces the same thing underneath (is_staff(), migration 073).
//
// GET returns STAFF_PACKAGE_COLUMNS — never am_notes, even to staff.
// ?posting_campaign_id= lists one posting campaign (the staff editor), and
// lifts the page size so a whole roster comes back in one call. That form
// also returns `photos`, the carousel photos of every Feed post in the
// campaign grouped by package id, so the roster can count them without a
// request per row.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getHubStaff } from '@/lib/staff-auth';
import {
  PHOTO_COLUMNS,
  STAFF_PACKAGE_COLUMNS,
  groupPhotos,
  type PostingPhoto,
  type StaffPackage,
  LINK_COLUMNS,
  STORY_COLUMNS,
  groupLinks,
  type PostLinkRow,
  type PostLinks,
  type StoryShot,
} from '@/lib/posting-packages';

function denied(reason: 'anon' | 'forbidden') {
  return reason === 'anon'
    ? NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    : NextResponse.json({ error: 'Staff only' }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const staff = await getHubStaff();
  if (!staff.ok) return denied(staff.reason);
  const supabase = createServerSupabase();

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');
  const postingCampaignId = searchParams.get('posting_campaign_id');
  const athleteName = searchParams.get('athlete_name');
  const status = searchParams.get('status');
  const maxLimit = postingCampaignId ? 1000 : 200;
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || (postingCampaignId ? '1000' : '50'), 10) || 50, 1),
    maxLimit
  );
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  let query = supabase
    .from('posting_packages')
    .select(STAFF_PACKAGE_COLUMNS, { count: 'exact' })
    .order(postingCampaignId ? 'intended_post_date' : 'created_at', {
      ascending: !!postingCampaignId,
      nullsFirst: false,
    })
    .range(offset, offset + limit - 1);

  if (postingCampaignId) {
    query = query.eq('posting_campaign_id', postingCampaignId);
  }
  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }
  if (athleteName) {
    query = query.eq('athlete_name', athleteName);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const packages = (data as unknown as StaffPackage[] | null) ?? [];

  // Carousel photos for the whole roster in one go. Only the editor needs
  // them, so the unfiltered list stays exactly as it was.
  let photos: Record<string, PostingPhoto[]> = {};
  if (postingCampaignId && packages.length) {
    const { data: photoRows, error: photoError } = await supabase
      .from('posting_package_files')
      .select(PHOTO_COLUMNS)
      .in('package_id', packages.map((p) => p.id))
      .eq('kind', 'photo')
      .order('position', { ascending: true });
    if (photoError) {
      return NextResponse.json({ error: photoError.message }, { status: 500 });
    }
    photos = groupPhotos((photoRows as unknown as PostingPhoto[] | null) ?? []);
  }

  // Where each post is up (migration 075): the three platform links and the
  // Story screenshot. Before 075 the links table doesn't exist — logged and
  // read as "nothing in yet", so the roster still loads.
  let links: Record<string, PostLinks> = {};
  let stories: Record<string, StoryShot> = {};
  if (postingCampaignId && packages.length) {
    const ids = packages.map((p) => p.id);
    const [{ data: linkRows, error: linkError }, { data: storyRows, error: storyError }] = await Promise.all([
      supabase.from('posting_package_links').select(LINK_COLUMNS).in('package_id', ids),
      supabase
        .from('posting_package_files')
        .select(STORY_COLUMNS)
        .in('package_id', ids)
        .eq('kind', 'story_screenshot'),
    ]);
    if (linkError) console.error('[posting-packages] links not loaded:', linkError.message);
    if (storyError) console.error('[posting-packages] story screenshots not loaded:', storyError.message);
    links = groupLinks((linkRows as unknown as PostLinkRow[] | null) ?? []);
    for (const s of (storyRows as unknown as StoryShot[] | null) ?? []) stories[s.package_id] = s;
  }

  return NextResponse.json({ packages, total: count, photos, links, stories });
}

export async function POST(request: NextRequest) {
  const staff = await getHubStaff();
  if (!staff.ok) return denied(staff.reason);
  const supabase = createServerSupabase();

  const body = await request.json();

  if (!body.athlete_name) {
    return NextResponse.json(
      { error: 'athlete_name is required' },
      { status: 400 }
    );
  }

  const record = {
    campaign_id: body.campaign_id || null,
    inspo_item_id: body.inspo_item_id || null,
    athlete_name: body.athlete_name,
    athlete_id: body.athlete_id || null,
    delivery_token: crypto.randomUUID(),
    video_url: body.video_url || null,
    caption_short: body.caption_short || null,
    caption_medium: body.caption_medium || null,
    caption_long: body.caption_long || null,
    hashtags: body.hashtags || [],
    mentions: body.mentions || [],
    platform_notes: body.platform_notes || null,
    ftc_note: body.ftc_note || null,
    posting_window_start: body.posting_window_start || null,
    posting_window_end: body.posting_window_end || null,
    intended_post_date: body.intended_post_date || null,
    am_notes: body.am_notes || null,
    brief_id: body.brief_id || null,
    status: 'draft',
  };

  const { data, error } = await supabase
    .from('posting_packages')
    .insert(record)
    .select(STAFF_PACKAGE_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
