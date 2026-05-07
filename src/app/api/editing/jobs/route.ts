// ============================================================
// /api/editing/jobs — list + create edit jobs.
//
// STUB:
//   GET  returns []
//   POST returns 501
//
// The real implementation kicks off the video evaluator + edit
// planner pipeline asynchronously. Returning [] for GET keeps the
// queue UI alive while we wait for the integration code to land.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(_request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json([]);
}

export async function POST(_request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Not implemented — editing pipeline pending' },
    { status: 501 }
  );
}
