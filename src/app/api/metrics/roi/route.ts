// ============================================================
// GET /api/metrics/roi — Cross-campaign ROI summary
// Joins campaign_briefs to asset_metrics for cost-per metrics
// Uses service role client for the cross-table query
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  // Auth check with cookie-based client
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Service role client for the aggregation query
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all campaigns
  const { data: campaigns, error: campError } = await serviceClient
    .from('campaign_briefs')
    .select('id, name, budget')
    .is('parent_brief_id', null)
    .order('created_at', { ascending: false });

  if (campError) {
    console.error('Error fetching campaigns for ROI:', campError);
    return NextResponse.json({ error: campError.message }, { status: 500 });
  }

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch all metrics in one query (more efficient than N+1)
  const campaignIds = campaigns.map((c) => c.id);
  const { data: allMetrics, error: metricsError } = await serviceClient
    .from('asset_metrics')
    .select('campaign_id, d7_views, d7_likes, d7_comments, d7_shares, d7_saves, d7_engagement_rate')
    .in('campaign_id', campaignIds);

  if (metricsError) {
    console.error('Error fetching metrics for ROI:', metricsError);
    return NextResponse.json({ error: metricsError.message }, { status: 500 });
  }

  // Group metrics by campaign
  const metricsByCampaign = new Map<string, typeof allMetrics>();
  for (const row of allMetrics || []) {
    if (!row.campaign_id) continue;
    const arr = metricsByCampaign.get(row.campaign_id) || [];
    arr.push(row);
    metricsByCampaign.set(row.campaign_id, arr);
  }

  // Build ROI summary per campaign
  const results = campaigns.map((campaign) => {
    const rows = metricsByCampaign.get(campaign.id) || [];
    const asset_count = rows.length;

    const total_views = rows.reduce((s, r) => s + (r.d7_views || 0), 0);
    const total_engagement = rows.reduce(
      (s, r) => s + (r.d7_likes || 0) + (r.d7_comments || 0) + (r.d7_shares || 0) + (r.d7_saves || 0),
      0
    );

    const engagementRates = rows
      .map((r) => r.d7_engagement_rate)
      .filter((v): v is number => v !== null && v !== undefined);
    const avg_engagement_rate =
      engagementRates.length > 0
        ? Math.round((engagementRates.reduce((s, v) => s + v, 0) / engagementRates.length) * 100) / 100
        : 0;

    const budget = campaign.budget || 0;
    const cost_per_view = total_views > 0 ? Math.round((budget / total_views) * 100) / 100 : null;
    const cost_per_engagement = total_engagement > 0 ? Math.round((budget / total_engagement) * 100) / 100 : null;

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      budget,
      total_views,
      total_engagement,
      cost_per_view,
      cost_per_engagement,
      asset_count,
      avg_engagement_rate,
    };
  });

  return NextResponse.json(results);
}
