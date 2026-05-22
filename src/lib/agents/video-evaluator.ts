// ============================================================
// Video Evaluator Agent
//
// The "Brain" of the editing pipeline. This agent:
//   1. Takes a video or image from an edit job
//   2. Uploads it to Gemini's File API
//   3. Asks Gemini 2.5 Pro to analyze the entire file
//   4. Gets back a structured "scene map" — a scene-by-scene
//      breakdown of everything visible (people, logos, objects,
//      timestamps, locations, camera work, lighting)
//   5. Saves the scene map to the edit_jobs row
//
// The scene map is the foundation for the Edit Planner agent,
// which reads it and figures out exactly what tools to use
// for each part of the edit.
//
// Called by: POST /api/editing/jobs (after job creation)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import {
  uploadFileToGemini,
  analyzeWithGemini,
  estimateGeminiCost,
} from '@/lib/tools/gemini';
import type { SceneMap, VideoEvaluatorInput } from '@/lib/types/editing';

// Admin Supabase client — bypasses RLS for server-side agent work
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Analyze an asset with Gemini and produce a scene map.
 *
 * @param input - The edit job details (source URL, content type, instruction)
 * @param userId - Who triggered this (for audit logging)
 * @returns The scene map, or throws on failure
 */
export async function evaluateVideo(
  input: VideoEvaluatorInput,
  userId: string
): Promise<SceneMap> {
  const startTime = Date.now();

  // --- Log the agent run start ---
  const { data: agentRun } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'video-evaluator',
      triggered_by: userId,
      input_payload: {
        edit_job_id: input.edit_job_id,
        source_url: input.source_url,
        content_type: input.content_type,
        instruction: input.instruction,
      },
      model: 'gemini-2.5-pro',
      status: 'running',
    })
    .select()
    .single();

  // --- Update job status to "analyzing" ---
  await supabase
    .from('edit_jobs')
    .update({ status: 'analyzing', updated_at: new Date().toISOString() })
    .eq('id', input.edit_job_id);

  try {
    // --- Figure out the MIME type ---
    // We need this for Gemini's File API upload
    const mimeType = guessMimeType(input.source_url, input.content_type);

    // --- Upload to Gemini ---
    // This sends our file to Google's temporary storage so Gemini
    // can process it. For videos, Gemini needs to transcode it first,
    // which can take a minute or two.
    const fileUri = await uploadFileToGemini(input.source_url, mimeType);

    // --- Run the analysis ---
    // Gemini watches the whole video (or analyzes the image) and
    // returns a structured JSON scene map
    const { sceneMap, inputTokens, outputTokens } = await analyzeWithGemini(
      fileUri,
      mimeType,
      input.instruction
    );

    // --- Calculate cost ---
    const costUsd = estimateGeminiCost(
      input.content_type,
      sceneMap.duration_seconds
    );

    // --- Save scene map to the job ---
    await supabase
      .from('edit_jobs')
      .update({
        scene_map: sceneMap as unknown as Record<string, unknown>,
        status: 'planning', // ready for the Edit Planner
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.edit_job_id);

    // --- Log success ---
    if (agentRun) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'complete',
          output_payload: {
            scene_count: sceneMap.scenes.length,
            subject_count: Object.keys(sceneMap.subjects || {}).length,
            duration_seconds: sceneMap.duration_seconds,
          },
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: costUsd,
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
    }

    return sceneMap;
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

    throw new Error(`Video evaluation failed: ${errorMessage}`);
  }
}

/**
 * Guess the MIME type from a URL and content type.
 * Gemini needs an accurate MIME type for file upload.
 */
function guessMimeType(url: string, contentType: 'video' | 'image'): string {
  const lower = url.toLowerCase();

  if (contentType === 'video') {
    if (lower.includes('.mov')) return 'video/quicktime';
    if (lower.includes('.webm')) return 'video/webm';
    if (lower.includes('.avi')) return 'video/x-msvideo';
    return 'video/mp4'; // most common default
  }

  // Image
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  if (lower.includes('.gif')) return 'image/gif';
  return 'image/jpeg'; // most common default
}
