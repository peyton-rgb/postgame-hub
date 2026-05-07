// ============================================================
// POST /api/editing/jobs/[id]/reject — STUB.
// Body: { reject?: boolean } | { request_changes: string }
// Real implementation either rejects the job or chains a follow-up
// job via parent_job_id when request_changes is provided.
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
    { error: 'Not implemented — reject / request-changes handler pending' },
    { status: 501 }
  );
}
