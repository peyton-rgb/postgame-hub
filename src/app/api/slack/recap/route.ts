// src/app/api/slack/recap/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/slack/recap — Slack interactivity for "Request a recap".
//
// Configure in the Slack app (api.slack.com → Postgame Hub):
//   Interactivity → Request URL            = https://postgame-hub.vercel.app/api/slack/recap
//   Interactivity → Select Menus (Options) = https://postgame-hub.vercel.app/api/slack/recap
//
// Handles every payload type the flow produces:
//   block_suggestion → Brand / Campaign dropdown options (live from the Hub)
//   block_actions    → open form · brand picked · campaign picked · Publish · Request changes
//   view_submission  → form Submit (validate → kick off build) · change-request note
//
// Slack gives us 3 seconds: anything slow runs after the response (waitUntil).
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase";
import {
  RECAP_ADMIN_IDS,
  RECAP_CHANNEL_ID,
  RECAP_OWNER_ID,
  editorUrl,
  liveRecapUrl,
  slack,
  verifySlackRequest,
} from "@/lib/slack-recap/api";
import {
  getCampaignForRequest,
  isAlreadyBuilt,
  searchBrands,
  searchCampaigns,
} from "@/lib/slack-recap/data";
import {
  folderLinkError,
  readRequestState,
  trackerLinkError,
  writeRequestState,
} from "@/lib/slack-recap/build";
import { kickWorker } from "@/lib/slack-recap/worker";
import {
  ACTIONS,
  CALLBACKS,
  buildingBlocks,
  changesModal,
  channelRequestBlocks,
  displayName,
  liveChannelBlocks,
  recapLinkText,
  requestModal,
  reviewPublishedBlocks,
  type RequestMeta,
} from "@/lib/slack-recap/views";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ok = () => new NextResponse(null, { status: 200 });

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySlackRequest(req.headers, raw)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const payloadStr = new URLSearchParams(raw).get("payload");
  if (!payloadStr) return NextResponse.json({ error: "no payload" }, { status: 400 });

  let payload: any;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  try {
    switch (payload.type) {
      case "block_suggestion":
        return NextResponse.json({ options: await suggest(payload) });
      case "block_actions":
        await handleAction(payload);
        return ok();
      case "view_submission":
        return await handleSubmission(payload);
      // "Request a recap" global shortcut — lives in the message box's
      // "+" / "/" menu so the form is reachable from any channel or DM,
      // not just the pinned launcher post.
      case "shortcut":
        if (payload.callback_id === ACTIONS.openRequest) {
          await slack("views.open", { trigger_id: payload.trigger_id, view: requestModal({}, null) });
        }
        return ok();
      default:
        return ok();
    }
  } catch (e: any) {
    console.error("[slack-recap] handler error:", e?.message || e);
    return ok();
  }
}

// ── Dropdown options ──────────────────────────────────────────────────────────

async function suggest(payload: any) {
  const query = String(payload.value || "");
  if (payload.action_id === ACTIONS.brand) return searchBrands(query);
  if (payload.action_id === ACTIONS.campaign) {
    const meta = readMeta(payload.view);
    return searchCampaigns(meta.brandId || "", query);
  }
  return [];
}

function readMeta(view: any): RequestMeta {
  try {
    return JSON.parse(view?.private_metadata || "{}");
  } catch {
    return {};
  }
}

// ── Buttons + dropdown picks ──────────────────────────────────────────────────

async function handleAction(payload: any) {
  const action = payload.actions?.[0];
  if (!action) return;
  const userId: string = payload.user?.id;

  switch (action.action_id) {
    case ACTIONS.openRequest: {
      await slack("views.open", { trigger_id: payload.trigger_id, view: requestModal({}, null) });
      return;
    }

    case ACTIONS.brand: {
      const sel = action.selected_option;
      const meta: RequestMeta = { brandId: sel?.value, brandName: sel?.text?.text };
      await slack("views.update", {
        view_id: payload.view.id,
        hash: payload.view.hash,
        view: requestModal(meta, null),
      });
      return;
    }

    case ACTIONS.campaign: {
      const meta = readMeta(payload.view);
      const recapId = action.selected_option?.value as string | undefined;
      const campaign = recapId ? await getCampaignForRequest(recapId) : null;
      const builtUrl =
        campaign && isAlreadyBuilt(campaign)
          ? campaign.published
            ? liveRecapUrl(campaign.slug)
            : editorUrl(campaign.id)
          : undefined;
      await slack("views.update", {
        view_id: payload.view.id,
        hash: payload.view.hash,
        view: requestModal({ ...meta, recapId }, campaign, builtUrl),
      });
      return;
    }

    case ACTIONS.requestChanges: {
      const recapId = action.value as string;
      const campaign = await getCampaignForRequest(recapId);
      await slack("views.open", {
        trigger_id: payload.trigger_id,
        view: changesModal(recapId, payload.channel?.id, payload.message?.ts, campaign ? displayName(campaign) : "this recap"),
      });
      return;
    }

    case ACTIONS.publish: {
      // Respond to Slack first; publishing + messages happen right after.
      waitUntil(publish(action.value as string, userId, payload.channel?.id, payload.message?.ts));
      return;
    }
  }
}

async function publish(recapId: string, userId: string, msgChannel?: string, msgTs?: string) {
  const { state } = await readRequestState(recapId);
  const allowed = userId === state?.requested_by || RECAP_ADMIN_IDS.includes(userId);
  if (!allowed) {
    if (msgChannel) {
      await slack("chat.postEphemeral", {
        channel: msgChannel,
        user: userId,
        text: `Only <@${state?.requested_by}> or <@${RECAP_OWNER_ID}> can publish this recap.`,
      });
    }
    return;
  }
  if (state?.status === "published") return; // double-click guard

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("campaign_recaps")
    .update({ published: true, status: "published" })
    .eq("id", recapId)
    .select("slug")
    .single();
  if (error || !data) {
    console.error("[slack-recap] publish failed:", error?.message);
    if (msgChannel) {
      await slack("chat.postEphemeral", {
        channel: msgChannel,
        user: userId,
        text: `Publishing failed (${error?.message || "unknown error"}). Peyton's been tagged.`,
      });
    }
    await slack("chat.postMessage", {
      channel: RECAP_CHANNEL_ID,
      text: `<@${RECAP_OWNER_ID}> publishing recap ${recapId} failed: ${error?.message || "unknown error"}`,
    });
    return;
  }

  const slug = (data as any).slug as string;
  try {
    revalidatePath(`/recap/${slug}`);
  } catch {
    /* page renders fresh on next request anyway */
  }

  const campaign = await getCampaignForRequest(recapId);
  const name = campaign ? displayName(campaign) : slug;
  const linkText = campaign ? recapLinkText(campaign) : "VIEW RECAP";
  const live = liveRecapUrl(slug);
  await writeRequestState(recapId, {
    status: "published",
    published_by: userId,
    published_at: new Date().toISOString(),
  });

  if (msgChannel && msgTs) {
    await slack("chat.update", {
      channel: msgChannel,
      ts: msgTs,
      text: `Published: ${name}`,
      blocks: reviewPublishedBlocks(name, userId, live, linkText),
    });
  }
  await slack("chat.postMessage", {
    channel: RECAP_CHANNEL_ID,
    text: `Recap live: ${name} ${live}`,
    blocks: liveChannelBlocks(name, userId, live, linkText),
    unfurl_links: false,
  });
  if (userId !== RECAP_OWNER_ID) {
    await slack("chat.postMessage", {
      channel: RECAP_OWNER_ID,
      text: `Heads-up: <@${userId}> published *${name}* · <${live}|${linkText}>`,
      unfurl_links: false,
    });
  }
}

// ── Form submissions ──────────────────────────────────────────────────────────

async function handleSubmission(payload: any) {
  const view = payload.view;
  const userId: string = payload.user?.id;

  if (view.callback_id === CALLBACKS.changes) {
    const meta = JSON.parse(view.private_metadata || "{}");
    const note = view.state.values?.changes_block?.changes?.value?.trim() || "";
    waitUntil(postChanges(meta.recapId, userId, note));
    return ok();
  }

  if (view.callback_id !== CALLBACKS.request) return ok();

  const meta = readMeta(view);
  const v = view.state.values || {};
  const errors: Record<string, string> = {};

  const campaign = meta.recapId ? await getCampaignForRequest(meta.recapId) : null;
  if (!campaign) {
    errors[`campaign_block_${meta.brandId}`] = "Pick a campaign.";
    return NextResponse.json({ response_action: "errors", errors });
  }
  if (isAlreadyBuilt(campaign)) {
    errors[`campaign_block_${meta.brandId}`] = "A recap is already built for this campaign.";
    return NextResponse.json({ response_action: "errors", errors });
  }

  const trackerUrl: string = (v.tracker_block?.tracker?.value || "").trim();
  const folderUrl: string = (v.folder_block?.folder?.value || "").trim();
  const due: string | undefined = v.due_block?.due?.selected_date || undefined;
  const takeaways: string = (v.takeaways_block?.takeaways?.value || "").trim();
  const notes: string | undefined = (v.notes_block?.notes?.value || "").trim() || undefined;

  const tErr = trackerLinkError(trackerUrl);
  if (tErr) errors.tracker_block = tErr;
  const fErr = folderLinkError(folderUrl);
  if (fErr) errors.folder_block = fErr;
  if (Object.keys(errors).length) return NextResponse.json({ response_action: "errors", errors });

  waitUntil(
    startRequest({ recapId: campaign.id, name: displayName(campaign), userId, trackerUrl, folderUrl, due, takeaways, notes }),
  );
  return ok(); // closes the form
}

async function startRequest(r: {
  recapId: string;
  name: string;
  userId: string;
  trackerUrl: string;
  folderUrl: string;
  due?: string;
  takeaways: string;
  notes?: string;
}) {
  const dm = await slack("chat.postMessage", {
    channel: r.userId,
    text: `Building your recap: ${r.name}`,
    blocks: buildingBlocks(r.name),
  });
  const post = await slack("chat.postMessage", {
    channel: RECAP_CHANNEL_ID,
    text: `New recap request: ${r.name}`,
    blocks: channelRequestBlocks(r.userId, r.name, r.due),
  });
  if (r.notes && post.ok) {
    await slack("chat.postMessage", {
      channel: RECAP_CHANNEL_ID,
      thread_ts: post.ts,
      text: `Notes from <@${r.userId}>:\n> ${r.notes.replace(/\n/g, "\n> ")}`,
    });
  }

  await writeRequestState(r.recapId, {
    status: "building",
    requested_by: r.userId,
    requested_at: new Date().toISOString(),
    due: r.due,
    takeaways: r.takeaways,
    notes: r.notes,
    dm_channel: dm.ok ? dm.channel : undefined,
    dm_ts: dm.ok ? dm.ts : undefined,
    channel_ts: post.ok ? post.ts : undefined,
    content_tried: [],
    error: undefined,
  });

  const accepted = await kickWorker({
    recapId: r.recapId,
    phase: "data",
    trackerUrl: r.trackerUrl,
    folderUrl: r.folderUrl,
    takeaways: r.takeaways,
  });
  if (!accepted) {
    await slack("chat.postMessage", {
      channel: RECAP_CHANNEL_ID,
      ...(post.ok ? { thread_ts: post.ts } : {}),
      text: `<@${RECAP_OWNER_ID}> the build for *${r.name}* couldn't start. Check the Hub logs.`,
    });
  }
}

async function postChanges(recapId: string, userId: string, note: string) {
  const { state } = await readRequestState(recapId);
  const campaign = await getCampaignForRequest(recapId);
  const name = campaign ? displayName(campaign) : recapId;
  await slack("chat.postMessage", {
    channel: RECAP_CHANNEL_ID,
    ...(state?.channel_ts ? { thread_ts: state.channel_ts, reply_broadcast: true } : {}),
    text:
      `✏️ <@${RECAP_OWNER_ID}> changes requested on *${name}* by <@${userId}>:\n` +
      `> ${note.replace(/\n/g, "\n> ")}\n<${editorUrl(recapId)}|Open it in the Hub>`,
  });
}
