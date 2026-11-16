// src/app/api/slack/recap/build/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/slack/recap/build — background worker for "Request a recap".
//
// Called by the Hub itself (Bearer CRON_SECRET), never by Slack directly.
// Body: { recapId, phase: "data" | "content" | "covers", trackerUrl?, folderUrl?, overview?, takeaways? }
// ("covers" re-picks the video covers of an already-built recap — started from
// /api/slack/recap/covers — and DMs the owner when done.)
//
// Replies 202 immediately and does the work after responding (waitUntil), so
// the caller never waits on a long build. The content phase is time-boxed;
// if athletes remain, it re-invokes itself with phase "content".
// When everything is done it swaps the requester's "Building…" DM for the
// review message (Preview · Publish · Request changes).
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { RECAP_CHANNEL_ID, RECAP_OWNER_ID, editorUrl, slack, workerAuthorized } from "@/lib/slack-recap/api";
import { kickVideoWorker, kickWorker, type WorkerBody } from "@/lib/slack-recap/worker";
import { pendingBigVideos, postReview } from "@/lib/slack-recap/review";
import { buildStoragePath } from "@/lib/drive-import";
import {
  readRequestState,
  runContentPhase,
  claimRun,
  ownsRun,
  runCoversPhase,
  runDataPhase,
  summarize,
  writeRequestState,
} from "@/lib/slack-recap/build";
import { getCampaignForRequest } from "@/lib/slack-recap/data";
import { displayName, failedBlocks } from "@/lib/slack-recap/views";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Leave headroom under maxDuration: one athlete (download, stills, AI pick,
 *  uploads) can take ~40s past the last deadline check. */
const WORK_BUDGET_MS = 200_000;

export async function POST(req: Request) {
  if (!workerAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as WorkerBody | null;
  if (!body?.recapId || !body.phase) return NextResponse.json({ error: "recapId and phase required" }, { status: 400 });

  waitUntil(work(body).catch((e) => console.error("[slack-recap/build] unhandled:", e)));
  return NextResponse.json({ accepted: true }, { status: 202 });
}

async function work(body: WorkerBody): Promise<void> {
  const deadline = Date.now() + WORK_BUDGET_MS;
  const campaign = await getCampaignForRequest(body.recapId);
  const name = campaign ? displayName(campaign) : body.recapId;

  if (body.phase === "covers") {
    const { state } = await readRequestState(body.recapId);
    const res = await runCoversPhase(body.recapId, state?.covers_done || [], deadline);
    await writeRequestState(body.recapId, { covers_done: res.handled });
    if (!res.done) {
      await kickWorker({ recapId: body.recapId, phase: "covers" });
      return;
    }
    await slack("chat.postMessage", {
      channel: RECAP_OWNER_ID,
      text: `🖼️ Covers re-picked for *${name}*: ${res.handled.length} videos checked.`,
    });
    return;
  }

  // One worker at a time: a fresh start claims the build; a hand-off must
  // still own it, otherwise a newer run has taken over and this one stops.
  let runId = body.runId;
  if (runId) {
    if (!(await ownsRun(body.recapId, runId))) {
      console.log(`[slack-recap/build] ${body.recapId}: run ${runId} superseded, stopping`);
      return;
    }
  } else {
    // A fresh start of the content phase (resume sweeper / manual resume) may
    // only pick up a request that is genuinely still building. Without this
    // the sweeper restarted finished, published and even deleted requests
    // every 2 minutes, posting a new review each time.
    if (body.phase === "content") {
      const { state } = await readRequestState(body.recapId);
      if (state?.status !== "building") {
        console.log(`[slack-recap/build] ${body.recapId}: not building (status ${state?.status ?? "none"}), ignoring resume`);
        return;
      }
    }
    runId = await claimRun(body.recapId);
  }
  const owner = runId;
  const stillOwner = () => ownsRun(body.recapId, owner);

  try {
    let extraWarnings: string[] = (await readRequestState(body.recapId)).state?.summary?.warnings || [];

    if (body.phase === "data") {
      if (!body.trackerUrl || !body.folderUrl) throw new Error("tracker and folder links are required");
      const data = await runDataPhase({
        recapId: body.recapId,
        trackerUrl: body.trackerUrl,
        folderUrl: body.folderUrl,
        overview: body.overview || "",
        takeaways: body.takeaways || "",
      });
      extraWarnings = data.warnings;
      await writeRequestState(body.recapId, {
        content_tried: [],
        heartbeat_at: new Date().toISOString(),
        summary: { athletes: data.athletes, mediaImported: 0, missingContent: [], warnings: data.warnings },
      });
    }

    const { state } = await readRequestState(body.recapId);
    const content = await runContentPhase(body.recapId, state?.content_tried || [], deadline, stillOwner);
    if (content.stopped || !(await stillOwner())) {
      console.log(`[slack-recap/build] ${body.recapId}: run ${owner} superseded, stopping`);
      return;
    }
    await writeRequestState(body.recapId, { content_tried: content.tried, heartbeat_at: new Date().toISOString() });

    // Oversized videos found this chunk → the ffmpeg worker shrinks them and
    // calls /api/slack/recap/video-done, which adds each to the recap.
    for (const bv of content.bigVideos || []) {
      const { state: s } = await readRequestState(body.recapId);
      const big = { ...(s?.big_videos || {}) };
      if (big[bv.athleteId]) continue; // already handed off
      big[bv.athleteId] = { status: "pending", drive_file_id: bv.file.id, name: bv.file.name, queued_at: new Date().toISOString() };
      await writeRequestState(body.recapId, { big_videos: big });
      const accepted = await kickVideoWorker({
        jobId: `${body.recapId}:${bv.athleteId}`,
        driveFileId: bv.file.id,
        storagePath: buildStoragePath(body.recapId, bv.athleteId, bv.file.name.replace(/\.[^.]+$/, "") + "-web.mp4"),
      });
      if (!accepted) {
        const { state: s2 } = await readRequestState(body.recapId);
        const big2 = { ...(s2?.big_videos || {}) };
        big2[bv.athleteId] = { ...big2[bv.athleteId], status: "failed", error: "video worker unreachable" };
        await writeRequestState(body.recapId, { big_videos: big2 });
      }
    }

    if (!content.done) {
      // Vercel blocks long self-call chains (508 "loop detected"). If this
      // hand-off is refused, the resume sweeper (/api/slack/recap/resume,
      // cron every 2 min) picks the build up from content_tried.
      await kickWorker({ recapId: body.recapId, phase: "content", runId: owner });
      return;
    }

    // Done. If oversized videos are still being shrunk, wait for them — the
    // last /video-done callback posts the review. Otherwise post it now.
    const summary = await summarize(body.recapId, extraWarnings);
    const { state: after } = await readRequestState(body.recapId);
    if (pendingBigVideos(after).length > 0) {
      await writeRequestState(body.recapId, { status: "waiting_videos", summary, heartbeat_at: new Date().toISOString() });
      return;
    }
    await writeRequestState(body.recapId, { summary });
    await postReview(body.recapId, "building");
  } catch (e: any) {
    const reason = String(e?.message || e);
    console.error(`[slack-recap/build] ${body.recapId} failed:`, reason);
    const next = await writeRequestState(body.recapId, { status: "failed", error: reason }).catch(() => null);
    const blocks = failedBlocks(name, reason, editorUrl(body.recapId));
    if (next?.dm_channel && next.dm_ts) {
      await slack("chat.update", { channel: next.dm_channel, ts: next.dm_ts, text: `Build problem: ${name}`, blocks });
    }
    await slack("chat.postMessage", {
      channel: RECAP_CHANNEL_ID,
      ...(next?.channel_ts ? { thread_ts: next.channel_ts } : {}),
      text: `<@${RECAP_OWNER_ID}> the automatic build for *${name}* failed: ${reason}`,
    });
  }
}
