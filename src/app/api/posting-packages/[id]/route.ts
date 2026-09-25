// ============================================================
// GET /api/posting-packages/[id]   — Fetch a single posting package
// PATCH /api/posting-packages/[id] — Update a posting package
//
// Staff only (access_level staff/admin/exec): 401 signed out, 403 otherwise.
// Returns STAFF_PACKAGE_COLUMNS — never am_notes.
//
// PATCH rules on top of the allowed-field list:
//   • caption_status / video_status must be Awaiting Approval | In Revision |
//     Approved; status must be one of the table's CHECK values.
//   • status → 'sent' stamps sent_at (first time only).
//   • A post going Posted is the athlete's PAYMENT TRIGGER. Staff setting
//     status 'posted' or a first posted_at by hand therefore needs
//     `confirm: true`.
//   • live_url is the INSTAGRAM link (migration 075). Setting it saves the
//     instagram row in posting_package_links too, and no longer marks the post
//     Posted by itself: like the athlete side, maybeMarkPosted() does that
//     only once Instagram, TikTok, X and the Story screenshot are all in.
//     Clearing a link is DELETE …/places.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { getHubStaff } from '@/lib/staff-auth';
import { checkPlatformLink } from '@/lib/post-link';
import { maybeMarkPosted } from '@/lib/deliver-package';
import {
  CAPTION_LIMIT,
  PACKAGE_STATUSES,
  REVIEW_STATUSES,
  STAFF_PACKAGE_COLUMNS,
} from '@/lib/posting-packages';

function denied(reason: 'anon' | 'forbidden') {
  return reason === 'anon'
    ? NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    : NextResponse.json({ error: 'Staff only' }, { status: 403 });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await getHubStaff();
  if (!staff.ok) return denied(staff.reason);
  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from('posting_packages')
    .select(STAFF_PACKAGE_COLUMNS)
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

const allowedFields = [
  'athlete_name', 'athlete_id', 'video_url', 'caption_short',
  'caption_medium', 'caption_long', 'hashtags', 'mentions',
  'platform_notes', 'ftc_note', 'posting_window_start',
  'posting_window_end', 'intended_post_date', 'status',
  'sent_at', 'confirmed_at', 'posted_at', 'live_url',
  'am_notes', 'campaign_id', 'brief_id',
  // Staff editor (posting instructions, Phase 2)
  'school', 'ig_handle', 'cover_url', 'caption_status', 'video_status',
  'post_date_label', 'date_conditional',
];

// Text fields where an empty string means "clear it".
const NULLABLE_TEXT = ['school', 'ig_handle', 'post_date_label', 'caption_medium'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await getHubStaff();
  if (!staff.ok) return denied(staff.reason);
  const supabase = createServerSupabase();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return bad('Body must be a JSON object');

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // ---- shape checks ----
  for (const f of NULLABLE_TEXT) {
    if (!(f in updates)) continue;
    const v = updates[f];
    if (v !== null && typeof v !== 'string') return bad(`${f} must be text`);
    const t = typeof v === 'string' ? v.trim() : '';
    updates[f] = t ? (f === 'ig_handle' ? t.replace(/^@+/, '') : t) : null;
  }
  if (typeof updates.caption_medium === 'string' && updates.caption_medium.length > CAPTION_LIMIT) {
    return bad(`Caption is over ${CAPTION_LIMIT.toLocaleString()} characters`);
  }
  for (const f of ['caption_status', 'video_status'] as const) {
    if (f in updates && !(REVIEW_STATUSES as readonly unknown[]).includes(updates[f])) {
      return bad(`${f} must be one of: ${REVIEW_STATUSES.join(', ')}`);
    }
  }
  if ('status' in updates && !(PACKAGE_STATUSES as readonly unknown[]).includes(updates.status)) {
    return bad(`status must be one of: ${PACKAGE_STATUSES.join(', ')}`);
  }
  if ('date_conditional' in updates && typeof updates.date_conditional !== 'boolean') {
    return bad('date_conditional must be true or false');
  }
  if ('intended_post_date' in updates) {
    const d = updates.intended_post_date;
    if (d !== null && (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
      return bad('intended_post_date must be YYYY-MM-DD');
    }
  }

  // ---- lifecycle ----
  const { data: current, error: loadError } = await supabase
    .from('posting_packages')
    .select('status, sent_at, posted_at, live_url')
    .eq('id', params.id)
    .single();
  if (loadError || !current) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  const now = new Date().toISOString();

  let instagramSaved = false;
  if ('live_url' in updates) {
    if (updates.live_url === null || updates.live_url === '') {
      return bad("Clear a link from Where it's posted instead");
    }
    const check = checkPlatformLink('instagram', updates.live_url);
    if (!check.ok) return bad(check.error);
    if (check.url !== current.live_url) {
      if (current.live_url) {
        return NextResponse.json(
          { error: "There's already an Instagram link. Clear it under Where it's posted first." },
          { status: 409 }
        );
      }
      // The instagram row first; a row already there (unique) is the same 409.
      const { error: linkError } = await supabase
        .from('posting_package_links')
        .insert({ package_id: params.id, platform: 'instagram', url: check.url });
      if (linkError) {
        return linkError.code === '23505'
          ? NextResponse.json({ error: "There's already an Instagram link. Clear it under Where it's posted first." }, { status: 409 })
          : NextResponse.json({ error: linkError.message }, { status: 500 });
      }
      updates.live_url = check.url;
      instagramSaved = true;
    } else {
      delete updates.live_url; // unchanged
    }
  }

  if (updates.status === 'posted' && current.status !== 'posted' && body.confirm !== true) {
    return NextResponse.json(
      { error: 'Marking a post Posted starts payment. Send confirm: true to proceed.', needsConfirm: true },
      { status: 409 }
    );
  }

  // posted_at is on the allowed list too; stamping it is the same trigger.
  if (updates.posted_at && !current.posted_at && body.confirm !== true) {
    return NextResponse.json(
      { error: 'Setting posted_at starts payment. Send confirm: true to proceed.', needsConfirm: true },
      { status: 409 }
    );
  }

  if (updates.status === 'sent' && !current.sent_at && !('sent_at' in updates)) {
    updates.sent_at = now;
  }

  updates.updated_at = now;

  const { data, error } = await supabase
    .from('posting_packages')
    .update(updates)
    .eq('id', params.id)
    .select(STAFF_PACKAGE_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // The Instagram link may have been the fourth piece.
  if (instagramSaved && (await maybeMarkPosted(params.id))) {
    const { data: fresh } = await supabase
      .from('posting_packages')
      .select(STAFF_PACKAGE_COLUMNS)
      .eq('id', params.id)
      .single();
    return NextResponse.json(fresh ?? data);
  }

  return NextResponse.json(data);
}
