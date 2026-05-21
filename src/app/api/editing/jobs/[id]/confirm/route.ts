// ============================================================
// Confirm Edit Plan — POST /api/editing/jobs/[id]/confirm
//
// Called when the CM reviews the edit plan (EDL) and cost
// estimate and clicks "Confirm & Run." This kicks off the
// Editing Orchestrator, which executes each step.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { executeEditPlan } from '@/lib/agents/editing-orchestrator';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const jobId = params.id;

  // Verify the job exists and is in "confirming" status
  const { data: job, error: jobError } = await supabase
    .from('edit_jobs')
    .select('id, status')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: 'Edit job not found' },
      { status: 404 }
    );
  }

  if (job.status !== 'confirming') {
    return NextResponse.json(
      { error: `Job is in "${job.status}" status — can only confirm jobs in "confirming" status` },
      { status: 400 }
    );
  }

  // Fire off the orchestrator in the background
  executeEditPlan(jobId, user.id).catch((err) => {
    console.error('[editing-orchestrator]', err);
  });

  return NextResponse.json({ message: 'Edit execution started', job_id: jobId });
}
