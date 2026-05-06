// ============================================================
// GET /api/intake/queue — List inspo items by tagging status
//
// Returns items from inspo_items for the intake dashboard.
// Supports query params:
//   ?status=pending (default) — show items waiting to be tagged
//   ?status=tagged — show recently tagged items for review
//   ?status=failed — show items that failed tagging
//   ?status=all — show everything
//   ?limit=50 — how many to return (default 50)
//   ?brand_id=xxx — filter by brand
//   ?campaign_id=xxx — filter by campaign
// ============================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Read filters from query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const brandId = searchParams.get('brand_id');
  const campaignId = searchParams.get('campaign_id');

  // Build the query
  let query = supabase
    .from('inspo_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Filter by tagging status (unless "all" is requested)
  if (status !== 'all') {
    query = query.eq('tagging_status', status);
  }

  // Optional filters
  if (brandId) query = query.eq('brand_id', brandId);
  if (campaignId) query = query.eq('campaign_id', campaignId);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching intake queue:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch count summaries for the dashboard stats.
  // With { count: 'exact', head: true }, Supabase returns the count
  // in the response metadata, not in the data array.
  const { count: pendingCount } = await supabase
    .from('inspo_items')
    .select('id', { count: 'exact', head: true })
    .eq('tagging_status', 'pending');

  const { count: taggedCount } = await supabase
    .from('inspo_items')
    .select('id', { count: 'exact', head: true })
    .eq('tagging_status', 'tagged');

  const { count: failedCount } = await supabase
    .from('inspo_items')
    .select('id', { count: 'exact', head: true })
    .eq('tagging_status', 'failed');

  const { count: processingCount } = await supabase
    .from('inspo_items')
    .select('id', { count: 'exact', head: true })
    .eq('tagging_status', 'processing');

  return NextResponse.json({
    items: data,
    counts: {
      pending: pendingCount ?? 0,
      processing: processingCount ?? 0,
      tagged: taggedCount ?? 0,
      failed: failedCount ?? 0,
    },
  });
}
