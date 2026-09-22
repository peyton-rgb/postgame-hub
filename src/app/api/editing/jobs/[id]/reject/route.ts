// ============================================================
// Reject Edit — POST /api/editing/jobs/[id]/reject
//
// Called when a CM reviews the result and either:
//   - Rejects it outright (status → "rejected")
//   - Requests changes (creates a new chained job)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

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

  // Parse the body
  let body: {
    action: 'reject' | 'request_changes';
    feedback?: string;
    new_instruction?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Verify the job is in "review" status
  const { data: job, error: jobError } = await supabase
    .from('edit_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Edit job not found' }, { status: 404 });
  }

  if (job.status !== 'review') {
    return NextResponse.json(
      { error: `Job is in "${job.status}" status — can only reject jobs in "review" status` },
      { status: 400 }
    );
  }

  if (body.action === 'reject') {
    // Simple rejection — mark the job as rejected.
    //
    // `.select('id')` is not decoration: PostgREST returns no error when zero
    // rows match, so an update that hits nothing reads as success. Asking for
    // the row back is the only way to tell "rejected" from "matched nothing".
    const { data: rejected, error: rejectError } = await supabase
      .from('edit_jobs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('id');

    if (rejectError) {
      return NextResponse.json(
        { error: `Failed to reject: ${rejectError.message}` },
        { status: 500 }
      );
    }
    if (!rejected || rejected.length === 0) {
      return NextResponse.json(
        { error: 'Reject matched no job — it may have been changed by someone else. Reload and try again.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: 'Edit rejected', job_id: jobId });
  }

  if (body.action === 'request_changes') {
    // Create a new chained job that starts from the current output
    // This lets the pipeline re-edit without starting from scratch
    const newInstruction = body.new_instruction || body.feedback || job.instruction;
    const sourceUrl = job.output_url || job.source_url;

    const { data: newJob, error: newJobError } = await supabase
      .from('edit_jobs')
      .insert({
        asset_id: job.asset_id,
        source_url: sourceUrl,
        content_type: job.content_type,
        instruction: newInstruction,
        reference_image_url: job.reference_image_url,
        parent_job_id: jobId, // chain reference
        created_by: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (newJobError || !newJob) {
      return NextResponse.json(
        { error: `Failed to create re-edit job: ${newJobError?.message}` },
        { status: 500 }
      );
    }

    // Mark the original job as rejected.
    //
    // This is the compounding case, and the reason it cannot stay unchecked:
    // the re-edit job above has ALREADY been created. If this update fails and
    // we report success, the caller is told both halves worked while the
    // original sits in `review` forever — it will be offered for approval again
    // alongside its own replacement.
    //
    // The new job is not rolled back, because it is real work that succeeded
    // and destroying it would lose the chain. The response says exactly what
    // happened instead, so whoever sees it can finish the job by hand.
    const { data: closed, error: closeError } = await supabase
      .from('edit_jobs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('id');

    if (closeError || !closed || closed.length === 0) {
      return NextResponse.json(
        {
          error:
            `The re-edit job was created, but the original could not be closed` +
            `${closeError ? `: ${closeError.message}` : ' — it matched no row'}. ` +
            `Job ${jobId} is still in review and needs rejecting by hand.`,
          original_job_id: jobId,
          new_job_id: newJob.id,
          original_still_in_review: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Changes requested — new edit job created',
      original_job_id: jobId,
      new_job_id: newJob.id,
    });
  }

  return NextResponse.json(
    { error: 'action must be "reject" or "request_changes"' },
    { status: 400 }
  );
}
