// ============================================================
// GET /api/analytics — Asset Performance Metrics API
//
// Powers Station 5 (Analytics). Returns asset_metrics rows with
// joined inspo_items data (thumbnail, content_type). Supports
// filtering by campaign, athlete, platform, performance tier,
// and date range. Returns paginated results plus aggregate stats.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // ---- Parse query params ----
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');
  const athleteName = searchParams.get('athlete_name');
  const platform = searchParams.get('platform');
  const performanceTier = searchParams.get('performance_tier');
  const postedAfter = searchParams.get('posted_after');
  const postedBefore = searchParams.get('posted_before');
  const sort = searchParams.get('sort') || 'engagement';
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  try {
    // ---- Build data query ----
    // Join with inspo_items to get thumbnail_url, content_type
    let query = supabase
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
          mime_type
        )
      `);

    // Filters
    if (campaignId) query = query.eq('campaign_id', campaignId);
    if (athleteName) {
      const safeName = athleteName.replace(/%/g, '');
      query = query.ilike('athlete_name', `%${safeName}%`);
    }
    if (platform) query = query.eq('platform', platform);
    if (performanceTier) query = query.eq('performance_tier', performanceTier);
    if (postedAfter) query = query.gte('posted_at', postedAfter);
    if (postedBefore) query = query.lte('posted_at', postedBefore);

    // Sorting
    switch (sort) {
      case 'views':
        query = query.order('d7_views', { ascending: false, nullsFirst: false });
        break;
      case 'newest':
        query = query.order('posted_at', { ascending: false, nullsFirst: false });
        break;
      case 'engagement':
      default:
        query = query.order('d7_engagement_rate', { ascending: false, nullsFirst: false });
        break;
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching analytics:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ---- Aggregate stats query ----
    // We run a separate query for totals since Supabase doesn't support
    // aggregate functions on filtered sets easily. We use RPC or compute client-side.
    let aggQuery = supabase
      .from('asset_metrics')
      .select('d7_views, d7_likes, d7_comments, d7_shares, d7_saves, d7_engagement_rate, performance_tier');

    if (campaignId) aggQuery = aggQuery.eq('campaign_id', campaignId);
    if (athleteName) {
      const safeName = athleteName.replace(/%/g, '');
      aggQuery = aggQuery.ilike('athlete_name', `%${safeName}%`);
    }
    if (platform) aggQuery = aggQuery.eq('platform', platform);
    if (performanceTier) aggQuery = aggQuery.eq('performance_tier', performanceTier);
    if (postedAfter) aggQuery = aggQuery.gte('posted_at', postedAfter);
    if (postedBefore) aggQuery = aggQuery.lte('posted_at', postedBefore);

    const { data: aggData, error: aggError } = await aggQuery;

    let aggregates = {
      total_views: 0,
      total_likes: 0,
      total_engagements: 0,
      avg_engagement_rate: 0,
      count: 0,
      top_tier_count: 0,
    };

    if (!aggError && aggData && aggData.length > 0) {
      let sumViews = 0;
      let sumLikes = 0;
      let sumEngagements = 0;
      let sumEngRate = 0;
      let engRateCount = 0;
      let topTier = 0;

      for (const row of aggData) {
        sumViews += row.d7_views || 0;
        sumLikes += row.d7_likes || 0;
        sumEngagements += (row.d7_likes || 0) + (row.d7_comments || 0) + (row.d7_shares || 0) + (row.d7_saves || 0);
        if (row.d7_engagement_rate != null) {
          sumEngRate += Number(row.d7_engagement_rate);
          engRateCount++;
        }
        if (row.performance_tier === 'S' || row.performance_tier === 'A') {
          topTier++;
        }
      }

      aggregates = {
        total_views: sumViews,
        total_likes: sumLikes,
        total_engagements: sumEngagements,
        avg_engagement_rate: engRateCount > 0 ? Math.round((sumEngRate / engRateCount) * 100) / 100 : 0,
        count: aggData.length,
        top_tier_count: topTier,
      };
    }

    // ---- Count query with same filters ----
    let countQuery = supabase
      .from('asset_metrics')
      .select('id', { count: 'exact', head: true });

    if (campaignId) countQuery = countQuery.eq('campaign_id', campaignId);
    if (athleteName) {
      const safeName = athleteName.replace(/%/g, '');
      countQuery = countQuery.ilike('athlete_name', `%${safeName}%`);
    }
    if (platform) countQuery = countQuery.eq('platform', platform);
    if (performanceTier) countQuery = countQuery.eq('performance_tier', performanceTier);
    if (postedAfter) countQuery = countQuery.gte('posted_at', postedAfter);
    if (postedBefore) countQuery = countQuery.lte('posted_at', postedBefore);

    const { count } = await countQuery;

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
      aggregates,
    });
  } catch (err) {
    console.error('Unexpected error in /api/analytics:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
