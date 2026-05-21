// ============================================================
// Approve Review — POST /api/reviews/[id]/approve
//
// Two-gate approval system:
//   1. If status is 'pending_internal' → moves to 'pending_brand'
//      (Postgame team has approved, now waiting for brand sign-off)
//   2. If status is 'pending_brand' → moves to 'approved'
//      AND creates a final_assets row for delivery tracking
//
// This enforces the workflow: internal review first, then brand.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const reviewId = params.id;

  // Fetch the current review session
  const { data: review, error: reviewError } = await supabase
    .from('review_sessions')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (reviewError || !review) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  // --- Gate 1: Internal approval → pending brand ---
  if (review.status === 'pending_internal') {
    const { data: updated, error: updateError } = await supabase
      .from('review_sessions')
      .update({
        status: 'pending_brand',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to approve internally: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Add an approval comment for the audit trail
    await supabase.from('review_comments').insert({
      session_id: reviewId,
      author_type: 'postgame',
      comment_type: 'approval',
      body: 'Approved internally — sent to brand for review.',
      is_resolved: false,
    });

    return NextResponse.json({
      message: 'Approved internally — now pending brand review',
      review: updated,
    });
  }

  // --- Gate 2: Brand approval → approved + create final asset ---
  if (review.status === 'pending_brand') {
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('review_sessions')
      .update({
        status: 'approved',
        brand_decision: 'approved',
        brand_decided_at: now,
        updated_at: now,
      })
      .eq('id', reviewId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Failed to approve: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Create a final_assets row for delivery tracking
    const { error: assetError } = await supabase.from('final_assets').insert({
      campaign_id: review.campaign_id || null,
      review_session_id: reviewId,
      creator_brief_id: review.creator_brief_id || null,
      title: review.asset_name || 'Untitled Asset',
      asset_type: 'video',
      file_url: review.video_url,
      athlete_name: review.athlete_name || null,
      status: 'ready',
      notes: review.notes || null,
      created_by: user.id,
    });

    if (assetError) {
      // Don't fail the approval — just log the error
      console.error('[approve-review] Failed to create final asset:', assetError);
    }

    // Add an approval comment
    await supabase.from('review_comments').insert({
      session_id: reviewId,
      author_type: 'brand',
      comment_type: 'approval',
      body: 'Brand approved — asset ready for delivery.',
      is_resolved: false,
    });

    return NextResponse.json({
      message: 'Brand approved — final asset created',
      review: updated,
    });
  }

  // Not in an approvable state
  return NextResponse.json(
    {
      error: `Review is in "${review.status}" status — can only approve from "pending_internal" or "pending_brand"`,
    },
    { status: 400 }
  );
}
