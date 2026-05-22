// ============================================================
// Reviews API — GET (list) and POST (create)
//
// GET /api/reviews?status=pending_internal&limit=20&offset=0
//   Lists review sessions with optional filters for status,
//   campaign_id, and athlete_name. Sorted newest first.
//
// POST /api/reviews
//   Creates a new review session with auto-generated tokens
//   for brand, agency, and editor access.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import crypto from 'crypto';

// --- GET: List review sessions ---

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const campaignId = searchParams.get('campaign_id');
  const athleteName = searchParams.get('athlete_name');
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Build query
  let query = supabase
    .from('review_sessions')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }
  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }
  if (athleteName) {
    query = query.ilike('athlete_name', `%${athleteName}%`);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    reviews: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}

// --- POST: Create a new review session ---

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Parse the request body
  let body: {
    inspo_item_id?: string;
    video_url: string;
    asset_name: string;
    campaign_id?: string;
    brief_id?: string;
    creator_brief_id?: string;
    athlete_name?: string;
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.video_url || !body.asset_name) {
    return NextResponse.json(
      { error: 'video_url and asset_name are required' },
      { status: 400 }
    );
  }

  // Generate unique tokens for external reviewers
  const brandToken = crypto.randomUUID();
  const agencyToken = crypto.randomUUID();
  const editorToken = crypto.randomUUID();

  // Create the review session
  const { data: review, error: insertError } = await supabase
    .from('review_sessions')
    .insert({
      inspo_item_id: body.inspo_item_id || null,
      video_url: body.video_url,
      asset_name: body.asset_name,
      campaign_id: body.campaign_id || null,
      brief_id: body.brief_id || null,
      creator_brief_id: body.creator_brief_id || null,
      athlete_name: body.athlete_name || null,
      notes: body.notes || null,
      brand_token: brandToken,
      agency_token: agencyToken,
      editor_token: editorToken,
      status: 'pending_internal',
      version_number: 1,
      revision_round: 1,
    })
    .select()
    .single();

  if (insertError || !review) {
    return NextResponse.json(
      { error: `Failed to create review session: ${insertError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ review }, { status: 201 });
}
