// ============================================================
// POST /api/editing/jobs/[id]/retry
// Reset the job back to 'pending' so the orchestrator can re-run it.
// Clears any error fields on edit_steps for the same job.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceSupabase } from '@/lib/supabase';
import type { EditJob } from '@/lib/types/editing';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await createServerSupabase();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const db = createServiceSupabase();
  const { data: existing, error: fetchError } = await db
    .from('edit_jobs')
    .select('id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Clear failed step errors so the orchestrator gets a clean slate.
  await db
    .from('edit_steps')
    .update({ status: 'pending', error_message: null })
    .eq('edit_job_id', params.id)
    .eq('status', 'failed');

  const { data: updated, error: updateError } = await db
    .from('edit_jobs')
    .update({ status: 'pending' })
    .eq('id', params.id)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, job: updated as EditJob });
}
