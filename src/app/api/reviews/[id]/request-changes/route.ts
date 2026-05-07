// ============================================================
// POST /api/reviews/[id]/request-changes
// Sets status to 'revision_requested', increments revision_round,
// and records the feedback in the session notes.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

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
  const { data: session, error: fetchError } = await supabase
    .from('review_sessions')
    .select('id, status, revision_round')
    .eq('id', params.id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  if (session.status === 'approved') {
    return NextResponse.json(
      { error: 'Cannot request changes on an already-approved session' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const feedback = body.feedback || body.notes || null;

  const { data, error } = await supabase
    .from('review_sessions')
    .update({
      status: 'revision_requested',
      brand_decision: 'revision_requested',
      brand_decided_at: new Date().toISOString(),
      revision_round: (session.revision_round || 1) + 1,
      notes: feedback,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error requesting changes on review session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
