// ============================================================
// GET    /api/metrics/[id] — Fetch a single asset_metrics row
// PATCH  /api/metrics/[id] — Update d7/d30 metrics or tier
// DELETE /api/metrics/[id] — Remove a metrics entry
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

type RouteContext = { params: Promise<{ id: string }> };

// GET: Single metrics row by id
export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;

  const { data, error } = await supabase
    .from('asset_metrics')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching asset_metrics row:', error);
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH: Update d7 metrics, d30 metrics, or performance tier
export async function PATCH(request: NextRequest, context: RouteContext) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  // Allowlist of updatable columns
  const allowedFields = [
    'd7_logged_at', 'd7_views', 'd7_likes', 'd7_comments', 'd7_shares',
    'd7_saves', 'd7_reach', 'd7_impressions', 'd7_engagement_rate',
    'd30_logged_at', 'd30_views', 'd30_likes', 'd30_comments', 'd30_shares',
    'd30_saves', 'd30_reach', 'd30_engagement_rate',
    'performance_tier', 'tier_scored_at', 'tier_rationale',
    'live_url', 'platform', 'posted_at', 'athlete_name',
    'campaign_id', 'final_asset_id', 'inspo_item_id',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('asset_metrics')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating asset_metrics row:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: Remove a metrics entry
export async function DELETE(request: NextRequest, context: RouteContext) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;

  const { error } = await supabase
    .from('asset_metrics')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting asset_metrics row:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
