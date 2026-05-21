// ============================================================
// Gemini Tool Wrapper
//
// Handles two things:
//   1. Uploading a video/image file to Gemini's File API
//      (temporary storage so Gemini can process it)
//   2. Sending the file + a prompt to Gemini 2.5 Pro and
//      getting back structured JSON (the scene map)
//
// Gemini can watch up to 2 hours of video or analyze images
// natively — no need to split into frames first.
//
// Requires: GEMINI_API_KEY in environment variables
// ============================================================

import type { SceneMap } from '@/lib/types/editing';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.5-pro';

/**
 * Upload a file to Gemini's File API for processing.
 *
 * Think of this like attaching a file to an email — Gemini needs
 * the file "in its hands" before it can analyze it. The file is
 * stored temporarily (48 hours) on Google's servers.
 *
 * @param fileUrl - Public URL of the video or image
 * @param mimeType - e.g. 'video/mp4', 'image/jpeg'
 * @returns The Gemini file URI (used in the analysis call)
 */
export async function uploadFileToGemini(
  fileUrl: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  // Step 1: Download the file from our storage
  const fileResponse = await fetch(fileUrl);
  if (!fileResponse.ok) {
    throw new Error(`Failed to download source file: ${fileResponse.status}`);
  }
  const fileBuffer = await fileResponse.arrayBuffer();

  // Step 2: Start a resumable upload to Gemini
  const startUploadRes = await fetch(
    `${GEMINI_API_BASE}/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'X-Goog-Upload-Protocol': 'raw',
      },
      body: fileBuffer,
    }
  );

  if (!startUploadRes.ok) {
    const errText = await startUploadRes.text();
    throw new Error(`Gemini file upload failed: ${startUploadRes.status} — ${errText}`);
  }

  const uploadResult = await startUploadRes.json();

  // The response contains a file object with a URI we'll use in the analysis call
  const fileUri = uploadResult?.file?.uri;
  if (!fileUri) {
    throw new Error('Gemini upload succeeded but no file URI returned');
  }

  // Step 3: Wait for the file to become ACTIVE (Gemini processes it)
  // This is especially important for videos — they need to be transcoded
  const fileName = uploadResult.file.name; // e.g. "files/abc123"
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max wait (5s intervals)

  while (attempts < maxAttempts) {
    const statusRes = await fetch(
      `${GEMINI_API_BASE}/v1beta/${fileName}?key=${apiKey}`
    );
    const statusData = await statusRes.json();

    if (statusData.state === 'ACTIVE') {
      return fileUri;
    }

    if (statusData.state === 'FAILED') {
      throw new Error(`Gemini file processing failed: ${statusData.error?.message || 'Unknown error'}`);
    }

    // Still processing — wait 5 seconds and check again
    await new Promise((resolve) => setTimeout(resolve, 5000));
    attempts++;
  }

  throw new Error('Gemini file processing timed out after 5 minutes');
}

/**
 * Ask Gemini to analyze a video or image and return a scene map.
 *
 * This is the "Brain" step — Gemini watches the entire video and
 * identifies every scene, object, person, logo, timestamp, etc.
 *
 * @param fileUri - The Gemini file URI from uploadFileToGemini()
 * @param mimeType - e.g. 'video/mp4', 'image/jpeg'
 * @param instruction - The user's edit instruction (so Gemini pays
 *   extra attention to the things the user wants to change)
 * @returns A structured SceneMap
 */
export async function analyzeWithGemini(
  fileUri: string,
  mimeType: string,
  instruction: string
): Promise<{ sceneMap: SceneMap; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const isVideo = mimeType.startsWith('video/');

  const systemPrompt = isVideo
    ? `You are a video analysis engine for a professional content editing pipeline.

Watch this video completely and produce a structured JSON scene map.

For each scene, identify:
- Exact start/end timestamps (HH:MM:SS format)
- Everything visible: people, logos, text on screen, backgrounds, objects, clothing
- Where each notable object is located (bounding box estimate in pixels: x, y, w, h)
- Camera motion (static, pan, zoom, tracking, handheld, dolly, crane, drone)
- Lighting conditions (indoor/outdoor, natural/artificial, direction, quality)

For each subject (person or animal) that appears across multiple scenes, track them
with a consistent ID and note which scenes they appear in.

The user wants to make this edit: "${instruction}"

Pay EXTRA attention to any elements the user mentions in their instruction.
Find every single instance of those elements with precise timestamps and locations.
If the user mentions logos, find ALL logos. If they mention a person, track them
through every scene. Be thorough — missed elements mean missed edits.`
    : `You are an image analysis engine for a professional content editing pipeline.

Analyze this image completely and produce a structured JSON scene map.
Since this is a single image, return exactly one scene (scene_id: 1) with
start_time "00:00:00" and end_time "00:00:00".

Identify:
- Everything visible: people, logos, text, backgrounds, objects, clothing
- Where each notable object is located (bounding box estimate in pixels: x, y, w, h)
- Lighting conditions
- Any subjects (people, animals) with descriptions

The user wants to make this edit: "${instruction}"

Pay EXTRA attention to any elements the user mentions.`;

  const response = await fetch(
    `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { fileData: { mimeType, fileUri } },
              { text: systemPrompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1, // low temperature for factual analysis
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini analysis failed: ${response.status} — ${errText}`);
  }

  const result = await response.json();

  // Extract token counts for cost tracking
  const usageMetadata = result.usageMetadata || {};
  const inputTokens = usageMetadata.promptTokenCount || 0;
  const outputTokens = usageMetadata.candidatesTokenCount || 0;

  // Parse the JSON response from Gemini
  const textContent = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('Gemini returned no content');
  }

  let sceneMap: SceneMap;
  try {
    sceneMap = JSON.parse(textContent) as SceneMap;
  } catch {
    throw new Error(`Failed to parse Gemini scene map as JSON: ${textContent.slice(0, 200)}`);
  }

  // Basic validation — make sure we got the expected structure
  if (!sceneMap.scenes || !Array.isArray(sceneMap.scenes)) {
    throw new Error('Gemini scene map missing "scenes" array');
  }

  return { sceneMap, inputTokens, outputTokens };
}

/**
 * Estimate the cost of a Gemini analysis based on content type and duration.
 * These are rough estimates — actual cost depends on token counts.
 */
export function estimateGeminiCost(
  contentType: 'video' | 'image',
  durationSeconds?: number
): number {
  if (contentType === 'image') {
    return 0.02; // ~$0.02 for a single image analysis
  }
  // Video: roughly $0.50-2.00 per minute
  const minutes = (durationSeconds || 60) / 60;
  return Math.max(0.10, minutes * 0.75); // $0.75/min average estimate
}
