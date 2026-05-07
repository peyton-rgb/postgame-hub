// ============================================================
// /api/assets
// GET  — List final assets (filter by ?campaign_id, ?status, ?asset_type)
// POST — Create a new final asset
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
  const assetType = searchParams.get('asset_type');

  let query = supabase
    .from('final_assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (status) query = query.eq('status', status);
  if (assetType) query = query.eq('asset_type', assetType);

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

  // Required fields
  if (!body.title || !body.asset_type || !body.file_url) {
    return NextResponse.json(
      { error: 'title, asset_type, and file_url are required' },
      { status: 400 }
    );
  }

  const allowedFields = [
    'campaign_id', 'review_session_id', 'concept_id', 'creator_brief_id',
    'title', 'asset_type', 'file_url', 'thumbnail_url',
    'file_size_bytes', 'duration_seconds', 'width', 'height',
    'athlete_name', 'brand_name', 'tags', 'notes', 'status',
    'delivered_at', 'delivered_to',
  ];

  const insert: Record<string, unknown> = { created_by: user.id };
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      insert[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from('final_assets')
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
