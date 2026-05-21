// ============================================================
// Higgsfield AI Tool Wrapper
//
// Higgsfield is a multi-model video AI platform that aggregates
// 15+ AI video engines (Sora 2, Kling 3.0, Veo 3.1, and more).
// Instead of being locked into one model's strengths, Higgsfield
// picks the best engine for each specific task.
//
// We use Higgsfield for:
//   - Generating new video clips from text prompts
//   - Style transfer (making footage look cinematic, etc.)
//   - Video-to-video transformations
//   - Character-consistent content generation
//
// This replaces Runway entirely in our stack.
//
// Requires: HIGGSFIELD_API_KEY in environment variables
// ============================================================

import type { ToolResult } from '@/lib/types/editing';

const HIGGSFIELD_API_BASE = 'https://api.higgsfield.ai/v1';

/** Supported Higgsfield operation types */
type HiggsFieldOperation =
  | 'text_to_video'      // generate video from a text prompt
  | 'image_to_video'     // animate a still image
  | 'video_to_video'     // transform an existing video (style transfer, etc.)
  | 'style_transfer';    // apply a visual style to footage

interface HiggsFieldInput {
  operation: HiggsFieldOperation;
  prompt: string;
  input_url?: string;           // source video/image URL (for transforms)
  reference_image_url?: string; // style reference image
  duration?: number;            // output duration in seconds
  resolution?: string;          // e.g. '1080p', '720p'
  model?: string;               // specific model, or 'auto' to let Higgsfield choose
  style?: string;               // style preset name
}

/**
 * Execute a Higgsfield AI video operation.
 *
 * @param input - What to generate or transform
 * @returns ToolResult with the output video URL
 */
export async function executeHiggsfield(
  input: HiggsFieldInput
): Promise<ToolResult> {
  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) throw new Error('HIGGSFIELD_API_KEY is not set');

  const startTime = Date.now();

  try {
    // Step 1: Create the generation job
    const endpoint = getEndpoint(input.operation);

    const createRes = await fetch(`${HIGGSFIELD_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: input.prompt,
        ...(input.input_url ? { input_video: input.input_url } : {}),
        ...(input.reference_image_url ? { reference_image: input.reference_image_url } : {}),
        duration: input.duration || 5,
        resolution: input.resolution || '1080p',
        model: input.model || 'auto',
        ...(input.style ? { style: input.style } : {}),
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return {
        success: false,
        output_url: null,
        cost_usd: 0,
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
        error: `Higgsfield job creation failed: ${createRes.status} — ${errText}`,
      };
    }

    const job = await createRes.json();
    const jobId = job.id || job.job_id;

    // Step 2: Poll for completion
    // Video generation can take 30 seconds to several minutes
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max

    while (attempts < maxAttempts) {
      const pollRes = await fetch(
        `${HIGGSFIELD_API_BASE}/jobs/${jobId}`,
        {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        }
      );

      const pollData = await pollRes.json();
      const status = pollData.status?.toLowerCase();

      if (status === 'completed' || status === 'succeeded') {
        const outputUrl = pollData.output_url || pollData.result?.url || pollData.output?.[0]?.url;

        return {
          success: true,
          output_url: outputUrl,
          cost_usd: pollData.cost_usd || estimateHiggsFieldCost(input.duration || 5),
          duration_seconds: Math.round((Date.now() - startTime) / 1000),
          external_job_id: jobId,
        };
      }

      if (status === 'failed' || status === 'error' || status === 'cancelled') {
        return {
          success: false,
          output_url: null,
          cost_usd: 0,
          duration_seconds: Math.round((Date.now() - startTime) / 1000),
          external_job_id: jobId,
          error: `Higgsfield job ${status}: ${pollData.error || pollData.message || 'Unknown error'}`,
        };
      }

      // Still processing — wait 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    return {
      success: false,
      output_url: null,
      cost_usd: 0,
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
      external_job_id: jobId,
      error: 'Higgsfield job timed out after 10 minutes',
    };
  } catch (err) {
    return {
      success: false,
      output_url: null,
      cost_usd: 0,
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
      error: `Higgsfield execution error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Map operation type to Higgsfield API endpoint */
function getEndpoint(operation: HiggsFieldOperation): string {
  switch (operation) {
    case 'text_to_video':
      return '/generate';
    case 'image_to_video':
      return '/animate';
    case 'video_to_video':
      return '/transform';
    case 'style_transfer':
      return '/style-transfer';
    default:
      return '/generate';
  }
}

/**
 * Estimate Higgsfield cost based on output duration.
 * Varies by model selected, but this gives a ballpark.
 */
export function estimateHiggsFieldCost(
  durationSeconds: number,
  operation?: HiggsFieldOperation
): number {
  // Generation from scratch is more expensive than transformation
  const ratePerSecond = operation === 'video_to_video' || operation === 'style_transfer'
    ? 0.10   // transforms: ~$0.10/second
    : 0.25;  // generation: ~$0.25/second

  return Math.max(0.05, durationSeconds * ratePerSecond);
}
