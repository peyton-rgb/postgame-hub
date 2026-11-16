// src/lib/slack-recap/worker.ts
// Hand work to the background build worker (/api/slack/recap/build).
// Waits only until the worker accepts (202) — never for the build itself.

import { hubBase, workerHeaders } from "@/lib/slack-recap/api";

export interface WorkerBody {
  recapId: string;
  phase: "data" | "content" | "covers";
  trackerUrl?: string;
  folderUrl?: string;
  overview?: string;
  takeaways?: string;
  /** Set on hand-offs within one chain. Absent = a fresh start that claims the build. */
  runId?: string;
}

export async function kickWorker(body: WorkerBody): Promise<boolean> {
  try {
    const res = await fetch(`${hubBase()}/api/slack/recap/build`, {
      method: "POST",
      headers: workerHeaders(),
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status !== 202) {
      console.error("[slack-recap] worker hand-off returned", res.status);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error("[slack-recap] worker hand-off failed:", e?.message || e);
    return false;
  }
}

/**
 * Hand an oversized recap video to the Fly ffmpeg worker (/recap-video). It
 * downloads from Drive, shrinks to web size, uploads, and POSTs the result to
 * /api/slack/recap/video-done. The worker keeps this request open until it's
 * finished (minutes), so we only wait long enough for it to be delivered.
 */
export async function kickVideoWorker(job: {
  jobId: string;
  driveFileId: string;
  storagePath: string;
}): Promise<boolean> {
  const url = process.env.FFMPEG_WORKER_URL || "https://postgame-ffmpeg-worker.fly.dev";
  const secret = process.env.FFMPEG_WORKER_SECRET;
  if (!secret) {
    console.error("[slack-recap] FFMPEG_WORKER_SECRET not set — can't hand off big video", job.jobId);
    return false;
  }
  try {
    const res = await fetch(`${url}/recap-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-ffmpeg-secret": secret },
      body: JSON.stringify({ ...job, callbackUrl: `${hubBase()}/api/slack/recap/video-done` }),
      signal: AbortSignal.timeout(8000),
    });
    // A quick answer is only ever a refusal (bad secret/body); success takes minutes.
    if (!res.ok) {
      console.error("[slack-recap] video worker refused", job.jobId, res.status);
      return false;
    }
    return true;
  } catch (e: any) {
    // Timing out while the worker is busy is the normal path.
    if (e?.name === "TimeoutError" || e?.name === "AbortError") return true;
    console.error("[slack-recap] video worker hand-off failed:", e?.message || e);
    return false;
  }
}

/** People the worker's detector found in an image (see ffmpeg-worker/detect.js). */
export interface DetectResult {
  width: number;
  height: number;
  persons: { box: [number, number, number, number]; score: number }[];
  /** Set when the input was HEIC: the same photo as JPEG. */
  jpeg: Buffer | null;
}

/**
 * Ask the ffmpeg worker where the people are in a photo. Null if the worker is
 * unreachable or errors — callers fall back to the AI's own boxes.
 */
export async function detectPersons(image: Buffer): Promise<DetectResult | null> {
  const url = process.env.FFMPEG_WORKER_URL || "https://postgame-ffmpeg-worker.fly.dev";
  const secret = process.env.FFMPEG_WORKER_SECRET;
  if (!secret) {
    console.error("[slack-recap] FFMPEG_WORKER_SECRET not set — no person detection");
    return null;
  }
  try {
    const res = await fetch(`${url}/detect-person`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "x-ffmpeg-secret": secret },
      body: new Uint8Array(image),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      console.error("[slack-recap] person detection failed:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const j = (await res.json()) as any;
    return {
      width: j.width,
      height: j.height,
      persons: Array.isArray(j.persons) ? j.persons : [],
      jpeg: j.jpeg ? Buffer.from(j.jpeg, "base64") : null,
    };
  } catch (e: any) {
    console.error("[slack-recap] person detection unreachable:", e?.message || e);
    return null;
  }
}
