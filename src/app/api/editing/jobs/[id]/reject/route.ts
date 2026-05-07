// ============================================================
// POST /api/editing/jobs/[id]/reject
//
// Two modes (the body shape is permissive — both the new
// { action: 'reject' } / { action: 'request_changes', new_instruction }
// contract and the older { reject } / { request_changes } form work):
//
//   reject           → set status='rejected'
//   request_changes  → create a new edit_jobs row with parent_job_id
//                       set, source_url = the current job's output_url,
//                       and the CM's revised instruction. Returns
//                       { new_job_id } so the UI can navigate to it.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceSupabase } from '@/lib/supabase';
import type { EditJob } from '@/lib/types/editing';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RejectBody {
  action?: 'reject' | 'request_changes';
  new_instruction?: string;
  // Older shape from the initial UI:
  reject?: boolean;
  request_changes?: string;
}

export async function POST(
  request: NextRequest,
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

  const body = (await request.json().catch(() => ({}))) as RejectBody;

  // Normalize the action — accept both body shapes.
  let mode: 'reject' | 'request_changes' | null = null;
  let newInstruction: string | null = null;

  if (body.action === 'reject' || body.reject === true) {
    mode = 'reject';
  } else if (
    body.action === 'request_changes' ||
    (typeof body.request_changes === 'string' && body.request_changes.trim()) ||
    (typeof body.new_instruction === 'string' && body.new_instruction.trim())
  ) {
    mode = 'request_changes';
    newInstruction = (body.new_instruction || body.request_changes || '').trim() || null;
  }

  if (!mode) {
    return NextResponse.json(
      { error: 'Provide action: "reject" or { action: "request_changes", new_instruction }' },
      { status: 400 }
    );
  }

  const db = createServiceSupabase();
  const { data: job, error: fetchError } = await db
    .from('edit_jobs')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (mode === 'reject') {
    const { error: updateError } = await db
      .from('edit_jobs')
      .update({ status: 'rejected' })
      .eq('id', params.id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, action: 'reject' });
  }

  // request_changes — chain a new pending job whose source is the prior output.
  if (!newInstruction) {
    return NextResponse.json(
      { error: 'new_instruction (or request_changes) is required for request_changes' },
      { status: 400 }
    );
  }
  if (!job.output_url) {
    return NextResponse.json(
      { error: 'Cannot request changes: the parent job has no output_url to iterate on' },
      { status: 409 }
    );
  }

  const { data: childJob, error: insertError } = await db
    .from('edit_jobs')
    .insert({
      asset_id: job.asset_id,
      source_url: job.output_url,
      content_type: job.content_type,
      instruction: newInstruction,
      reference_image_url: job.reference_image_url,
      status: 'pending',
      parent_job_id: job.id,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (insertError || !childJob) {
    return NextResponse.json(
      { error: insertError?.message || 'Failed to create follow-up job' },
      { status: 500 }
    );
  }

  // Mark the parent rejected so the queue reflects that it's been superseded.
  await db
    .from('edit_jobs')
    .update({ status: 'rejected' })
    .eq('id', params.id);

  return NextResponse.json({
    success: true,
    action: 'request_changes',
    new_job_id: childJob.id,
    new_job: childJob as EditJob,
  });
}
