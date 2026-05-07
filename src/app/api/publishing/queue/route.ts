// ============================================================
// /api/publishing/queue
// GET  — List content_queue items (filter by ?status, ?channel)
// POST — Add a new item to the content queue
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
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');

  let query = supabase
    .from('content_queue')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }
  if (channel) {
    query = query.eq('channel', channel);
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
    'inspo_item_ids', 'template_type', 'channel', 'caption',
    'hashtags', 'asset_url', 'asset_urls', 'thumbnail_url',
    'status', 'scheduled_for', 'notes', 'campaign_id',
    'final_asset_id', 'athlete_name',
  ];

  const insert: Record<string, unknown> = {
    created_by: user.id,
    status: 'draft',
  };

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      insert[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from('content_queue')
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
