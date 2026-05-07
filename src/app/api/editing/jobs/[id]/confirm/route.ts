// ============================================================
// POST /api/editing/jobs/[id]/confirm
// Move a job from 'confirming' (plan ready, awaiting CM approval)
// to 'editing' (orchestrator picks it up next). The actual
// orchestrator dispatch happens in the agent layer once it lands.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceSupabase } from '@/lib/supabase';
import { executeEditPlan } from '@/lib/agents/editing-orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
  if (existing.status !== 'confirming') {
    return NextResponse.json(
      { error: `Job is in status '${existing.status}'; can only confirm jobs in 'confirming'.` },
      { status: 409 }
    );
  }

  const { error: updateError } = await db
    .from('edit_jobs')
    .update({ status: 'editing' })
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Fire the orchestrator async — it walks the EDL, executes ffmpeg
  // steps inline, and pauses on AI-tool steps for MCP processing.
  void (async () => {
    try {
      await executeEditPlan(params.id, user.id);
    } catch (err) {
      console.error('[orchestrator]', err);
    }
  })();

  return NextResponse.json({ success: true });
}
