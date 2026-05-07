// ============================================================
// Edit Planner agent — "The Strategist"
//
// Reads the scene map produced by the Video Evaluator plus the CM's
// instruction, then asks Claude Sonnet 4 to produce an Edit Decision
// List (EDL): ordered steps with tool routing (ffmpeg / higgsfield /
// firefly / void), parameters, dependencies, and cost estimate.
//
// Saves the EDL to edit_jobs.edit_plan and flips status to
// 'confirming' so the CM gets a chance to review before execution.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createServiceSupabase } from '@/lib/supabase';
import type {
  ContentType,
  EditDecisionList,
  SceneMap,
} from '@/lib/types/editing';

// Lazy clients — same pattern as creative-director.ts so module
// import doesn't crash at build time when env vars are missing.
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

let _db: ReturnType<typeof createServiceSupabase> | null = null;
function getDb() {
  if (!_db) _db = createServiceSupabase();
  return _db;
}

const MODEL = 'claude-sonnet-4-20250514';

const SYSTEM_PROMPT = `You are the Edit Planner for Postgame's AI editing pipeline.

You take a video's scene map plus the campaign manager's edit instruction and produce an Edit Decision List (EDL): a concrete sequence of operations the orchestrator can execute.

OUTPUT — respond ONLY with valid JSON in this exact shape (no markdown, no prose):

{
  "steps": [
    {
      "step_id": "s1",
      "step_number": 1,
      "action": "<one of: cut, trim, resize, overlay_text, overlay_image, color_adjust, speed_change, audio_strip, format_convert, generate_image, generate_video, video_inpaint, remove_background, add_music, voiceover, transition>",
      "tool": "<one of: ffmpeg, void, higgsfield, firefly>",
      "description": "human-readable summary",
      "params": { /* action-specific keys */ },
      "depends_on": ["<step_ids>"]
    }
  ],
  "estimated_total_cost_usd": <number>,
  "estimated_duration_minutes": <number>,
  "warnings": ["..."]
}

TOOL ROUTING RULES (strict):
- ffmpeg: ALL deterministic video ops — cut, trim, resize, overlay_text,
  overlay_image, color_adjust, speed_change, audio_strip, format_convert.
- higgsfield: video generation, style transfer, motion synthesis.
- firefly: image edits, generative fills on still images.
- void: object removal from video.

PARAM SHAPES (use these key names exactly):
- cut: { cut_start: "HH:MM:SS", cut_end: "HH:MM:SS" }
- trim: { start_time: "HH:MM:SS", end_time: "HH:MM:SS" }
- resize: { width: number, height: number, fill_style: "pad" | "blur" }
  (use blur for 1080x1920 vertical)
- overlay_text: { text, font_size, font_color, x, y } (x/y can be ffmpeg expressions)
- overlay_image: { overlay_url, x, y, opacity }
- color_adjust: { brightness?: -1..1, contrast?: 0..2, saturation?: 0..3 }
- speed_change: { speed: number }
- audio_strip: {}
- format_convert: { video_codec, audio_codec, output_format }
- AI tool actions: free-form params describing the desired output.

CONSTRAINTS:
- Use depends_on to express ordering. Step ids are lowercase, like "s1", "s2".
- Each step's input is the output of its dependency (or the original
  source if depends_on is empty).
- Generate the SHORTEST viable sequence that fulfills the instruction.
- Estimate cost: ffmpeg ≈ $0.001/step, void/higgsfield/firefly ≈ $0.05–$0.50.
- If the instruction is ambiguous, pick the most reasonable interpretation
  and note alternatives in "warnings".`;

function userPrompt(args: {
  sceneMap: SceneMap;
  instruction: string;
  contentType: ContentType;
}): string {
  return [
    `# Content Type\n${args.contentType}`,
    `# Edit Instruction\n${args.instruction}`,
    `# Scene Map\n${JSON.stringify(args.sceneMap, null, 2)}`,
    `# Output\nReturn ONLY the EDL JSON.`,
  ].join('\n\n');
}

function stripFences(text: string): string {
  const t = text.trim();
  if (!t.startsWith('```')) return t;
  return t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

interface ClaudeEDLShape {
  steps?: {
    step_id?: string;
    step_number?: number;
    action?: string;
    tool?: string;
    description?: string;
    params?: Record<string, unknown>;
    depends_on?: string[];
  }[];
  estimated_total_cost_usd?: number;
  estimated_duration_minutes?: number;
  warnings?: string[];
}

function normalizeEDL(parsed: ClaudeEDLShape): EditDecisionList {
  const steps = (parsed.steps || []).map((s, idx) => ({
    id: String(s.step_id || `s${idx + 1}`),
    step_number: typeof s.step_number === 'number' ? s.step_number : idx + 1,
    action: (s.action as EditDecisionList['steps'][number]['action']) || 'format_convert',
    tool: (s.tool as EditDecisionList['steps'][number]['tool']) || 'ffmpeg',
    description: s.description || '',
    params: s.params || {},
    depends_on: Array.isArray(s.depends_on) ? s.depends_on : [],
  }));

  return {
    steps,
    estimated_total_cost_usd: Number(parsed.estimated_total_cost_usd) || 0,
    notes: Array.isArray(parsed.warnings) && parsed.warnings.length > 0
      ? parsed.warnings.join(' | ')
      : undefined,
  };
}

export interface EditPlannerInput {
  jobId: string;
  sceneMap: SceneMap;
  instruction: string;
  contentType: ContentType;
}

export async function createEditPlan(
  input: EditPlannerInput,
  userId: string
): Promise<EditDecisionList> {
  const db = getDb();
  const anthropic = getAnthropic();
  const startTime = Date.now();

  const sysPrompt = SYSTEM_PROMPT;
  const userMsg = userPrompt(input);

  const { data: agentRun, error: runError } = await db
    .from('agent_runs')
    .insert({
      agent_name: 'editor',
      triggered_by: userId,
      input_payload: {
        scope: 'edit_planner',
        job_id: input.jobId,
        instruction: input.instruction,
        content_type: input.contentType,
      },
      model: MODEL,
      status: 'running',
    })
    .select('id')
    .single();

  if (runError) console.error('[edit-planner] agent_runs insert failed:', runError);

  try {
    let response;
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: sysPrompt,
        messages: [{ role: 'user', content: userMsg }],
      });
    } catch (err) {
      throw new Error(
        `Anthropic call failed: ${err instanceof Error ? err.message : 'unknown'}`
      );
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude returned no text content');
    }

    let parsed: ClaudeEDLShape;
    try {
      parsed = JSON.parse(stripFences(textBlock.text)) as ClaudeEDLShape;
    } catch {
      // One retry with a correction prompt — same pattern as creative-director.
      const retry = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: sysPrompt,
        messages: [
          { role: 'user', content: userMsg },
          { role: 'assistant', content: textBlock.text },
          {
            role: 'user',
            content:
              'Your previous response was not valid JSON. Return ONLY the EDL JSON object — no markdown fences, no prose.',
          },
        ],
      });
      const retryBlock = retry.content.find((b) => b.type === 'text');
      if (!retryBlock || retryBlock.type !== 'text') {
        throw new Error('Edit planner JSON parse failed twice');
      }
      parsed = JSON.parse(stripFences(retryBlock.text)) as ClaudeEDLShape;
      response = retry;
    }

    const edl = normalizeEDL(parsed);

    await db
      .from('edit_jobs')
      .update({
        edit_plan: edl,
        estimated_cost_usd: edl.estimated_total_cost_usd,
        status: 'confirming',
      })
      .eq('id', input.jobId);

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;
    const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

    if (agentRun?.id) {
      await db
        .from('agent_runs')
        .update({
          status: 'complete',
          output_payload: parsed as unknown as Record<string, unknown>,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: cost,
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
    }

    return edl;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Edit planner failed';
    console.error('[edit-planner]', err);

    if (agentRun?.id) {
      await db
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: message,
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
    }
    await db.from('edit_jobs').update({ status: 'failed' }).eq('id', input.jobId);
    throw err;
  }
}
