// ============================================================
// Editing Orchestrator Agent
//
// The "Hands" of the editing pipeline. This agent:
//   1. Reads the Edit Decision List (EDL) from an edit job
//   2. Creates edit_steps rows for each step (audit trail)
//   3. Executes steps in dependency order (topological sort)
//   4. Routes each step to the right tool (FFmpeg, VOID,
//      Firefly, or Higgsfield)
//   5. Chains outputs — each step's output becomes the next
//      step's input
//   6. Tracks costs and timing per step
//   7. On completion, moves the job to "review" status
//
// Think of this like a foreman on a construction site — it reads
// the blueprint (EDL), assigns each task to the right crew
// (tool), makes sure they work in the right order, and reports
// back when the building is done.
//
// Called by: POST /api/editing/jobs/[id]/approve (when CM confirms the plan)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type {
  EditDecisionList,
  EditJob,
  EditStep,
  EDLStep,
  ToolResult,
} from '@/lib/types/editing';
import { executeFFmpeg } from '@/lib/tools/ffmpeg';

// Admin Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Execute the full edit plan for a job.
 *
 * @param jobId - The edit_jobs row ID
 * @param userId - Who triggered this (for audit logging)
 */
export async function executeEditPlan(
  jobId: string,
  userId: string
): Promise<void> {
  const startTime = Date.now();

  // --- Log the agent run ---
  const { data: agentRun } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'editing-orchestrator',
      triggered_by: userId,
      input_payload: { edit_job_id: jobId },
      model: 'orchestrator', // not an LLM — this is a routing agent
      status: 'running',
    })
    .select()
    .single();

  try {
    // --- Load the job ---
    const { data: job, error: jobError } = await supabase
      .from('edit_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Could not load edit job: ${jobError?.message || 'Not found'}`);
    }

    const editJob = job as EditJob;
    const edl = editJob.edit_plan as EditDecisionList | null;

    if (!edl || !edl.steps || edl.steps.length === 0) {
      throw new Error('Edit job has no edit plan or plan has no steps');
    }

    // --- Update job status ---
    await supabase
      .from('edit_jobs')
      .update({ status: 'editing', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    // --- Create edit_steps rows for tracking ---
    const stepRows = edl.steps.map((step) => ({
      edit_job_id: jobId,
      step_number: step.step_id,
      action: step.action,
      tool: step.tool,
      description: step.description,
      params: step.params,
      status: 'pending' as const,
    }));

    const { data: insertedSteps, error: insertError } = await supabase
      .from('edit_steps')
      .insert(stepRows)
      .select();

    if (insertError) {
      throw new Error(`Failed to create edit steps: ${insertError.message}`);
    }

    // Build a map from step_number to DB row ID for updates
    const stepDbMap = new Map<number, string>();
    for (const row of (insertedSteps || []) as EditStep[]) {
      stepDbMap.set(row.step_number, row.id);
    }

    // --- Execute steps in dependency order ---
    // Topological sort: process steps whose dependencies are all complete
    const completedSteps = new Set<number>();
    const stepOutputs = new Map<number, string>(); // step_id → output URL
    let totalCost = 0;

    // Current asset URL starts with the source file
    // Steps that depend on other steps get their input from the dependency's output
    const stepsToProcess = [...edl.steps];

    while (stepsToProcess.length > 0) {
      // Find steps whose dependencies are all satisfied
      const readySteps = stepsToProcess.filter((step) =>
        step.depends_on.every((depId) => completedSteps.has(depId))
      );

      if (readySteps.length === 0) {
        // Circular dependency or all remaining steps are blocked
        throw new Error(
          `Stuck: ${stepsToProcess.length} steps remain but none are ready. ` +
          `Completed: [${[...completedSteps].join(', ')}]. ` +
          `Waiting: [${stepsToProcess.map((s) => s.step_id).join(', ')}]`
        );
      }

      // Execute ready steps (sequentially for now — could parallelize independent steps later)
      for (const step of readySteps) {
        const dbStepId = stepDbMap.get(step.step_id);

        // Determine input URL: if this step depends on another, use that step's output.
        // If multiple dependencies, use the last one's output (chain pattern).
        // If no dependencies, use the original source file.
        let inputUrl = editJob.source_url;
        if (step.depends_on.length > 0) {
          const lastDep = step.depends_on[step.depends_on.length - 1];
          inputUrl = stepOutputs.get(lastDep) || editJob.source_url;
        }

        // Mark step as running
        if (dbStepId) {
          await supabase
            .from('edit_steps')
            .update({
              status: 'running',
              input_url: inputUrl,
              started_at: new Date().toISOString(),
            })
            .eq('id', dbStepId);
        }

        // --- Route to the right tool ---
        let result: ToolResult;
        try {
          result = await routeToTool(step, inputUrl);
        } catch (toolErr) {
          result = {
            success: false,
            output_url: null,
            cost_usd: 0,
            duration_seconds: 0,
            error: toolErr instanceof Error ? toolErr.message : String(toolErr),
          };
        }

        // Check if this step needs MCP processing (Higgsfield/Firefly/VOID)
        const isAwaitingMcp = !result.success && result.error?.startsWith('__AWAITING_MCP__');

        if (isAwaitingMcp) {
          // Mark this step as "pending" with a note that it needs MCP processing.
          // The orchestrator pauses the whole job here — a Cowork session will
          // pick up the pending MCP steps and process them.
          if (dbStepId) {
            const mcpTool = result.error?.replace('__AWAITING_MCP__:', '') || step.tool;
            await supabase
              .from('edit_steps')
              .update({
                status: 'pending',
                input_url: inputUrl,
                error_message: `Awaiting MCP processing via ${mcpTool}`,
                external_provider: mcpTool,
              })
              .eq('id', dbStepId);
          }

          // Pause the job — set status to "editing" with a note
          // The job stays in "editing" status. The Cowork session will
          // process the MCP steps and then resume the orchestrator.
          await supabase
            .from('edit_jobs')
            .update({
              status: 'editing',
              updated_at: new Date().toISOString(),
            })
            .eq('id', jobId);

          // Log partial progress
          if (agentRun) {
            await supabase
              .from('agent_runs')
              .update({
                status: 'complete',
                output_payload: {
                  steps_completed: completedSteps.size,
                  paused_at_step: step.step_id,
                  reason: 'awaiting_mcp',
                  total_cost_usd: totalCost,
                },
                cost_usd: totalCost,
                duration_ms: Date.now() - startTime,
              })
              .eq('id', agentRun.id);
          }

          // Stop processing — Cowork will resume later
          return;
        }

        // Update the step record
        if (dbStepId) {
          await supabase
            .from('edit_steps')
            .update({
              status: result.success ? 'completed' : 'failed',
              output_url: result.output_url,
              error_message: result.error || null,
              cost_usd: result.cost_usd,
              duration_seconds: result.duration_seconds,
              external_job_id: result.external_job_id || null,
              external_provider: step.tool,
              completed_at: new Date().toISOString(),
            })
            .eq('id', dbStepId);
        }

        if (!result.success) {
          // Step failed — fail the whole job
          throw new Error(
            `Step ${step.step_id} (${step.description}) failed: ${result.error}`
          );
        }

        // Track outputs for dependency chain
        if (result.output_url) {
          stepOutputs.set(step.step_id, result.output_url);
        }
        totalCost += result.cost_usd;
        completedSteps.add(step.step_id);

        // Remove from processing queue
        const idx = stepsToProcess.indexOf(step);
        if (idx >= 0) stepsToProcess.splice(idx, 1);
      }
    }

    // --- All steps complete — find the final output ---
    // The last step's output is the final result
    const lastStepId = Math.max(...edl.steps.map((s) => s.step_id));
    const finalOutputUrl = stepOutputs.get(lastStepId) || editJob.source_url;

    // --- Move job to review ---
    await supabase
      .from('edit_jobs')
      .update({
        status: 'review',
        output_url: finalOutputUrl,
        actual_cost_usd: Math.round(totalCost * 100) / 100,
        processing_time_seconds: Math.round((Date.now() - startTime) / 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // --- Log success ---
    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'complete',
          output_payload: {
            steps_completed: completedSteps.size,
            total_cost_usd: totalCost,
            final_output_url: finalOutputUrl,
          },
          cost_usd: totalCost,
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // --- Fail the job ---
    await supabase
      .from('edit_jobs')
      .update({
        status: 'failed',
        processing_time_seconds: Math.round((Date.now() - startTime) / 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // --- Log failure ---
    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          output_payload: { error: errorMessage },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
    }

    throw new Error(`Edit orchestration failed: ${errorMessage}`);
  }
}

/**
 * Route an EDL step to the appropriate tool and execute it.
 */
async function routeToTool(step: EDLStep, inputUrl: string): Promise<ToolResult> {
  switch (step.tool) {
    case 'ffmpeg':
      return executeFFmpeg(step.action, inputUrl, step.params);

    case 'void':
    case 'higgsfield':
    case 'firefly':
      // These tools run through MCP connectors (Higgsfield, Adobe Firefly)
      // rather than direct API calls. The orchestrator pauses here and marks
      // the step as "awaiting_mcp" — then a Cowork session picks it up
      // and processes it through the MCP connection.
      //
      // This is like putting a task in someone's inbox: the orchestrator
      // handles what it can (FFmpeg), then flags the AI-powered steps
      // for processing in a Cowork session where the MCP tools are available.
      return {
        success: false,
        output_url: null,
        cost_usd: 0,
        duration_seconds: 0,
        error: `__AWAITING_MCP__:${step.tool}`,
      };

    default:
      throw new Error(`Unknown tool: ${step.tool}`);
  }
}

/**
 * Map an edit action to a Higgsfield operation type.
 */
function mapActionToHiggsFieldOp(action: string): 'text_to_video' | 'image_to_video' | 'video_to_video' | 'style_transfer' {
  switch (action) {
    case 'video_generation':
      return 'text_to_video';
    case 'style_transfer':
      return 'style_transfer';
    case 'object_removal':
    case 'background_replace':
      return 'video_to_video';
    default:
      return 'video_to_video';
  }
}
