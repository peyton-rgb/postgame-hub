// ============================================================
// Editing Jobs API — POST (create) and GET (list)
//
// POST /api/editing/jobs
//   Creates a new edit job, then kicks off the pipeline:
//   Video Evaluator → Edit Planner (runs async in background)
//
// GET /api/editing/jobs?status=review&limit=20&offset=0
//   Lists edit jobs with optional status filter
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { evaluateVideo } from '@/lib/agents/video-evaluator';
import { createEditPlan } from '@/lib/agents/edit-planner';

// --- POST: Create a new edit job ---

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  // Check auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Parse the request body
  let body: {
    asset_id?: string;
    source_url: string;
    content_type: 'video' | 'image';
    instruction: string;
    reference_image_url?: string;
    parent_job_id?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate required fields
  if (!body.source_url || !body.content_type || !body.instruction) {
    return NextResponse.json(
      { error: 'source_url, content_type, and instruction are required' },
      { status: 400 }
    );
  }

  // Create the job row
  const { data: job, error: insertError } = await supabase
    .from('edit_jobs')
    .insert({
      asset_id: body.asset_id || null,
      source_url: body.source_url,
      content_type: body.content_type,
      instruction: body.instruction,
      reference_image_url: body.reference_image_url || null,
      parent_job_id: body.parent_job_id || null,
      created_by: user.id,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError || !job) {
    return NextResponse.json(
      { error: `Failed to create edit job: ${insertError?.message}` },
      { status: 500 }
    );
  }

  // Kick off the pipeline in the background
  // (don't await — return the job immediately so the UI can show progress)
  runPipelineAsync(job.id, job.source_url, job.content_type, job.instruction, user.id, body.reference_image_url);

  return NextResponse.json({ job }, { status: 201 });
}

/**
 * Runs the Video Evaluator → Edit Planner pipeline in the background.
 * This is fire-and-forget from the API route's perspective.
 * The UI polls the job status to track progress.
 */
async function runPipelineAsync(
  jobId: string,
  sourceUrl: string,
  contentType: 'video' | 'image',
  instruction: string,
  userId: string,
  referenceImageUrl?: string
) {
  try {
    // Step 1: Video Evaluator (Gemini analyzes the asset)
    const sceneMap = await evaluateVideo(
      { edit_job_id: jobId, source_url: sourceUrl, content_type: contentType, instruction },
      userId
    );

    // Step 2: Edit Planner (Claude builds the EDL)
    await createEditPlan(
      {
        edit_job_id: jobId,
        instruction,
        scene_map: sceneMap,
        content_type: contentType,
        reference_image_url: referenceImageUrl,
      },
      userId
    );

    // Job is now in "confirming" status — waiting for CM to approve the plan
  } catch (err) {
    // Errors are already logged by the agents and job status is set to 'failed'
    console.error('[editing-pipeline]', err);
  }
}

// --- GET: List edit jobs ---

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Build query
  let query = supabase
    .from('edit_jobs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    jobs: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
