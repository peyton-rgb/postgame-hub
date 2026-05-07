// ============================================================
// GET    /api/reviews/[id]  — Fetch a single review session with its comments
// PATCH  /api/reviews/[id]  — Update status, notes, or brand_decision
// DELETE /api/reviews/[id]  — Soft-delete (set status to cancelled)
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
    .from('review_sessions')
    .select('*, review_comments(*)')
    .eq('id', params.id)
    .single();

  if (error) {
    console.error('Error fetching review session:', error);
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
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
  const { data: existing, error: fetchError } = await supabase
    .from('review_sessions')
    .select('id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Review session not found' }, { status: 404 });
  }

  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.brand_decision !== undefined) updates.brand_decision = body.brand_decision;
  if (body.video_url !== undefined) updates.video_url = body.video_url;
  if (body.video_duration_seconds !== undefined) updates.video_duration_seconds = body.video_duration_seconds;
  if (body.editor_deadline !== undefined) updates.editor_deadline = body.editor_deadline;
  if (body.asset_name !== undefined) updates.asset_name = body.asset_name;
  if (body.athlete_name !== undefined) updates.athlete_name = body.athlete_name;
  if (body.version_number !== undefined) updates.version_number = body.version_number;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('review_sessions')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating review session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
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
    .from('review_sessions')
    .update({ status: 'cancelled' })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('Error cancelling review session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
