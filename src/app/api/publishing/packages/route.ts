// ============================================================
// /api/publishing/packages
// GET  — List posting_packages (filter by ?campaign_id, ?status)
// POST — Create a new posting package
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');
  const status = searchParams.get('status');

  let query = supabase
    .from('posting_packages')
    .select('*')
    .order('created_at', { ascending: false });

  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
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
    'status', 'intended_post_date', 'am_notes', 'brief_id',
  ];

  const insert: Record<string, unknown> = {
    status: 'draft',
  };

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      insert[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from('posting_packages')
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
