// ============================================================
// Single Review Session API — GET + PATCH
//
// GET /api/reviews/[id]
//   Returns a single review session with all its comments.
//
// PATCH /api/reviews/[id]
//   Updates mutable fields: status, notes, editor_deadline,
//   brand_decision, asset_name, video_url.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// --- GET: Single review with comments ---

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const reviewId = params.id;

  // Fetch the review session
  const { data: review, error: reviewError } = await supabase
    .from('review_sessions')
    .select('*')
    .eq('id', reviewId)
    .single();

  if (reviewError || !review) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  // Fetch comments for this session
  const { data: comments, error: commentsError } = await supabase
    .from('review_comments')
    .select('*')
    .eq('session_id', reviewId)
    .order('created_at', { ascending: true });

  if (commentsError) {
    return NextResponse.json(
      { error: `Failed to load comments: ${commentsError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    review,
    comments: comments ?? [],
  });
}

// --- PATCH: Update review session ---

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const reviewId = params.id;

  // Parse update fields
  let body: {
    status?: string;
    notes?: string;
    editor_deadline?: string;
    brand_decision?: string;
    asset_name?: string;
    video_url?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Verify the review exists
  const { data: existing, error: existingError } = await supabase
    .from('review_sessions')
    .select('id')
    .eq('id', reviewId)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  // Build the update payload — only include fields that were provided
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status !== undefined) updatePayload.status = body.status;
  if (body.notes !== undefined) updatePayload.notes = body.notes;
  if (body.editor_deadline !== undefined) updatePayload.editor_deadline = body.editor_deadline;
  if (body.brand_decision !== undefined) updatePayload.brand_decision = body.brand_decision;
  if (body.asset_name !== undefined) updatePayload.asset_name = body.asset_name;
  if (body.video_url !== undefined) updatePayload.video_url = body.video_url;

  const { data: updated, error: updateError } = await supabase
    .from('review_sessions')
    .update(updatePayload)
    .eq('id', reviewId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ review: updated });
}
