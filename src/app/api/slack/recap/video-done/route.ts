// src/app/api/slack/recap/video-done/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/slack/recap/video-done — the ffmpeg worker reporting back on an
// oversized recap video it was asked to shrink (see kickVideoWorker).
//
// Auth: x-ffmpeg-secret (FFMPEG_WORKER_SECRET), same as /api/drive/render-callback.
// Body: { jobId: "<recapId>:<athleteId>", ok, publicUrl?, storagePath?, error? }
//
// On success the video becomes the athlete's first card item (sort_order 0)
// and gets an AI-picked cover. Either way the job is marked finished, and when
// the last one for a build is in, the "Ready for review" message posts.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createServiceSupabase } from "@/lib/supabase";
import { pickCoverForVideo, readRequestState, writeRequestState } from "@/lib/slack-recap/build";
import { pendingBigVideos, postReview } from "@/lib/slack-recap/review";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.FFMPEG_WORKER_SECRET;
  if (!secret || req.headers.get("x-ffmpeg-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as
    | { jobId?: string; ok?: boolean; publicUrl?: string; storagePath?: string; error?: string }
    | null;
  const [recapId, athleteId] = String(body?.jobId || "").split(":");
  if (!recapId || !athleteId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  waitUntil(finish(recapId, athleteId, body!).catch((e) => console.error("[slack-recap/video-done]", e)));
  return NextResponse.json({ accepted: true });
}

async function finish(
  recapId: string,
  athleteId: string,
  body: { ok?: boolean; publicUrl?: string; storagePath?: string; error?: string },
) {
  const supabase = createServiceSupabase();
  const { state } = await readRequestState(recapId);
  const job = state?.big_videos?.[athleteId];
  if (!job || job.status !== "pending") return; // unknown or already handled

  let status: "done" | "failed" = "failed";
  let error = body.error || "the worker reported a failure";
  if (body.ok && body.publicUrl) {
    // Idempotent: a retried callback must not add the video twice.
    const { data: existing } = await supabase
      .from("media")
      .select("id")
      .eq("campaign_id", recapId)
      .eq("athlete_id", athleteId)
      .eq("drive_file_id", job.drive_file_id)
      .limit(1);
    let mediaId = (existing as { id: string }[] | null)?.[0]?.id;
    if (!mediaId) {
      const { data: firstPhoto } = await supabase
        .from("media")
        .select("file_url")
        .eq("campaign_id", recapId)
        .eq("athlete_id", athleteId)
        .eq("type", "image")
        .order("sort_order", { ascending: true })
        .limit(1);
      const { data: inserted, error: insErr } = await supabase
        .from("media")
        .insert({
          campaign_id: recapId,
          athlete_id: athleteId,
          type: "video",
          file_url: body.publicUrl,
          // Placeholder until the AI cover pick below finishes.
          thumbnail_url: (firstPhoto as { file_url: string }[] | null)?.[0]?.file_url ?? null,
          is_video_thumbnail: false,
          drive_file_id: job.drive_file_id,
          sort_order: 0,
          storage_path: body.storagePath ?? null,
        })
        .select("id")
        .single();
      if (insErr) error = `couldn't save the video: ${insErr.message}`;
      else mediaId = (inserted as { id: string }).id;
    }
    if (mediaId) {
      await pickCoverForVideo(recapId, mediaId);
      status = "done";
    }
  }

  // Mark this job finished (re-read: other callbacks may have landed meanwhile).
  const { state: now } = await readRequestState(recapId);
  const big = { ...(now?.big_videos || {}) };
  big[athleteId] = { ...big[athleteId], status, ...(status === "failed" ? { error } : {}) };
  const next = await writeRequestState(recapId, { big_videos: big, heartbeat_at: new Date().toISOString() });

  if (next.status === "waiting_videos" && pendingBigVideos(next).length === 0) {
    await postReview(recapId, "waiting_videos");
  }
}
