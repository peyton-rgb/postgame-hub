// ============================================================
// GET  /api/assets — List final assets (with filters + pagination)
// POST /api/assets — Create a new final asset
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

// GET: Fetch final assets with optional filters and pagination
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const assetType = searchParams.get('asset_type');
  const campaignId = searchParams.get('campaign_id');
  const athleteName = searchParams.get('athlete_name');
  const brandName = searchParams.get('brand_name');
  const search = searchParams.get('q');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = supabase
    .from('final_assets')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (assetType) query = query.eq('asset_type', assetType);
  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (athleteName) query = query.ilike('athlete_name', `%${athleteName}%`);
  if (brandName) query = query.ilike('brand_name', `%${brandName}%`);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching final assets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data, total: count });
}

// POST: Create a new final asset — status defaults to 'ready'
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  // Validate required fields
  if (!body.title || !body.asset_type || !body.file_url) {
    return NextResponse.json(
      { error: 'title, asset_type, and file_url are required' },
      { status: 400 }
    );
  }

  const validTypes = ['video', 'photo', 'graphic'];
  if (!validTypes.includes(body.asset_type)) {
    return NextResponse.json(
      { error: `asset_type must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }

  const insertData = {
    title: body.title,
    asset_type: body.asset_type,
    file_url: body.file_url,
    thumbnail_url: body.thumbnail_url || null,
    file_size_bytes: body.file_size_bytes || null,
    duration_seconds: body.duration_seconds || null,
    width: body.width || null,
    height: body.height || null,
    campaign_id: body.campaign_id || null,
    review_session_id: body.review_session_id || null,
    concept_id: body.concept_id || null,
    creator_brief_id: body.creator_brief_id || null,
    athlete_name: body.athlete_name || null,
    brand_name: body.brand_name || null,
    tags: body.tags || [],
    notes: body.notes || null,
    status: 'ready',
    created_by: user.email || user.id,
  };

  const { data, error } = await supabase
    .from('final_assets')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Error creating final asset:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
