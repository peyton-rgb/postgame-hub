// ============================================================
// Video Evaluator agent — "The Brain"
//
// Uploads the source asset to the Gemini File API, asks Gemini 2.5
// Pro for a detailed scene map, and saves it on the edit_jobs row.
// On exit, the job is in 'planning' so the Edit Planner can pick up.
//
// Logs run start/finish to agent_runs (agent_name='editor' until the
// agent_name enum is extended to include 'video_evaluator').
// ============================================================

import { createServiceSupabase } from '@/lib/supabase';
import {
  uploadFileToGemini,
  analyzeWithGemini,
  estimateGeminiCost,
} from '@/lib/tools/gemini';
import type { ContentType, SceneMap } from '@/lib/types/editing';

let _db: ReturnType<typeof createServiceSupabase> | null = null;
function getDb() {
  if (!_db) _db = createServiceSupabase();
  return _db;
}

export interface EvaluateVideoInput {
  jobId: string;
  sourceUrl: string;
  contentType: ContentType;
  instruction: string;
}

function mimeForContentType(ct: ContentType, sourceUrl: string): string {
  if (ct === 'image') {
    if (/\.(png)(\?|$)/i.test(sourceUrl)) return 'image/png';
    if (/\.(webp)(\?|$)/i.test(sourceUrl)) return 'image/webp';
    return 'image/jpeg';
  }
  if (/\.(webm)(\?|$)/i.test(sourceUrl)) return 'video/webm';
  if (/\.(mov)(\?|$)/i.test(sourceUrl)) return 'video/quicktime';
  return 'video/mp4';
}

export async function evaluateVideo(
  input: EvaluateVideoInput,
  userId: string
): Promise<SceneMap> {
  const db = getDb();
  const startTime = Date.now();

  // Audit row — start state.
  const { data: agentRun, error: runError } = await db
    .from('agent_runs')
    .insert({
      agent_name: 'editor',
      triggered_by: userId,
      input_payload: {
        scope: 'video_evaluator',
        job_id: input.jobId,
        source_url: input.sourceUrl,
        content_type: input.contentType,
        instruction: input.instruction,
      },
      model: 'gemini-2.5-pro',
      status: 'running',
    })
    .select('id')
    .single();

  if (runError) {
    // Don't block the pipeline on audit-log failure — surface it but proceed.
    console.error('[video-evaluator] agent_runs insert failed:', runError);
  }

  // Move job into 'analyzing'
  await db
    .from('edit_jobs')
    .update({ status: 'analyzing' })
    .eq('id', input.jobId);

  try {
    const mime = mimeForContentType(input.contentType, input.sourceUrl);

    const { fileUri } = await uploadFileToGemini(input.sourceUrl, mime);
    const { sceneMap, promptTokens, completionTokens } = await analyzeWithGemini(
      fileUri,
      mime,
      input.instruction
    );

    const estCost = estimateGeminiCost(input.contentType, sceneMap.duration_seconds);

    await db
      .from('edit_jobs')
      .update({
        scene_map: sceneMap,
        status: 'planning',
      })
      .eq('id', input.jobId);

    if (agentRun?.id) {
      await db
        .from('agent_runs')
        .update({
          status: 'complete',
          output_payload: { scene_map: sceneMap },
          input_tokens: promptTokens,
          output_tokens: completionTokens,
          cost_usd: estCost,
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
    }

    return sceneMap;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Video evaluator failed';
    console.error('[video-evaluator]', err);

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

    await db
      .from('edit_jobs')
      .update({ status: 'failed' })
      .eq('id', input.jobId);

    throw err;
  }
}
