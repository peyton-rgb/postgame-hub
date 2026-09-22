// ============================================================
// Approve Edit — POST /api/editing/jobs/[id]/approve
//
// Called when a CM reviews the before/after comparison and
// approves the result. This:
//   1. Sets the job status to "approved"
//   2. Records who approved it
//   3. Optionally creates a new inspo_items row for the edited asset
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
      { error: `Job is in "${job.status}" status — can only approve jobs in "review" status` },
      { status: 400 }
    );
  }

  // Parse optional body — CM can choose to save as new inspo item
  let saveAsInspo = false;
  try {
    const body = await request.json();
    saveAsInspo = body.save_as_inspo === true;
  } catch {
    // No body is fine — just approve without saving to inspo
  }

  // Update job to approved
  const { error: updateError } = await supabase
    .from('edit_jobs')
    .update({
      status: 'approved',
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to approve: ${updateError.message}` },
      { status: 500 }
    );
  }

  // Optionally save the edited asset as a new inspo item.
  //
  // This insert has never once succeeded. It failed on two counts, and because
  // the error is logged and swallowed rather than surfaced, nobody noticed:
  //
  //   1. `uploaded_by` is not a column on inspo_items, so PostgREST rejected
  //      the whole insert against its schema cache.
  //   2. 'ai_edited' was not a value of content_source_enum. The accompanying
  //      migration adds it.
  //
  // The approver is recorded in `notes` instead, which is where the rest of
  // this row's provenance already lives.
  if (saveAsInspo && job.output_url) {
    const { error: inspoError } = await supabase
      .from('inspo_items')
      .insert({
        file_url: job.output_url,
        thumbnail_url: job.output_thumbnail_url || job.output_url,
        content_type: job.content_type === 'video' ? 'produced' : 'photography',
        source: 'ai_edited',
        tagging_status: 'pending', // will need to be tagged
        notes: `AI-edited from job ${jobId}, approved by ${user.id}. Original instruction: "${job.instruction}"`,
      });

    if (inspoError) {
      // Don't fail the approval — just log the error
      console.error('[approve] Failed to create inspo item:', inspoError);
    }
  }

  return NextResponse.json({ message: 'Edit approved', job_id: jobId });
}
