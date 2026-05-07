// ============================================================
// POST /api/reviews/[id]/approve
// Marks a review session as approved — sets status to 'approved',
// brand_decision to 'approved', and brand_decided_at to now.
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

  // Verify the session exists and is in a reviewable state
  const { data: session, error: fetchError } = await supabase
    .from('review_sessions')
    .select('id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  if (session.status === 'approved') {
    return NextResponse.json({ error: 'Session is already approved' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('review_sessions')
    .update({
      status: 'approved',
      brand_decision: 'approved',
      brand_decided_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error approving review session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
