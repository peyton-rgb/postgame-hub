// ============================================================
// Gemini 2.5 Pro video analysis tool.
//
// Two-step flow:
//   1) uploadFileToGemini — pulls the file at fileUrl, ships it
//      to the Gemini File API via the resumable protocol, polls
//      until the file enters ACTIVE state, returns its URI.
//   2) analyzeWithGemini — calls generateContent with that URI
//      and a prompt that asks for a JSON scene map.
//
// Native fetch only (no SDK) so we don't add a dependency.
// ============================================================

import type { SceneMap } from '@/lib/types/editing';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_MODEL = 'gemini-2.5-pro';
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_TRIES = 80; // ~2 minutes total

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  return key;
}

interface GeminiFileMeta {
  name: string;
  uri: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED' | string;
  mimeType: string;
  sizeBytes?: string;
}

export interface GeminiUploadResult {
  fileUri: string;
  name: string;
}

// Step 1: download the source bytes, then push to the Gemini File API
// using the resumable upload protocol. We don't actually stream chunks
// here — the Gemini API accepts a one-shot upload+finalize, which is
// fine for the file sizes we deal with.
export async function uploadFileToGemini(
  fileUrl: string,
  mimeType: string
): Promise<GeminiUploadResult> {
  const key = apiKey();

  // 1a. Pull bytes
  const srcResp = await fetch(fileUrl);
  if (!srcResp.ok) {
    throw new Error(`Failed to fetch source file: ${srcResp.status} ${srcResp.statusText}`);
  }
  const buffer = Buffer.from(await srcResp.arrayBuffer());

  // 1b. Init resumable upload — returns the upload URL in the
  //     X-Goog-Upload-URL response header.
  const initResp = await fetch(
    `${GEMINI_API_BASE}/upload/v1beta/files?key=${key}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(buffer.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { display_name: `edit-${Date.now()}` },
      }),
    }
  );

  if (!initResp.ok) {
    const text = await initResp.text();
    throw new Error(`Gemini upload init failed: ${initResp.status} ${text}`);
  }

  const uploadUrl = initResp.headers.get('x-goog-upload-url');
  if (!uploadUrl) {
    throw new Error('Gemini upload init returned no upload URL');
  }

  // 1c. Push bytes + finalize in a single request.
  const uploadResp = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(buffer.length),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: buffer,
  });

  if (!uploadResp.ok) {
    const text = await uploadResp.text();
    throw new Error(`Gemini file upload failed: ${uploadResp.status} ${text}`);
  }

  const uploadJson = (await uploadResp.json()) as { file: GeminiFileMeta };
  const file = uploadJson.file;

  // 1d. Poll until ACTIVE.
  if (file.state !== 'ACTIVE') {
    let active: GeminiFileMeta | null = null;
    for (let i = 0; i < POLL_MAX_TRIES; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const checkResp = await fetch(
        `${GEMINI_API_BASE}/v1beta/${file.name}?key=${key}`
      );
      if (!checkResp.ok) {
        const text = await checkResp.text();
        throw new Error(`Gemini file poll failed: ${checkResp.status} ${text}`);
      }
      const meta = (await checkResp.json()) as GeminiFileMeta;
      if (meta.state === 'ACTIVE') {
        active = meta;
        break;
      }
      if (meta.state === 'FAILED') {
        throw new Error(`Gemini file processing FAILED for ${file.name}`);
      }
    }
    if (!active) {
      throw new Error(`Gemini file did not become ACTIVE within ${POLL_MAX_TRIES * POLL_INTERVAL_MS / 1000}s`);
    }
    return { fileUri: active.uri, name: active.name };
  }

  return { fileUri: file.uri, name: file.name };
}

// --- Scene-map prompt + parsing ----------------------------------

const SYSTEM_PROMPT = `You are a senior video editor analyzing footage for an AI editing pipeline.

Produce a SCENE MAP as JSON describing the clip in fine detail. The map must follow this exact shape:

{
  "duration_seconds": number,
  "resolution": "<WxH>",
  "frame_rate": number,
  "scenes": [
    {
      "index": number,
      "start_time": number,
      "end_time": number,
      "description": "what's happening — concise but specific",
      "visual_tags": ["..."],
      "audio_tags": ["..."],
      "shot_type": "wide | medium | close | extreme close | overhead | aerial | etc.",
      "notable_objects": ["product, logos, text overlays, athletes, environments"]
    }
  ],
  "global_notes": "anything that spans the full clip — voice overs, music, branding, color treatment"
}

Rules:
- Every distinct beat or shot change is its own scene.
- Timestamps in seconds with one decimal of precision.
- ALWAYS surface visible logos, brand marks, and on-screen text in notable_objects.
- Return JSON ONLY. No markdown fences, no commentary, nothing outside the JSON object.`;

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiGenerateResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  usageMetadata?: GeminiUsageMetadata;
}

export interface GeminiAnalyzeResult {
  sceneMap: SceneMap;
  promptTokens: number;
  completionTokens: number;
}

function stripCodeFences(text: string): string {
  const t = text.trim();
  if (!t.startsWith('```')) return t;
  return t.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

export async function analyzeWithGemini(
  fileUri: string,
  mimeType: string,
  instruction: string
): Promise<GeminiAnalyzeResult> {
  const key = apiKey();

  const userText = `User's editing instruction: """${instruction}"""\n\nGenerate the scene map for this clip.`;

  const resp = await fetch(
    `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { file_data: { file_uri: fileUri, mime_type: mimeType } },
              { text: userText },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: 'application/json',
        },
      }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini generateContent failed: ${resp.status} ${text}`);
  }

  const data = (await resp.json()) as GeminiGenerateResponse;
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Gemini returned no text content');
  }

  let parsed: SceneMap;
  try {
    parsed = JSON.parse(stripCodeFences(rawText)) as SceneMap;
  } catch (err) {
    throw new Error(
      `Failed to parse Gemini JSON: ${err instanceof Error ? err.message : 'unknown'}\n--- raw ---\n${rawText.slice(0, 500)}`
    );
  }

  return {
    sceneMap: parsed,
    promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// --- Cost estimate -----------------------------------------------
// Gemini 2.5 Pro pricing varies by mode; this is a working estimate.
// Tune as needed once we have real usage telemetry.
const GEMINI_PRO_PER_SECOND = 0.0015; // video token pricing rough average
const GEMINI_PRO_IMAGE_FLAT = 0.005;

export function estimateGeminiCost(
  contentType: 'video' | 'image',
  durationSeconds?: number
): number {
  if (contentType === 'image') return GEMINI_PRO_IMAGE_FLAT;
  const seconds = durationSeconds && durationSeconds > 0 ? durationSeconds : 30;
  return Math.max(0.005, seconds * GEMINI_PRO_PER_SECOND);
}
