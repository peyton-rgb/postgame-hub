// ============================================================
// Editor Agent — Rough Cut Review & Edit Notes
//
// What it does:
//   1. Takes a review_session record (has video_url, asset_name)
//   2. Optionally loads the linked creator_brief for context
//   3. Sends the brief context + review instructions to Claude
//   4. Claude returns structured JSON with edit notes:
//      - overall_score (1-10)
//      - pacing_notes, shot_composition, audio_notes, color_grading
//      - brand_compliance (score + issues)
//      - recommended_cuts
//      - final_verdict: approve | minor_revisions | major_revisions
//      - summary
//   5. Logs the run to agent_runs for auditing
//
// This function is called by POST /api/agents/editor
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Initialize the Anthropic client (reads ANTHROPIC_API_KEY from env)
const anthropic = new Anthropic();

// Admin Supabase client for full access (same pattern as intake-agent.ts)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The result shape Claude must return
export interface EditorAnalysis {
  overall_score: number;
  pacing_notes: string;
  shot_composition: string;
  brand_compliance: {
    score: number;
    issues: string[];
  };
  audio_notes: string;
  color_grading: string;
  recommended_cuts: string[];
  final_verdict: 'approve' | 'minor_revisions' | 'major_revisions';
  summary: string;
}

// The JSON schema Claude must follow
const EDITOR_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    overall_score: {
      type: 'number' as const,
      description: 'Overall quality score from 1-10. 1 = unusable, 5 = needs work, 7 = solid, 9 = exceptional, 10 = best-in-class.',
    },
    pacing_notes: {
      type: 'string' as const,
      description: 'Detailed notes on pacing and rhythm. Address cut timing, scene transitions, energy flow, and whether the pacing matches the brief\'s intended platform and audience.',
    },
    shot_composition: {
      type: 'string' as const,
      description: 'Notes on framing, camera angles, shot variety, and visual storytelling. Flag any awkward framings, jump cuts, or missed opportunities.',
    },
    brand_compliance: {
      type: 'object' as const,
      properties: {
        score: {
          type: 'number' as const,
          description: 'Brand compliance score 1-10. How well does the cut match the brief\'s brand guidelines, tone, and deliverables?',
        },
        issues: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Specific brand compliance issues. E.g. "Logo not visible in first 3 seconds", "Tone too casual for premium brand", "Missing required CTA".',
        },
      },
      required: ['score', 'issues'],
    },
    audio_notes: {
      type: 'string' as const,
      description: 'Notes on audio quality, music selection, sound design, voiceover clarity, and audio-visual sync.',
    },
    color_grading: {
      type: 'string' as const,
      description: 'Notes on color grading consistency, mood alignment, and any color issues (white balance, exposure, contrast).',
    },
    recommended_cuts: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Specific, actionable edit recommendations. Each item should be a clear instruction like "Cut the intro from 8s to 3s — hook needs to land faster" or "Add b-roll between interview segments at 0:45".',
    },
    final_verdict: {
      type: 'string' as const,
      enum: ['approve', 'minor_revisions', 'major_revisions'],
      description: 'approve = ready to deliver, minor_revisions = small tweaks needed, major_revisions = significant rework required.',
    },
    summary: {
      type: 'string' as const,
      description: 'A 2-4 sentence executive summary of the review. Lead with the strongest element, then the biggest concern, then the verdict.',
    },
  },
  required: [
    'overall_score',
    'pacing_notes',
    'shot_composition',
    'brand_compliance',
    'audio_notes',
    'color_grading',
    'recommended_cuts',
    'final_verdict',
    'summary',
  ],
};

// System prompt that establishes the Editor agent persona
const SYSTEM_PROMPT = `You are the Editor Agent for Postgame, an NIL (Name, Image, Likeness) marketing agency that creates content for college athletes and brands. You are a senior video editor reviewing rough cuts before they go to the client.

YOUR ROLE:
You review rough-cut videos against the creator brief and generate precise, actionable edit notes. Your feedback should feel like it's coming from a seasoned editor who has cut hundreds of athlete marketing videos — direct, specific, and constructive.

REVIEW PRIORITIES (in order):
1. HOOK — Does the first 1-3 seconds grab attention? For social-first content, this is everything.
2. PACING — Does the edit rhythm match the platform? TikTok = fast cuts. YouTube = breathing room. IG Reels = tight but not frantic.
3. BRAND COMPLIANCE — Does the cut hit every deliverable in the brief? Logo placement, CTA, product shots, required messaging.
4. STORY ARC — Even a 15-second clip needs a beginning, middle, and end. Does this have narrative momentum?
5. TECHNICAL — Audio levels, color consistency, transitions, text placement, aspect ratio.

FEEDBACK RULES:
1. Be specific with timestamps when possible. "The transition at 0:12 is jarring" not "transitions need work."
2. Lead with what's working before what's broken. Editors need to know what to protect.
3. Every critique must include a suggested fix. Don't just say "pacing is off" — say "tighten the mid-section by cutting the walking shot from 0:22-0:28."
4. Think platform-first. A cut that works for YouTube might fail on TikTok. Reference the brief's target platform.
5. Brand compliance issues are non-negotiable. Flag every miss, no matter how small.

OUTPUT: Return ONLY valid JSON matching the schema. No extra text, no markdown.`;

/**
 * Run the Editor Agent on a review session.
 *
 * @param params.review_session_id - UUID of the review_sessions row
 * @param params.creator_brief_id - Optional UUID of the creator_briefs row for context
 * @returns The structured edit analysis
 */
export async function runEditorAgent(params: {
  review_session_id: string;
  creator_brief_id?: string;
}): Promise<EditorAnalysis> {
  const startTime = Date.now();

  // --- Step 1: Fetch the review session ---
  const { data: session, error: sessionError } = await supabase
    .from('review_sessions')
    .select('*')
    .eq('id', params.review_session_id)
    .single();

  if (sessionError || !session) {
    throw new Error(`Review session not found: ${params.review_session_id}`);
  }

  // --- Step 2: Optionally fetch the creator brief ---
  let briefContext = '';
  if (params.creator_brief_id) {
    const { data: brief, error: briefError } = await supabase
      .from('creator_briefs')
      .select('*')
      .eq('id', params.creator_brief_id)
      .single();

    if (briefError || !brief) {
      console.warn(`Creator brief not found: ${params.creator_brief_id}, proceeding without brief context`);
    } else {
      briefContext = `\n\nCREATOR BRIEF CONTEXT:\nTitle: ${brief.title || 'Untitled'}\n`;
      if (brief.sections) {
        briefContext += `Brief Sections:\n${JSON.stringify(brief.sections, null, 2)}\n`;
      }
      if (brief.brand_name) {
        briefContext += `Brand: ${brief.brand_name}\n`;
      }
      if (brief.platform) {
        briefContext += `Target Platform: ${brief.platform}\n`;
      }
      if (brief.deliverables) {
        briefContext += `Deliverables: ${JSON.stringify(brief.deliverables)}\n`;
      }
    }
  }

  // --- Step 3: Create agent_runs record (status: running) ---
  const { data: agentRun, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'editor',
      triggered_by: session.created_by || null,
      input_payload: {
        review_session_id: params.review_session_id,
        creator_brief_id: params.creator_brief_id || null,
        video_url: session.video_url,
        asset_name: session.asset_name,
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  if (runError) {
    throw new Error(`Failed to create agent run record: ${runError.message}`);
  }

  // --- Step 4: Call Claude ---
  let response;
  try {
    const userMessage = `Review this rough cut and return structured edit notes as JSON.

ASSET: ${session.asset_name || 'Untitled rough cut'}
VIDEO URL: ${session.video_url || 'No video URL provided'}
${session.duration ? `DURATION: ${session.duration}` : ''}
${session.notes ? `EDITOR NOTES: ${session.notes}` : ''}
${briefContext}

Analyze the rough cut against the brief (if provided) and return your edit notes following the JSON schema. If no brief is provided, evaluate based on general NIL athlete marketing best practices.

Return JSON matching the editor review schema.`;

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });
  } catch (err) {
    // Log the failure
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Claude call failed',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);

    throw err;
  }

  // --- Step 5: Parse the response ---
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: 'Claude returned no text content',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);
    throw new Error('Claude returned no text content');
  }

  let analysis: EditorAnalysis;
  try {
    // Strip markdown code fences if present
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    analysis = JSON.parse(jsonText) as EditorAnalysis;
  } catch {
    // Retry once with a correction prompt
    console.warn('First JSON parse failed for editor review, retrying...');
    try {
      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: 'Review the rough cut and return structured edit notes as JSON.',
          },
          { role: 'assistant', content: textBlock.text },
          {
            role: 'user',
            content: `Your previous response was not valid JSON. Return ONLY a valid JSON object, no extra text. Schema:\n${JSON.stringify(EDITOR_OUTPUT_SCHEMA, null, 2)}`,
          },
        ],
      });

      const retryBlock = retryResponse.content.find((b) => b.type === 'text');
      if (retryBlock && retryBlock.type === 'text') {
        let retryJson = retryBlock.text.trim();
        if (retryJson.startsWith('```')) {
          retryJson = retryJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        analysis = JSON.parse(retryJson) as EditorAnalysis;
        response = retryResponse;
      } else {
        throw new Error('Retry returned no text');
      }
    } catch {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse Claude editor response after 2 attempts',
          output_payload: { raw_response: textBlock.text },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
      throw new Error('Claude returned malformed JSON twice during editor review. Please retry.');
    }
  }

  // --- Step 6: Update agent_runs with success ---
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  await supabase
    .from('agent_runs')
    .update({
      status: 'complete',
      output_payload: analysis,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRun.id);

  return analysis;
}
