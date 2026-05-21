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
    // Simple rejection — mark the job as rejected
    await supabase
      .from('edit_jobs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

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

    // Mark the original job as rejected
    await supabase
      .from('edit_jobs')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

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
