// src/lib/slack-recap/review.ts
// ─────────────────────────────────────────────────────────────
// "Ready for review": the last step of a recap build. Posts the review
// message (Preview · Publish · Request changes) in the recaps channel, tagging
// the requester, and points their "Building…" DM at it.
//
// Called by the build worker when content is done, and by the big-video
// callback when the last oversized video comes back from the ffmpeg worker.
// Posts at most once per build: the status flip to "review" is a
// compare-and-set, so two callers racing can't both post.
// ─────────────────────────────────────────────────────────────

import { createServiceSupabase } from "@/lib/supabase";
import { RECAP_CHANNEL_ID, editorUrl, previewRecapUrl, slack } from "@/lib/slack-recap/api";
import { readRequestState, summarize, type RecapRequestState } from "@/lib/slack-recap/build";
import { getCampaignForRequest } from "@/lib/slack-recap/data";
import { displayName, reviewBlocks, reviewPointerBlocks } from "@/lib/slack-recap/views";

/** Big videos still being shrunk on the ffmpeg worker. */
export function pendingBigVideos(state: RecapRequestState | null): string[] {
  return Object.entries(state?.big_videos || {})
    .filter(([, v]) => v.status === "pending")
    .map(([athleteId]) => athleteId);
}

/** Warnings for big videos the worker couldn't add. */
export function bigVideoWarnings(state: RecapRequestState | null, names: Map<string, string>): string[] {
  return Object.entries(state?.big_videos || {})
    .filter(([, v]) => v.status === "failed")
    .map(([id, v]) => `${names.get(id) || "An athlete"}'s video (${v.name}) couldn't be added automatically — add it in the Hub editor.`);
}

/** One warning when the AI photo picker failed for any athlete (folder order used instead). */
export function aiFallbackWarnings(state: RecapRequestState | null): string[] {
  const f = state?.ai_fallback || [];
  if (f.length === 0) return [];
  const names = f.slice(0, 6).map((x) => x.athlete).join(", ") + (f.length > 6 ? ` and ${f.length - 6} more` : "");
  return [`AI photo picking failed for ${f.length} athlete${f.length === 1 ? "" : "s"} (${names}) — their photos are in folder order and not framed on the athlete. Reason: ${f[0].error}`];
}

/**
 * Flip the request from `fromStatus` to "review" and post the review message.
 * Returns false (and posts nothing) if the request had already moved on.
 */
export async function postReview(recapId: string, fromStatus: RecapRequestState["status"]): Promise<boolean> {
  const supabase = createServiceSupabase();
  const { settings, state } = await readRequestState(recapId);
  if (!state || state.status !== fromStatus) return false;

  const { data: athletes } = await supabase.from("athletes").select("id, name").eq("campaign_id", recapId);
  const names = new Map(((athletes as { id: string; name: string }[]) || []).map((a) => [a.id, a.name.trim()]));
  const warnings = [...(state.summary?.warnings || []), ...bigVideoWarnings(state, names), ...aiFallbackWarnings(state)];
  const summary = await summarize(recapId, warnings);

  // Compare-and-set: only the caller that moves fromStatus → review posts.
  const next: RecapRequestState = { ...state, status: "review", summary };
  const { data: flipped } = await supabase
    .from("campaign_recaps")
    .update({ settings: { ...settings, recap_request: next } })
    .eq("id", recapId)
    .eq("settings->recap_request->>status", fromStatus)
    .select("id");
  if (!flipped || flipped.length === 0) return false;

  const campaign = await getCampaignForRequest(recapId);
  const name = campaign ? displayName(campaign) : recapId;
  const previewUrl = campaign?.slug ? previewRecapUrl(campaign.slug) : editorUrl(recapId);
  const blocks = reviewBlocks(recapId, name, previewUrl, summary);
  const text = `Ready for review: ${name}`;

  let reviewUrl: string | undefined;
  const review = await slack("chat.postMessage", {
    channel: RECAP_CHANNEL_ID,
    text: `<@${next.requested_by}> ${text}`,
    blocks: [{ type: "section", text: { type: "mrkdwn", text: `<@${next.requested_by}> your recap is ready to review.` } }, ...blocks],
    unfurl_links: false,
  });
  if (review.ok) {
    const { settings: s2, state: st2 } = await readRequestState(recapId);
    await supabase
      .from("campaign_recaps")
      .update({ settings: { ...s2, recap_request: { ...(st2 || next), review_ts: review.ts } } })
      .eq("id", recapId);
    const link = await slack("chat.getPermalink", { channel: RECAP_CHANNEL_ID, message_ts: review.ts });
    if (link.ok) reviewUrl = link.permalink;
  }
  const pointer = reviewPointerBlocks(name, reviewUrl);
  if (next.dm_channel && next.dm_ts) {
    await slack("chat.update", { channel: next.dm_channel, ts: next.dm_ts, text, blocks: pointer });
  } else if (next.requested_by) {
    await slack("chat.postMessage", { channel: next.requested_by, text, blocks: pointer, unfurl_links: false });
  }
  return true;
}
