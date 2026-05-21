// ============================================================
// Netflix VOID Tool Wrapper
//
// VOID (Video Object Inpainting with Diffusion) is an open-source
// model from Netflix that removes objects from video while keeping
// everything else looking natural. It's "physics-aware" — it
// understands light, shadows, and reflections, so when you remove
// a logo from a jersey, the fabric texture fills in correctly
// across all frames.
//
// We run VOID through Replicate's hosted API, which handles the
// GPU infrastructure. We send them the video + what to remove,
// and they return the processed video.
//
// Requires: REPLICATE_API_TOKEN in environment variables
// ============================================================

import type { ToolResult } from '@/lib/types/editing';

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

// The Replicate model identifier for VOID
// Note: This may need updating if Replicate changes the model path
const VOID_MODEL = 'netflix/void';

/**
 * Remove an object from a video using VOID.
 *
 * @param inputUrl - URL of the source video segment
 * @param targetDescription - What to remove (e.g. "Nike swoosh logo on chest")
 * @param maskUrl - Optional: a mask image/video showing what to remove.
 *   If not provided, VOID uses the text description to find and remove the target.
 * @returns ToolResult with the processed video URL
 */
export async function executeVOID(
  inputUrl: string,
  targetDescription: string,
  maskUrl?: string
): Promise<ToolResult> {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) throw new Error('REPLICATE_API_TOKEN is not set');

  const startTime = Date.now();

  try {
    // Step 1: Create a prediction (starts the processing job)
    const createRes = await fetch(`${REPLICATE_API_BASE}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VOID_MODEL,
        input: {
          video: inputUrl,
          prompt: targetDescription,
          ...(maskUrl ? { mask: maskUrl } : {}),
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return {
        success: false,
        output_url: null,
        cost_usd: 0,
        duration_seconds: Math.round((Date.now() - startTime) / 1000),
        error: `VOID prediction creation failed: ${createRes.status} — ${errText}`,
      };
    }

    const prediction = await createRes.json();
    const predictionId = prediction.id;

    // Step 2: Poll for completion
    // VOID processing takes anywhere from 30 seconds to several minutes
    // depending on video length and resolution
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (5s intervals)

    while (attempts < maxAttempts) {
      const pollRes = await fetch(
        `${REPLICATE_API_BASE}/predictions/${predictionId}`,
        {
          headers: { 'Authorization': `Bearer ${apiToken}` },
        }
      );

      const pollData = await pollRes.json();

      if (pollData.status === 'succeeded') {
        // Replicate returns the output URL(s)
        const outputUrl = Array.isArray(pollData.output)
          ? pollData.output[0]
          : pollData.output;

        return {
          success: true,
          output_url: outputUrl,
          cost_usd: estimateVOIDCost(pollData.metrics?.predict_time || 0),
          duration_seconds: Math.round((Date.now() - startTime) / 1000),
          external_job_id: predictionId,
        };
      }

      if (pollData.status === 'failed' || pollData.status === 'canceled') {
        return {
          success: false,
          output_url: null,
          cost_usd: 0,
          duration_seconds: Math.round((Date.now() - startTime) / 1000),
          external_job_id: predictionId,
          error: `VOID processing ${pollData.status}: ${pollData.error || 'Unknown error'}`,
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
      external_job_id: predictionId,
      error: 'VOID processing timed out after 10 minutes',
    };
  } catch (err) {
    return {
      success: false,
      output_url: null,
      cost_usd: 0,
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
      error: `VOID execution error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Estimate VOID cost based on processing time.
 * Replicate charges per second of GPU time.
 */
function estimateVOIDCost(predictTimeSeconds: number): number {
  // Rough estimate: ~$0.005 per second on Replicate GPU
  return Math.max(0.01, predictTimeSeconds * 0.005);
}

/**
 * Estimate cost for a VOID operation before running it.
 * Based on video segment duration and resolution.
 */
export function estimateVOIDCostUpfront(
  segmentDurationSeconds: number
): number {
  // VOID typically takes 3-5x the video duration to process
  const estimatedProcessTime = segmentDurationSeconds * 4;
  return Math.max(0.10, estimatedProcessTime * 0.005);
}
