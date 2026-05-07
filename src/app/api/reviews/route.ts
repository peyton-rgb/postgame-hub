// ============================================================
// GET  /api/reviews  — List review sessions (filter by ?campaign_id or ?status)
// POST /api/reviews  — Create a new review session
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
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');
  const status = searchParams.get('status');

  let query = supabase
    .from('review_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching review sessions:', error);
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
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();

  if (!body.video_url || !body.asset_name) {
    return NextResponse.json(
      { error: 'video_url and asset_name are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('review_sessions')
    .insert({
      campaign_id: body.campaign_id || null,
      inspo_item_id: body.inspo_item_id || null,
      version_number: body.version_number || 1,
      video_url: body.video_url,
      video_duration_seconds: body.video_duration_seconds || null,
      status: 'draft',
      brand_decision: null,
      revision_round: 1,
      editor_deadline: body.editor_deadline || null,
      asset_name: body.asset_name,
      notes: body.notes || null,
      brief_id: body.brief_id || null,
      creator_brief_id: body.creator_brief_id || null,
      athlete_name: body.athlete_name || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating review session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
