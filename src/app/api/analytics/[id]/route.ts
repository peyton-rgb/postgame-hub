// ============================================================
// GET /api/analytics/[id]   — Fetch a single asset_metrics record
// PATCH /api/analytics/[id] — Update metrics (manual D7/D30 entry)
//
// GET joins with inspo_items to return full context (thumbnail,
// content type, visual description). PATCH allows CMs to manually
// log D7 and D30 performance data from platform analytics.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('asset_metrics')
    .select(`
      *,
      inspo_item:inspo_items!inspo_item_id (
        id,
        thumbnail_url,
        file_url,
        content_type,
        visual_description,
        sport,
        athlete_name,
        mime_type,
        pro_tags,
        social_tags,
        context_tags,
        search_phrases
      )
    `)
    .eq('id', params.id)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Metrics record not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  // Fields that can be updated via manual entry
  const allowedFields = [
    'live_url', 'platform', 'posted_at',
    // D7 metrics
    'd7_logged_at', 'd7_views', 'd7_likes', 'd7_comments', 'd7_shares',
    'd7_saves', 'd7_reach', 'd7_impressions', 'd7_engagement_rate',
    // D30 metrics
    'd30_logged_at', 'd30_views', 'd30_likes', 'd30_comments', 'd30_shares',
    'd30_saves', 'd30_reach', 'd30_engagement_rate',
    // Scoring
    'performance_tier', 'tier_scored_at', 'tier_rationale',
    // Associations
    'final_asset_id', 'campaign_id', 'athlete_name',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Auto-set logged_at timestamps when metrics are provided
  if (body.d7_views !== undefined && !body.d7_logged_at) {
    updates.d7_logged_at = new Date().toISOString();
  }
  if (body.d30_views !== undefined && !body.d30_logged_at) {
    updates.d30_logged_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('asset_metrics')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
