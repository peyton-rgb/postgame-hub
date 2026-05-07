// ============================================================
// GET  /api/reviews/[id]/comments  — List comments for a review session
// POST /api/reviews/[id]/comments  — Add a comment to a review session
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error } = await supabase
    .from('review_comments')
    .select('*')
    .eq('session_id', params.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching review comments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Verify the session exists
  const { data: session, error: sessionError } = await supabase
    .from('review_sessions')
    .select('id')
    .eq('id', params.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  const body = await request.json();

  if (!body.body || !body.author_type) {
    return NextResponse.json(
      { error: 'body and author_type are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('review_comments')
    .insert({
      session_id: params.id,
      author_type: body.author_type,
      comment_type: body.comment_type || 'general',
      timestamp_seconds: body.timestamp_seconds ?? null,
      body: body.body,
      linked_brand_comment_id: body.linked_brand_comment_id || null,
      is_resolved: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating review comment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
