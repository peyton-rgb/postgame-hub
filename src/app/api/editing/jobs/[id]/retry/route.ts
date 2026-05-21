// ============================================================
// Retry Edit — POST /api/editing/jobs/[id]/retry
//
// Retries a failed job. Can either:
//   - Restart from scratch (re-run the full pipeline)
//   - Resume from the last failed step (if the job got
//     partway through execution)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { evaluateVideo } from '@/lib/agents/video-evaluator';
import { createEditPlan } from '@/lib/agents/edit-planner';
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

  // Verify the job exists and is failed
  const { data: job, error: jobError } = await supabase
    .from('edit_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Edit job not found' }, { status: 404 });
  }

  if (job.status !== 'failed') {
    return NextResponse.json(
      { error: `Job is in "${job.status}" status — can only retry failed jobs` },
      { status: 400 }
    );
  }

  // Check if we can resume (scene_map and edit_plan exist = failed during execution)
  const canResume = job.scene_map && job.edit_plan;

  // Parse optional body for retry mode
  let mode: 'restart' | 'resume' = canResume ? 'resume' : 'restart';
  try {
    const body = await request.json();
    if (body.mode === 'restart') mode = 'restart';
  } catch {
    // No body is fine — use default
  }

  if (mode === 'resume' && canResume) {
    // Resume from execution — the plan is already built
    // Reset failed steps to pending
    await supabase
      .from('edit_steps')
      .update({ status: 'pending', error_message: null, started_at: null, completed_at: null })
      .eq('edit_job_id', jobId)
      .eq('status', 'failed');

    // Fire off the orchestrator
    executeEditPlan(jobId, user.id).catch((err) => {
      console.error('[editing-retry-resume]', err);
    });

    return NextResponse.json({ message: 'Resuming from failed step', job_id: jobId, mode: 'resume' });
  }

  // Full restart — reset everything
  await supabase
    .from('edit_steps')
    .delete()
    .eq('edit_job_id', jobId);

  await supabase
    .from('edit_jobs')
    .update({
      status: 'pending',
      scene_map: null,
      edit_plan: null,
      estimated_cost_usd: null,
      actual_cost_usd: null,
      output_url: null,
      output_thumbnail_url: null,
      processing_time_seconds: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  // Re-run the full pipeline
  (async () => {
    try {
      const sceneMap = await evaluateVideo(
        {
          edit_job_id: jobId,
          source_url: job.source_url,
          content_type: job.content_type,
          instruction: job.instruction,
        },
        user.id
      );

      await createEditPlan(
        {
          edit_job_id: jobId,
          instruction: job.instruction,
          scene_map: sceneMap,
          content_type: job.content_type,
          reference_image_url: job.reference_image_url,
        },
        user.id
      );
    } catch (err) {
      console.error('[editing-retry-restart]', err);
    }
  })();

  return NextResponse.json({ message: 'Full retry started', job_id: jobId, mode: 'restart' });
}
