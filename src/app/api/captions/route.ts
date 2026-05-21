// ============================================================
// GET /api/captions — List content queue items with filters
// POST /api/captions — Create a new content queue item
//
// The content_queue table is the backbone of Station 4
// (Distribution). Every piece of content that will be posted
// passes through this queue as a draft → approved → scheduled
// → published (or failed) lifecycle.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');
  const campaignId = searchParams.get('campaign_id');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let query = supabase
    .from('content_queue')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }
  if (channel) {
    query = query.eq('channel', channel);
  }
  if (campaignId) {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data, total: count });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.channel) {
    return NextResponse.json(
      { error: 'channel is required' },
      { status: 400 }
    );
  }

  const record = {
    channel: body.channel,
    caption: body.caption || null,
    hashtags: body.hashtags || [],
    asset_url: body.asset_url || null,
    asset_urls: body.asset_urls || [],
    inspo_item_ids: body.inspo_item_ids || [],
    template_type: body.template_type || null,
    thumbnail_url: body.thumbnail_url || null,
    campaign_id: body.campaign_id || null,
    final_asset_id: body.final_asset_id || null,
    athlete_name: body.athlete_name || null,
    notes: body.notes || null,
    scheduled_for: body.scheduled_for || null,
    status: 'draft',
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from('content_queue')
    .insert(record)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
