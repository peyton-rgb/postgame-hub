// ============================================================
// Review Comments API — GET + POST
//
// GET /api/reviews/[id]/comments
//   Returns all comments for a review session, ordered by
//   created_at ascending (oldest first, like a thread).
//
// POST /api/reviews/[id]/comments
//   Adds a new comment to the review session.
//   Accepts: author_type, comment_type, body, timestamp_seconds
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

// --- GET: List comments for a review session ---

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const sessionId = params.id;

  // Verify the session exists
  const { data: session, error: sessionError } = await supabase
    .from('review_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  // Fetch comments
  const { data: comments, error: commentsError } = await supabase
    .from('review_comments')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (commentsError) {
    return NextResponse.json(
      { error: `Failed to load comments: ${commentsError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ comments: comments ?? [] });
}

// --- POST: Add a comment ---

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const sessionId = params.id;

  // Parse the comment body
  let body: {
    author_type: 'postgame' | 'brand' | 'agency' | 'editor';
    comment_type: 'note' | 'revision' | 'approval';
    body: string;
    timestamp_seconds?: number;
    linked_brand_comment_id?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.author_type || !body.comment_type || !body.body) {
    return NextResponse.json(
      { error: 'author_type, comment_type, and body are required' },
      { status: 400 }
    );
  }

  const validAuthorTypes = ['postgame', 'brand', 'agency', 'editor'];
  if (!validAuthorTypes.includes(body.author_type)) {
    return NextResponse.json(
      { error: `author_type must be one of: ${validAuthorTypes.join(', ')}` },
      { status: 400 }
    );
  }

  const validCommentTypes = ['note', 'revision', 'approval'];
  if (!validCommentTypes.includes(body.comment_type)) {
    return NextResponse.json(
      { error: `comment_type must be one of: ${validCommentTypes.join(', ')}` },
      { status: 400 }
    );
  }

  // Verify the session exists
  const { data: session, error: sessionError } = await supabase
    .from('review_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  // Insert the comment
  const { data: comment, error: insertError } = await supabase
    .from('review_comments')
    .insert({
      session_id: sessionId,
      author_type: body.author_type,
      comment_type: body.comment_type,
      body: body.body,
      timestamp_seconds: body.timestamp_seconds ?? null,
      linked_brand_comment_id: body.linked_brand_comment_id ?? null,
      is_resolved: false,
    })
    .select()
    .single();

  if (insertError || !comment) {
    return NextResponse.json(
      { error: `Failed to add comment: ${insertError?.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ comment }, { status: 201 });
}
