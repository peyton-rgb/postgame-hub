// ============================================================
// POST /api/analytics/[id]/score — AI Performance Scoring
//
// Calls the Analytics Agent to analyze an asset's D7 metrics
// and assign a performance tier (S/A/B/C/D) with rationale.
// Updates both the asset_metrics row AND the linked
// inspo_items.performance_tier for cross-station consistency.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { scorePerformance } from '@/lib/agents/analytics-agent';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch the metrics record with joined inspo_item data
  const { data: metrics, error: fetchError } = await supabase
    .from('asset_metrics')
    .select(`
      *,
      inspo_item:inspo_items!inspo_item_id (
        id,
        content_type,
        visual_description,
        sport,
        thumbnail_url
      )
    `)
    .eq('id', params.id)
    .single();

  if (fetchError || !metrics) {
    return NextResponse.json(
      { error: 'Metrics record not found' },
      { status: 404 }
    );
  }

  // Validate that D7 data exists — can't score without it
  if (metrics.d7_views == null && metrics.d7_engagement_rate == null) {
    return NextResponse.json(
      { error: 'Cannot score without D7 metrics. Log D7 data first.' },
      { status: 400 }
    );
  }

  try {
    // Call the Analytics Agent to score
    const result = await scorePerformance(metrics);

    const now = new Date().toISOString();

    // Update asset_metrics with the tier
    const { error: updateError } = await supabase
      .from('asset_metrics')
      .update({
        performance_tier: result.tier,
        tier_scored_at: now,
        tier_rationale: result.rationale,
      })
      .eq('id', params.id);

    if (updateError) {
      console.error('Failed to update asset_metrics tier:', updateError);
      return NextResponse.json(
        { error: 'Scoring succeeded but failed to save: ' + updateError.message },
        { status: 500 }
      );
    }

    // Also update the linked inspo_items performance_tier
    if (metrics.inspo_item_id) {
      const { error: inspoError } = await supabase
        .from('inspo_items')
        .update({ performance_tier: result.tier })
        .eq('id', metrics.inspo_item_id);

      if (inspoError) {
        console.warn('Failed to sync tier to inspo_items:', inspoError.message);
        // Non-fatal — the asset_metrics tier is the source of truth
      }
    }

    return NextResponse.json({
      tier: result.tier,
      rationale: result.rationale,
      scored_at: now,
    });
  } catch (err) {
    console.error('Analytics scoring failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Scoring failed' },
      { status: 500 }
    );
  }
}
