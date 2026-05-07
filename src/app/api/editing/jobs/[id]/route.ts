// ============================================================
// GET /api/editing/jobs/[id] — STUB returning 404.
// Real implementation returns { job, steps }.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(
  _request: NextRequest,
  _ctx: { params: { id: string } }
) {
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
