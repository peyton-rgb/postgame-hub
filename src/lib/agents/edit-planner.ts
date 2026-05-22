// ============================================================
// Edit Planner Agent
//
// The "strategist" of the editing pipeline. This agent:
//   1. Takes the user's plain-language instruction
//   2. Takes the scene map from the Video Evaluator (Gemini)
//   3. Uses Claude to figure out the exact sequence of edits
//   4. Produces an EDL (Edit Decision List) — a structured JSON
//      plan that tells the orchestrator exactly what to do,
//      which tool to use for each step, and in what order
//   5. Estimates cost and processing time
//   6. Saves the plan to the edit_jobs row
//
// Why Claude instead of Gemini for this step?
//   Claude is better at structured reasoning, tool selection,
//   and producing reliable JSON. Gemini is better at watching
//   video. So we use each model where it shines.
//
// Called by: POST /api/editing/jobs (after video evaluation)
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type {
  EditDecisionList,
  EditPlannerInput,
  SceneMap,
} from '@/lib/types/editing';
import { estimateFFmpegCost } from '@/lib/tools/ffmpeg';
import { estimateVOIDCostUpfront } from '@/lib/tools/void';
import { estimateHiggsFieldCost } from '@/lib/tools/higgsfield';
import { estimateGeminiCost } from '@/lib/tools/gemini';

// Initialize clients
const anthropic = new Anthropic();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The JSON schema Claude must follow for its output
const EDL_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    steps: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          step_id: { type: 'number' as const, description: 'Sequential step number starting at 1' },
          action: {
            type: 'string' as const,
            enum: [
              'object_removal', 'background_replace', 'background_remove',
              'style_transfer', 'video_generation', 'cut', 'trim', 'resize',
              'overlay_text', 'overlay_image', 'color_adjust', 'speed_change',
              'audio_strip', 'format_convert', 'generative_fill', 'image_expand',
            ],
          },
          tool: {
            type: 'string' as const,
            enum: ['ffmpeg', 'void', 'firefly', 'higgsfield'],
          },
          description: { type: 'string' as const, description: 'Human-readable description of what this step does' },
          params: { type: 'object' as const, description: 'Tool-specific parameters' },
          depends_on: {
            type: 'array' as const,
            items: { type: 'number' as const },
            description: 'step_ids that must complete before this step can start',
          },
        },
        required: ['step_id', 'action', 'tool', 'description', 'params', 'depends_on'],
      },
    },
    warnings: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Potential issues the user should know about',
    },
  },
  required: ['steps', 'warnings'],
};

/**
 * Create an edit plan from an instruction and scene map.
 *
 * @param input - The instruction, scene map, and job context
 * @param userId - Who triggered this (for audit logging)
 * @returns The complete Edit Decision List
 */
export async function createEditPlan(
  input: EditPlannerInput,
  userId: string
): Promise<EditDecisionList> {
  const startTime = Date.now();

  // --- Log the agent run ---
  const { data: agentRun } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'edit-planner',
      triggered_by: userId,
      input_payload: {
        edit_job_id: input.edit_job_id,
        instruction: input.instruction,
        content_type: input.content_type,
        scene_count: input.scene_map.scenes.length,
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  try {
    // --- Build the prompt ---
    const systemPrompt = buildSystemPrompt();
    const userMessage = buildUserMessage(input);

    // --- Call Claude ---
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // --- Extract the response ---
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content');
    }

    // Parse JSON from Claude's response
    // Claude might wrap it in ```json blocks, so strip those
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed: { steps: EditDecisionList['steps']; warnings: string[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error(`Failed to parse edit plan as JSON: ${jsonText.slice(0, 200)}`);
    }

    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error('Edit plan missing "steps" array');
    }

    // --- Estimate costs ---
    const { totalCost, totalMinutes } = estimatePlanCost(parsed.steps, input.scene_map);

    // --- Build the full EDL ---
    const edl: EditDecisionList = {
      edit_job_id: input.edit_job_id,
      steps: parsed.steps,
      estimated_duration_minutes: totalMinutes,
      estimated_cost_usd: totalCost,
      warnings: parsed.warnings || [],
    };

    // --- Save to the job ---
    await supabase
      .from('edit_jobs')
      .update({
        edit_plan: edl as unknown as Record<string, unknown>,
        estimated_cost_usd: totalCost,
        status: 'confirming', // waiting for CM to approve the plan
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.edit_job_id);

    // --- Log success ---
    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const costUsd =
      (inputTokens * 0.003) / 1000 + (outputTokens * 0.015) / 1000;

    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'complete',
          output_payload: {
            step_count: edl.steps.length,
            estimated_cost_usd: totalCost,
            estimated_duration_minutes: totalMinutes,
            warning_count: edl.warnings.length,
          },
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: costUsd,
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
    }

    return edl;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // --- Update job to failed ---
    await supabase
      .from('edit_jobs')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.edit_job_id);

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

    throw new Error(`Edit planning failed: ${errorMessage}`);
  }
}

// --- Prompt builders ---

function buildSystemPrompt(): string {
  return `You are an expert video/image editing planner for a professional content studio.

Your job: take a user's plain-language editing instruction and a scene-by-scene analysis
of their asset, then produce a precise Edit Decision List (EDL) — a step-by-step plan
that an automated orchestrator will execute.

## Available Tools

**FFmpeg** (tool: "ffmpeg") — Free, deterministic edits:
- cut: Remove a segment (params: cut_start, cut_end as HH:MM:SS)
- trim: Keep only a time range (params: start_time, end_time as HH:MM:SS)
- resize: Change dimensions (params: width, height as integers, fit as "contain" or "cover")
- overlay_text: Add text (params: text, font_size, font_color, x, y)
- overlay_image: Add graphic overlay (params: overlay_url, x, y)
- color_adjust: Brightness/contrast/saturation (params: brightness -1 to 1, contrast 0 to 2, saturation 0 to 3)
- speed_change: Slow-mo or speed up (params: speed as number, 0.5 = half speed, 2.0 = double)
- audio_strip: Remove all audio (no params needed)
- format_convert: Change codec (params: codec, output_format)

**VOID** (tool: "void") — AI video object removal:
- object_removal: Remove logos, people, objects from video (params: target_description, time_ranges array of {start, end}, mask_hint)
- Best for segments under 30 seconds. For longer removals, split into multiple steps.

**Adobe Firefly** (tool: "firefly") — AI image editing:
- background_remove: Strip background (params: none needed beyond the input)
- background_replace: Swap background (params: new_background_description)
- generative_fill: Fill areas with AI content (params: area_description, fill_description)
- image_expand: Extend canvas (params: direction, amount_pixels, fill_description)
- Only works on images, not video. If the user wants this on a video, extract the frame first with FFmpeg.

**Higgsfield** (tool: "higgsfield") — AI video generation/transformation:
- video_generation: Create new video from text (params: prompt, duration, resolution, style)
- style_transfer: Change visual style of existing video (params: style_description, reference_description)
- background_replace: Replace video background (params: new_background_description)

## Rules

1. Use the cheapest tool that can do the job. FFmpeg first, then VOID/Firefly, then Higgsfield.
2. Order steps logically. Removals before additions. Structural edits (trim, cut) before cosmetic edits.
3. Set depends_on correctly. If step 3 needs step 1's output, put [1] in depends_on. Independent steps can have [].
4. For VOID on long videos, split into segments under 30 seconds per step.
5. Include warnings for anything risky: partially occluded objects, fast motion areas, low-light scenes.
6. Be thorough — if the user says "remove all logos," find EVERY logo the scene map mentions.

## Output Format

Return ONLY valid JSON matching this structure:
{
  "steps": [{ "step_id": 1, "action": "...", "tool": "...", "description": "...", "params": {...}, "depends_on": [] }],
  "warnings": ["..."]
}`;
}

function buildUserMessage(input: EditPlannerInput): string {
  const sceneMapStr = JSON.stringify(input.scene_map, null, 2);

  let msg = `## User's Edit Instruction
"${input.instruction}"

## Asset Type
${input.content_type}

## Scene Map (from Gemini analysis)
${sceneMapStr}`;

  if (input.reference_image_url) {
    msg += `\n\n## Reference Image\nThe user provided a reference image for style/visual guidance: ${input.reference_image_url}`;
  }

  msg += `\n\nProduce the Edit Decision List (EDL) as JSON.`;

  return msg;
}

// --- Cost estimation ---

function estimatePlanCost(
  steps: EditDecisionList['steps'],
  sceneMap: SceneMap
): { totalCost: number; totalMinutes: number } {
  let totalCost = 0;
  let totalSeconds = 0;

  for (const step of steps) {
    switch (step.tool) {
      case 'ffmpeg':
        totalCost += estimateFFmpegCost();
        totalSeconds += 10; // FFmpeg is fast
        break;

      case 'void': {
        // Estimate based on time range in params
        const timeRanges = (step.params.time_ranges as Array<{ start: string; end: string }>) || [];
        let segmentDuration = 30; // default estimate
        if (timeRanges.length > 0) {
          segmentDuration = timeRanges.reduce((sum, range) => {
            return sum + timeToSec(range.end) - timeToSec(range.start);
          }, 0);
        }
        totalCost += estimateVOIDCostUpfront(segmentDuration);
        totalSeconds += segmentDuration * 4; // VOID takes ~4x real-time
        break;
      }

      case 'firefly':
        totalCost += 0.05; // per-operation Adobe credit estimate
        totalSeconds += 15;
        break;

      case 'higgsfield': {
        const duration = (step.params.duration as number) || 5;
        totalCost += estimateHiggsFieldCost(duration);
        totalSeconds += duration * 10; // generation takes ~10x real-time
        break;
      }
    }
  }

  // Add the Gemini analysis cost that was already spent
  totalCost += estimateGeminiCost(
    sceneMap.scenes.length > 1 ? 'video' : 'image',
    sceneMap.duration_seconds
  );

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    totalMinutes: Math.max(1, Math.round(totalSeconds / 60)),
  };
}

function timeToSec(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}
