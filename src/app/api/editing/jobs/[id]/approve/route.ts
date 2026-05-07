// ============================================================
// POST /api/editing/jobs/[id]/approve — STUB.
// Body: { save_as_inspo?: boolean }
// Real implementation flips status to 'approved' and optionally
// inserts the output into inspo_items.
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
    { error: 'Not implemented — approval handler pending' },
    { status: 501 }
  );
}
