// ============================================================
// Single Edit Job API — GET /api/editing/jobs/[id]
//
// Returns the full edit job with all its steps.
// Used by the review page and the editing dashboard
// to show job details and real-time progress.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const jobId = params.id;

  // Fetch the job
  const { data: job, error: jobError } = await supabase
    .from('edit_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message || 'Edit job not found' },
      { status: 404 }
    );
  }

  // Fetch associated steps
  const { data: steps, error: stepsError } = await supabase
    .from('edit_steps')
    .select('*')
    .eq('edit_job_id', jobId)
    .order('step_number', { ascending: true });

  if (stepsError) {
    return NextResponse.json({ error: stepsError.message }, { status: 500 });
  }

  return NextResponse.json({
    job,
    steps: steps ?? [],
  });
}
