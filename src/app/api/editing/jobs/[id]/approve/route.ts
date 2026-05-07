// ============================================================
// POST /api/editing/jobs/[id]/approve
// Body: { save_as_inspo?: boolean }
//
// Flips the job to 'approved' and stamps approved_by. If
// save_as_inspo is true and the job has an output_url, also
// inserts a row into inspo_items with triage_status='approved'
// so the result becomes immediately reusable in the library.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceSupabase } from '@/lib/supabase';
import type { EditJob } from '@/lib/types/editing';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const body = (await request.json().catch(() => ({}))) as { save_as_inspo?: boolean };
  const saveAsInspo = body.save_as_inspo === true;

  const db = createServiceSupabase();

  const { data: job, error: fetchError } = await db
    .from('edit_jobs')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const { data: updated, error: updateError } = await db
    .from('edit_jobs')
    .update({
      status: 'approved',
      approved_by: user.id,
    })
    .eq('id', params.id)
    .select('*')
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let inspoId: string | null = null;
  let inspoWarning: string | null = null;

  if (saveAsInspo) {
    if (!job.output_url) {
      inspoWarning = 'save_as_inspo was requested but the job has no output_url';
    } else {
      const { data: inspoRow, error: inspoError } = await db
        .from('inspo_items')
        .insert({
          file_url: job.output_url,
          thumbnail_url: job.output_url,
          content_type: job.content_type,
          source: 'ai_edit',
          triage_status: 'approved',
          visual_description: job.instruction,
        })
        .select('id')
        .single();

      if (inspoError) {
        console.error('Save to inspo failed:', inspoError);
        inspoWarning = inspoError.message;
      } else {
        inspoId = inspoRow?.id ?? null;
      }
    }
  }

  return NextResponse.json({
    job: updated as EditJob,
    inspo_item_id: inspoId,
    inspo_warning: inspoWarning,
  });
}
