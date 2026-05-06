// ============================================================
// POST /api/concepts/[id]/reject
// Rejects a concept with feedback.
// Body: { feedback: string }
// The feedback is logged for future tuning of the Creative Director.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { feedback } = body;

  if (!feedback) {
    return NextResponse.json(
      { error: 'Rejection feedback is required — it helps the AI learn.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('concepts')
    .update({
      status: 'rejected',
      rejection_feedback: feedback,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
