// ============================================================
// GET /api/metrics/campaign/[campaignId] — Aggregate metrics
// Returns totals, averages, and top 3 performing assets
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

type RouteContext = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { campaignId } = await context.params;

  // Fetch all metrics rows for this campaign
  const { data: rows, error } = await supabase
    .from('asset_metrics')
    .select('*')
    .eq('campaign_id', campaignId);

  if (error) {
    console.error('Error fetching campaign metrics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({
      campaign_id: campaignId,
      total_views: 0,
      total_likes: 0,
      total_comments: 0,
      total_shares: 0,
      total_saves: 0,
      total_reach: 0,
      avg_engagement_rate: 0,
      asset_count: 0,
      top_performing: [],
    });
  }

  // Aggregate totals (use d7 metrics as the primary snapshot)
  const totals = rows.reduce(
    (acc, row) => {
      acc.total_views += row.d7_views || 0;
      acc.total_likes += row.d7_likes || 0;
      acc.total_comments += row.d7_comments || 0;
      acc.total_shares += row.d7_shares || 0;
      acc.total_saves += row.d7_saves || 0;
      acc.total_reach += row.d7_reach || 0;
      acc.engagement_sum += row.d7_engagement_rate || 0;
      acc.engagement_count += row.d7_engagement_rate ? 1 : 0;
      return acc;
    },
    {
      total_views: 0,
      total_likes: 0,
      total_comments: 0,
      total_shares: 0,
      total_saves: 0,
      total_reach: 0,
      engagement_sum: 0,
      engagement_count: 0,
    }
  );

  const avg_engagement_rate =
    totals.engagement_count > 0
      ? Math.round((totals.engagement_sum / totals.engagement_count) * 100) / 100
      : 0;

  // Top 3 assets by d7_views
  const top_performing = [...rows]
    .sort((a, b) => (b.d7_views || 0) - (a.d7_views || 0))
    .slice(0, 3)
    .map((row) => ({
      id: row.id,
      athlete_name: row.athlete_name,
      platform: row.platform,
      live_url: row.live_url,
      d7_views: row.d7_views,
      d7_engagement_rate: row.d7_engagement_rate,
      performance_tier: row.performance_tier,
    }));

  return NextResponse.json({
    campaign_id: campaignId,
    total_views: totals.total_views,
    total_likes: totals.total_likes,
    total_comments: totals.total_comments,
    total_shares: totals.total_shares,
    total_saves: totals.total_saves,
    total_reach: totals.total_reach,
    avg_engagement_rate,
    asset_count: rows.length,
    top_performing,
  });
}
