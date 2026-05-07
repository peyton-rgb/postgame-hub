// ============================================================
// Editing Orchestrator — "The Hands"
//
// Loads an edit_jobs row + its EDL, expands the EDL into edit_steps
// rows, then walks the dependency graph in topological order:
//
//   - ffmpeg actions execute synchronously via the FFmpeg tool.
//   - void / higgsfield / firefly actions are AI tools dispatched
//     via MCP from the Cowork session. The orchestrator marks the
//     step as still-pending with an __AWAITING_MCP__:tool sentinel
//     and returns; the Cowork session takes it from there.
//
// Every successful step's output_url becomes the input for any
// dependent step. When all steps complete, the job moves to
// 'review' with the final step's output_url.
// ============================================================

import { createServiceSupabase } from '@/lib/supabase';
import { executeFFmpeg } from '@/lib/tools/ffmpeg';
import type {
  EditDecisionList,
  EditJob,
  EditStep,
  EditStepStatus,
  EditTool,
  EDLStep,
  ToolResult,
} from '@/lib/types/editing';

let _db: ReturnType<typeof createServiceSupabase> | null = null;
function getDb() {
  if (!_db) _db = createServiceSupabase();
  return _db;
}

export async function executeEditPlan(jobId: string, userId: string): Promise<void> {
  const db = getDb();
  const startTime = Date.now();

  const { data: agentRun } = await db
    .from('agent_runs')
    .insert({
      agent_name: 'editor',
      triggered_by: userId,
      input_payload: { scope: 'editing_orchestrator', job_id: jobId },
      model: 'orchestrator',
      status: 'running',
    })
    .select('id')
    .single();

  // Load job + plan
  const { data: jobRow, error: jobError } = await db
    .from('edit_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !jobRow) {
    await failRun(agentRun?.id, 'Job not found', startTime);
    throw new Error(`Job not found: ${jobId}`);
  }
  const job = jobRow as EditJob;
  const plan = job.edit_plan as EditDecisionList | null;
  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    await failRun(agentRun?.id, 'Job has no edit_plan to execute', startTime);
    await db.from('edit_jobs').update({ status: 'failed' }).eq('id', jobId);
    throw new Error('Job has no edit_plan');
  }

  await db.from('edit_jobs').update({ status: 'editing' }).eq('id', jobId);

  // Insert / refresh edit_steps rows. We upsert by (job_id, step_number)
  // so re-running an orchestrator on a retried job doesn't duplicate.
  const stepRows = plan.steps.map((s) => ({
    edit_job_id: jobId,
    step_number: s.step_number,
    action: s.action,
    tool: s.tool,
    description: s.description,
    params: { ...s.params, _edl_id: s.id, _depends_on: s.depends_on },
    status: 'pending' as EditStepStatus,
  }));

  // Best-effort cleanup: drop any prior pending step rows for this job.
  await db
    .from('edit_steps')
    .delete()
    .eq('edit_job_id', jobId)
    .in('status', ['pending', 'failed']);

  const { data: insertedSteps, error: insertError } = await db
    .from('edit_steps')
    .insert(stepRows)
    .select('*');

  if (insertError || !insertedSteps) {
    await failRun(agentRun?.id, `edit_steps insert failed: ${insertError?.message}`, startTime);
    await db.from('edit_jobs').update({ status: 'failed' }).eq('id', jobId);
    throw new Error('edit_steps insert failed');
  }

  // Build lookup maps so we can resolve dependencies.
  const dbStepsByEDLId = new Map<string, EditStep>();
  for (const dbStep of insertedSteps as EditStep[]) {
    const edlId = (dbStep.params as { _edl_id?: string })?._edl_id || `s${dbStep.step_number}`;
    dbStepsByEDLId.set(edlId, dbStep);
  }
  const completedOutputByEDLId = new Map<string, string>(); // edl_id → output_url
  const completedSet = new Set<string>(); // edl_id

  // Topological execution loop.
  const remaining: EDLStep[] = [...plan.steps];
  let totalCost = 0;
  let lastOutputUrl: string | null = null;

  // Hard cap iterations defensively against bad planner output.
  const MAX_ITERATIONS = remaining.length * 2 + 10;
  let iter = 0;

  while (remaining.length > 0 && iter < MAX_ITERATIONS) {
    iter++;

    // Find a step whose deps are all complete.
    const idx = remaining.findIndex((s) =>
      (s.depends_on || []).every((d) => completedSet.has(d))
    );
    if (idx === -1) {
      // Cyclic or missing deps — fail.
      await failRun(agentRun?.id, 'Unsatisfiable step dependencies', startTime);
      await db.from('edit_jobs').update({ status: 'failed' }).eq('id', jobId);
      throw new Error('Unsatisfiable step dependencies');
    }

    const step = remaining[idx];
    remaining.splice(idx, 1);
    const dbStep = dbStepsByEDLId.get(step.id);
    if (!dbStep) {
      throw new Error(`Internal: missing edit_steps row for EDL id ${step.id}`);
    }

    // Resolve input URL: last completed dep's output, else original source.
    const depId = step.depends_on?.[step.depends_on.length - 1];
    const inputUrl =
      (depId && completedOutputByEDLId.get(depId)) || job.source_url;

    await db
      .from('edit_steps')
      .update({
        status: 'running',
        input_url: inputUrl,
      })
      .eq('id', dbStep.id);

    let result: ToolResult;
    try {
      result = await runStep(step.tool, step.action, inputUrl, step.params);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Step failed';
      console.error(`[orchestrator] step ${step.id} failed:`, err);

      await db
        .from('edit_steps')
        .update({
          status: 'failed',
          error_message: message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbStep.id);

      await db.from('edit_jobs').update({ status: 'failed' }).eq('id', jobId);
      await failRun(agentRun?.id, message, startTime);
      throw err;
    }

    // AWAITING_MCP — pause the pipeline; Cowork session will pick up.
    if (result.awaiting_mcp) {
      await db
        .from('edit_steps')
        .update({
          status: 'pending',
          external_provider: step.tool,
          external_job_id: result.external_job_id ?? null,
          error_message: `__AWAITING_MCP__:${step.tool}`,
        })
        .eq('id', dbStep.id);

      // Job stays in 'editing' so MCP-side completion can resume it.
      if (agentRun?.id) {
        await db
          .from('agent_runs')
          .update({
            status: 'complete',
            output_payload: { paused_for_mcp: step.tool, step_id: dbStep.id },
            duration_ms: Date.now() - startTime,
          })
          .eq('id', agentRun.id);
      }
      return;
    }

    // Success path
    if (typeof result.cost_usd === 'number') totalCost += result.cost_usd;
    if (result.output_url) lastOutputUrl = result.output_url;
    completedSet.add(step.id);
    if (result.output_url) completedOutputByEDLId.set(step.id, result.output_url);

    await db
      .from('edit_steps')
      .update({
        status: 'complete',
        output_url: result.output_url ?? null,
        cost_usd: result.cost_usd ?? null,
        duration_seconds: result.duration_seconds ?? null,
        external_job_id: result.external_job_id ?? null,
        external_provider: result.external_provider ?? null,
      })
      .eq('id', dbStep.id);
  }

  if (remaining.length > 0) {
    await failRun(agentRun?.id, 'Orchestrator iteration cap exceeded', startTime);
    await db.from('edit_jobs').update({ status: 'failed' }).eq('id', jobId);
    throw new Error('Orchestrator iteration cap exceeded');
  }

  // All done — mark job ready for review.
  await db
    .from('edit_jobs')
    .update({
      status: 'review',
      output_url: lastOutputUrl,
      actual_cost_usd: totalCost || null,
    })
    .eq('id', jobId);

  if (agentRun?.id) {
    await db
      .from('agent_runs')
      .update({
        status: 'complete',
        output_payload: { output_url: lastOutputUrl, total_cost_usd: totalCost },
        cost_usd: totalCost,
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);
  }
}

async function runStep(
  tool: EditTool,
  action: string,
  inputUrl: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  switch (tool) {
    case 'ffmpeg':
      return executeFFmpeg(action, inputUrl, params);
    case 'void':
    case 'higgsfield':
    case 'firefly':
      // These are AI tools handled out-of-band via MCP. Mark the step
      // so the Cowork session can find it and complete it.
      return {
        awaiting_mcp: true,
        external_provider: tool,
      };
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

async function failRun(
  agentRunId: string | undefined,
  message: string,
  startTime: number
) {
  if (!agentRunId) return;
  const db = getDb();
  await db
    .from('agent_runs')
    .update({
      status: 'failed',
      error_message: message,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRunId);
}
