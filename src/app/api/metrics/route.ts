// ============================================================
// GET  /api/metrics — List asset_metrics (filterable)
// POST /api/metrics — Log a new metrics entry
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// GET: Fetch asset_metrics rows
// Supports query params: ?campaign_id=xxx&platform=xxx&performance_tier=xxx
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');
  const platform = searchParams.get('platform');
  const performanceTier = searchParams.get('performance_tier');

  let query = supabase
    .from('asset_metrics')
    .select('*')
    .order('created_at', { ascending: false });

  if (campaignId) query = query.eq('campaign_id', campaignId);
  if (platform) query = query.eq('platform', platform);
  if (performanceTier) query = query.eq('performance_tier', performanceTier);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching asset_metrics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Create a new metrics entry
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.platform || !body.live_url) {
    return NextResponse.json(
      { error: 'platform and live_url are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('asset_metrics')
    .insert({
      inspo_item_id: body.inspo_item_id || null,
      final_asset_id: body.final_asset_id || null,
      campaign_id: body.campaign_id || null,
      athlete_name: body.athlete_name || null,
      live_url: body.live_url,
      platform: body.platform,
      posted_at: body.posted_at || null,
      performance_tier: 'unscored',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating asset_metrics entry:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
