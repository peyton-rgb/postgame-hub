// src/app/api/slack/recap/log-legacy/route.ts
// ─────────────────────────────────────────────────────────────
// Log a recap that went through the OLD #campaign-recaps flow in the new
// recaps channel, so the channel stays the one place every request shows up.
//
//   GET /api/slack/recap/log-legacy?recap=<slug>&requested_by=<Slack user id>
//       &requested_at=<ISO time>&published_by=<Slack user id>&published_at=<ISO time>
//
// Posts the same two messages the new flow does — "New recap request" and
// "Recap live" — with the real dates, and saves the request record on the
// recap (settings.recap_request, status "published"). The recap must already
// be published. Running it twice does nothing the second time. Staff only.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase";
import { RECAP_CHANNEL_ID, liveRecapUrl, slack } from "@/lib/slack-recap/api";
import { getCampaignForRequest } from "@/lib/slack-recap/data";
import { displayName, legacyRequestBlocks, liveChannelBlocks, recapLinkText } from "@/lib/slack-recap/views";
import { readRequestState, writeRequestState } from "@/lib/slack-recap/build";

export const dynamic = "force-dynamic";

const text = (msg: string, status = 200) =>
  new NextResponse(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

const SLACK_USER = /^U[A-Z0-9]{6,}$/;

export async function GET(req: Request) {
  const staff = await getHubStaff();
  if (!staff.ok) return text("Log in to the Hub as staff first, then open this link again.", 401);
  const q = new URL(req.url).searchParams;
  const slug = q.get("recap") || "";
  const requestedBy = q.get("requested_by") || "";
  const publishedBy = q.get("published_by") || "";
  const requestedAt = new Date(q.get("requested_at") || "");
  const publishedAt = new Date(q.get("published_at") || "");
  if (!slug || !SLACK_USER.test(requestedBy) || !SLACK_USER.test(publishedBy) || isNaN(+requestedAt) || isNaN(+publishedAt)) {
    return text("Needs ?recap=<slug>&requested_by=<Slack user id>&requested_at=<ISO>&published_by=<Slack user id>&published_at=<ISO>.", 400);
  }

  const supabase = createServiceSupabase();
  const { data: row } = await supabase.from("campaign_recaps").select("id, slug, published").eq("slug", slug).maybeSingle();
  const recap = row as { id: string; slug: string; published: boolean } | null;
  if (!recap) return text(`No recap with slug ${slug}.`, 404);
  if (!recap.published) return text(`${slug} isn't published yet — use the normal Publish button instead.`, 409);
  const { state } = await readRequestState(recap.id);
  if (state) return text(`${slug} already has a request record (status: ${state.status}). Nothing posted.`);

  const campaign = await getCampaignForRequest(recap.id);
  const name = campaign ? displayName(campaign) : slug;
  const linkText = campaign ? recapLinkText(campaign) : "VIEW RECAP";
  const live = liveRecapUrl(recap.slug);

  const post = await slack("chat.postMessage", {
    channel: RECAP_CHANNEL_ID,
    text: `New recap request: ${name}`,
    blocks: legacyRequestBlocks(requestedBy, name, requestedAt),
  });
  await slack("chat.postMessage", {
    channel: RECAP_CHANNEL_ID,
    text: `Recap live: ${name} ${live}`,
    blocks: liveChannelBlocks(name, publishedBy, live, linkText, publishedAt),
    unfurl_links: false,
  });
  await writeRequestState(recap.id, {
    status: "published",
    requested_by: requestedBy,
    requested_at: requestedAt.toISOString(),
    takeaways: "",
    channel_ts: post?.ts,
    published_by: publishedBy,
    published_at: publishedAt.toISOString(),
  });
  return text(`Logged ${name} in the recaps channel as submitted and published.`);
}
