// ============================================================
// GET /api/editing/jobs/[id]
// Returns { job, steps } where steps are ordered by step_number.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceSupabase } from '@/lib/supabase';
import type { EditJob, EditStep } from '@/lib/types/editing';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
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
  const [{ data: job, error: jobError }, { data: steps, error: stepsError }] = await Promise.all([
    db.from('edit_jobs').select('*').eq('id', params.id).single(),
    db.from('edit_steps').select('*').eq('edit_job_id', params.id).order('step_number', { ascending: true }),
  ]);

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message || 'Job not found' },
      { status: 404 }
    );
  }

  if (stepsError) {
    console.error('edit_steps load failed:', stepsError);
  }

  return NextResponse.json({
    job: job as EditJob,
    steps: (steps as EditStep[]) || [],
  });
}
