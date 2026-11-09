// src/app/api/slack/recap/build/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/slack/recap/build — background worker for "Request a recap".
//
// Called by the Hub itself (Bearer CRON_SECRET), never by Slack directly.
// Body: { recapId, phase: "data" | "content", trackerUrl?, folderUrl?, takeaways? }
//
// Replies 202 immediately and does the work after responding (waitUntil), so
// the caller never waits on a long build. The content phase is time-boxed;
// if athletes remain, it re-invokes itself with phase "content".
// When everything is done it swaps the requester's "Building…" DM for the
// review message (Preview · Publish · Request changes).
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import {
  RECAP_CHANNEL_ID,
  RECAP_OWNER_ID,
  editorUrl,
  slack,
  workerAuthorized,
} from "@/lib/slack-recap/api";
import { kickWorker, type WorkerBody } from "@/lib/slack-recap/worker";
import {
  readRequestState,
  runContentPhase,
  runDataPhase,
  summarize,
  writeRequestState,
} from "@/lib/slack-recap/build";
import { getCampaignForRequest } from "@/lib/slack-recap/data";
import { displayName, failedBlocks, reviewBlocks, reviewPointerBlocks } from "@/lib/slack-recap/views";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Leave a minute of headroom under maxDuration for Slack calls + the hand-off. */
const WORK_BUDGET_MS = 230_000;

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

  try {
    let extraWarnings: string[] = (await readRequestState(body.recapId)).state?.summary?.warnings || [];

    if (body.phase === "data") {
      if (!body.trackerUrl || !body.folderUrl) throw new Error("tracker and folder links are required");
      const data = await runDataPhase({
        recapId: body.recapId,
        trackerUrl: body.trackerUrl,
        folderUrl: body.folderUrl,
        takeaways: body.takeaways || "",
      });
      extraWarnings = data.warnings;
      await writeRequestState(body.recapId, {
        content_tried: [],
        summary: { athletes: data.athletes, mediaImported: 0, missingContent: [], warnings: data.warnings },
      });
    }

    const { state } = await readRequestState(body.recapId);
    const content = await runContentPhase(body.recapId, state?.content_tried || [], deadline);
    await writeRequestState(body.recapId, { content_tried: content.tried });

    if (!content.done) {
      await kickWorker({ recapId: body.recapId, phase: "content" });
      return;
    }

    // Done — post the full review (preview link + Publish / Request changes)
    // in the channel thread under the request, and point the requester's DM at it.
    const summary = await summarize(body.recapId, extraWarnings);
    const next = await writeRequestState(body.recapId, { status: "review", summary });
    const blocks = reviewBlocks(body.recapId, name, editorUrl(body.recapId), summary);
    const text = `Ready for review: ${name}`;

    let threadUrl: string | undefined;
    const review = await slack("chat.postMessage", {
      channel: RECAP_CHANNEL_ID,
      ...(next.channel_ts ? { thread_ts: next.channel_ts } : {}),
      text: `<@${next.requested_by}> ${text}`,
      blocks: [{ type: "section", text: { type: "mrkdwn", text: `<@${next.requested_by}> your draft is ready.` } }, ...blocks],
      unfurl_links: false,
    });
    if (review.ok) {
      const link = await slack("chat.getPermalink", { channel: RECAP_CHANNEL_ID, message_ts: review.ts });
      if (link.ok) threadUrl = link.permalink;
    }
    const pointer = reviewPointerBlocks(name, threadUrl);
    if (next.dm_channel && next.dm_ts) {
      await slack("chat.update", { channel: next.dm_channel, ts: next.dm_ts, text, blocks: pointer });
    } else if (next.requested_by) {
      await slack("chat.postMessage", { channel: next.requested_by, text, blocks: pointer, unfurl_links: false });
    }
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
