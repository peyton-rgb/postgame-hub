// ============================================================
// POST /api/editing/jobs/[id]/retry — STUB.
// Real implementation either resumes the orchestrator from the
// failed step or restarts the pipeline from scratch.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(
  _request: NextRequest,
  _ctx: { params: { id: string } }
) {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json(
    { error: 'Not implemented — retry handler pending' },
    { status: 501 }
  );
}
