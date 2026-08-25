// ============================================================
// Reject Review — POST /api/reviews/[id]/reject
//
// Called when a brand (or internal reviewer) requests changes.
// This:
//   1. Sets brand_decision to 'changes_requested'
//   2. Increments revision_round
//   3. Sets status to 'revision_requested'
//   4. Saves the rejection feedback as a review_comment
//
// The editor can then make changes and re-submit the asset.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { applyDeliverableTransition, compileBrandFeedback } from '@/lib/deliverable-transitions';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  const reviewId = params.id;

  // Parse the rejection body
  let body: {
    body: string;
    author_type?: 'postgame' | 'brand' | 'agency' | 'editor';
    // The brand has no account — it authenticates with this session's token.
    token?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.body || !body.body.trim()) {
    return NextResponse.json(
      { error: 'body is required — provide feedback for the revision' },
      { status: 400 }
    );
  }

  // Fetch the current review session
  const { data: review, error: reviewError } = await supabase
    .from('review_sessions')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (reviewError || !review) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  // Signed-in staff, or the brand holding this session's own token.
  const isBrandCaller = !!body.token && body.token === review.brand_token;
  if (!user && !isBrandCaller) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Can only reject from pending_internal or pending_brand
  const rejectableStatuses = ['pending_internal', 'pending_brand'];
  if (!rejectableStatuses.includes(review.status)) {
    return NextResponse.json(
      {
        error: `Review is in "${review.status}" status — can only reject from "pending_internal" or "pending_brand"`,
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const newRevisionRound = (review.revision_round || 1) + 1;

  // Update the review session
  const { data: updated, error: updateError } = await supabase
    .from('review_sessions')
    .update({
      status: 'revision_requested',
      brand_decision: 'changes_requested',
      brand_decided_at: now,
      revision_round: newRevisionRound,
      updated_at: now,
    })
    .eq('id', reviewId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to reject: ${updateError.message}` },
      { status: 500 }
    );
  }

  // Save the rejection feedback as a comment
  const authorType = body.author_type || (review.status === 'pending_brand' ? 'brand' : 'postgame');

  const { error: commentError } = await supabase.from('review_comments').insert({
    session_id: reviewId,
    author_type: authorType,
    comment_type: 'revision',
    body: body.body.trim(),
    is_resolved: false,
  });

  if (commentError) {
    console.error('[reject-review] Failed to save rejection comment:', commentError);
  }

  // Send the deliverable back — to in_edit, not changes_requested. A brand
  // send-back usually means Postgame acts first; an employee reads the compiled
  // feedback, edits it, and only then sends it on to the athlete.
  //
  // Compiled AFTER the comment insert above so this rejection's own words are
  // included. Conditional on deliverable_id: inspo sessions have none.
  if (review.deliverable_id) {
    const note = await compileBrandFeedback(reviewId);
    const t = await applyDeliverableTransition(review.deliverable_id, 'brand_reject', { note });
    if (!t.ok) console.error('[reject-review] brand_reject:', t.error);
  }

  return NextResponse.json({
    message: `Changes requested — revision round ${newRevisionRound}`,
    review: updated,
  });
}
