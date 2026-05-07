// ============================================================
// /api/publishing/packages/[id]
// GET    — Fetch a single posting package
// PATCH  — Update fields (status, captions, live_url, posted_at, etc.)
// DELETE — Remove a posting package
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('posting_packages')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  const allowedFields = [
    'campaign_id', 'inspo_item_id', 'athlete_name', 'athlete_id',
    'delivery_token', 'video_url', 'caption_short', 'caption_medium',
    'caption_long', 'hashtags', 'mentions', 'platform_notes',
    'ftc_note', 'posting_window_start', 'posting_window_end',
    'status', 'sent_at', 'confirmed_at', 'intended_post_date',
    'posted_at', 'live_url', 'am_notes', 'brief_id',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    );
  }

  // Auto-set timestamp fields on status transitions
  if (body.status === 'sent' && !body.sent_at) {
    updates.sent_at = new Date().toISOString();
  }
  if (body.status === 'confirmed' && !body.confirmed_at) {
    updates.confirmed_at = new Date().toISOString();
  }
  if (body.status === 'posted' && !body.posted_at) {
    updates.posted_at = new Date().toISOString();
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('posting_packages')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { error } = await supabase
    .from('posting_packages')
    .delete()
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
