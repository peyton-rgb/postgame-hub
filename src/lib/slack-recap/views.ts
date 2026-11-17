// src/lib/slack-recap/views.ts
// ─────────────────────────────────────────────────────────────
// Block Kit for the "Request a recap" flow: the pop-up form and every
// message the Hub bot posts along the way. Pure functions — no I/O.
// Matches the mockups Peyton approved on 2026-11-09.
// ─────────────────────────────────────────────────────────────

import { DRIVE_ICON_URL, SHEETS_ICON_URL } from "@/lib/slack-recap/api";
import type { CampaignForRequest, SlackOption } from "@/lib/slack-recap/data";
import { campaignLabel } from "@/lib/slack-recap/data";

export const ACTIONS = {
  openRequest: "open_recap_request",
  brand: "brand",
  campaign: "campaign",
  publish: "publish_recap",
  requestChanges: "request_recap_changes",
  openTracker: "open_tracker_request",
  trackerBrand: "tracker_brand",
  trackerCampaign: "tracker_campaign",
} as const;

export const CALLBACKS = {
  request: "recap_request",
  changes: "recap_changes",
  tracker: "tracker_request",
} as const;

export interface RequestMeta {
  brandId?: string;
  brandName?: string;
  recapId?: string;
}

const plain = (text: string) => ({ type: "plain_text" as const, text, emoji: true });
const md = (text: string) => ({ type: "mrkdwn" as const, text });

/** "CVS · 2026 Halloween" */
export function displayName(c: Pick<CampaignForRequest, "client_name" | "admin_name" | "name">): string {
  const brand = (c.client_name || "").trim();
  const name = (c.admin_name || c.name || "").trim();
  return brand ? `${brand} · ${name}` : name;
}

/** "CVS HALLOWEEN RECAP" — the link text the Recap Queue always used. */
export function recapLinkText(c: Pick<CampaignForRequest, "client_name" | "admin_name" | "name">): string {
  const brand = (c.client_name || "").trim();
  const name = (c.admin_name || c.name || "").trim().replace(/^20\d\d\s+/, "");
  return `${brand} ${name} recap`.trim().toUpperCase();
}

export function prettyDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// ── Pop-up form ───────────────────────────────────────────────────────────────

export function requestModal(
  meta: RequestMeta,
  campaign: CampaignForRequest | null,
  alreadyBuiltUrl?: string,
  /** The campaign's v2 tracker, filled into the tracker field when known. */
  prefillTrackerUrl?: string,
): Record<string, unknown> {
  const blocks: any[] = [];

  blocks.push({
    type: "input",
    block_id: "brand_block",
    dispatch_action: true,
    label: plain("Brand"),
    element: {
      type: "external_select",
      action_id: ACTIONS.brand,
      placeholder: plain("Choose a brand"),
      min_query_length: 0,
      ...(meta.brandId && meta.brandName
        ? { initial_option: { text: plain(meta.brandName), value: meta.brandId } }
        : {}),
    },
  });

  if (!meta.brandId) {
    blocks.push({ type: "context", elements: [md("Pick a brand to see its campaigns.")] });
  } else {
    // block_id carries the brand so switching brands resets the campaign pick.
    blocks.push({
      type: "input",
      block_id: `campaign_block_${meta.brandId}`,
      dispatch_action: true,
      label: plain("Campaign"),
      element: {
        type: "external_select",
        action_id: ACTIONS.campaign,
        placeholder: plain(`Choose a ${meta.brandName ?? ""} campaign`.replace(/\s+/g, " ")),
        min_query_length: 0,
        ...(campaign
          ? { initial_option: { text: plain(campaignLabel(campaign).slice(0, 75)), value: campaign.id } }
          : {}),
      },
    });
  }

  if (campaign && alreadyBuiltUrl) {
    blocks.push({
      type: "section",
      text: md(
        `:warning: *A recap is already built for this campaign.*\n` +
          `<${alreadyBuiltUrl}|Open it in the Hub> — ping Peyton if it needs a rebuild.`,
      ),
    });
  } else if (campaign) {
    blocks.push(
      {
        type: "context",
        elements: [
          { type: "image", image_url: SHEETS_ICON_URL, alt_text: "Google Sheets" },
          md("*Performance tracker*"),
        ],
      },
      {
        type: "input",
        block_id: "tracker_block",
        label: plain("Google Sheets link"),
        hint: plain(
          prefillTrackerUrl
            ? "Filled in from this campaign's v2 tracker. Change it if you're using a different sheet."
            : "Use the v2 tracker template.",
        ),
        element: {
          type: "url_text_input",
          action_id: "tracker",
          placeholder: plain("Paste the Google Sheets link"),
          ...(prefillTrackerUrl ? { initial_value: prefillTrackerUrl } : {}),
        },
      },
      {
        type: "context",
        elements: [
          { type: "image", image_url: DRIVE_ICON_URL, alt_text: "Google Drive" },
          md("*Content folder*"),
        ],
      },
      {
        type: "input",
        block_id: "folder_block",
        label: plain("Google Drive folder link"),
        element: {
          type: "url_text_input",
          action_id: "folder",
          placeholder: plain("Paste the folder that holds the athlete content"),
        },
      },
      {
        type: "input",
        block_id: "due_block",
        label: plain("When do you need it?"),
        hint: plain("Your recap meeting date."),
        element: { type: "datepicker", action_id: "due", placeholder: plain("Pick a date") },
      },
      {
        type: "input",
        block_id: "overview_block",
        label: plain("Campaign overview"),
        hint: plain("Shows at the top of the recap, under Campaign Overview."),
        element: {
          type: "plain_text_input",
          action_id: "overview",
          multiline: true,
          placeholder: plain("What was the campaign? Goals, who took part, what they posted."),
        },
      },
      {
        type: "input",
        block_id: "takeaways_block",
        label: plain("Key takeaways"),
        element: {
          type: "plain_text_input",
          action_id: "takeaways",
          multiline: true,
          placeholder: plain("What went well? What should the client know?"),
        },
      },
      {
        type: "input",
        block_id: "notes_block",
        optional: true,
        label: plain("Anything else?"),
        element: {
          type: "plain_text_input",
          action_id: "notes",
          multiline: true,
          placeholder: plain("Goals, KPI targets, notes for Peyton"),
        },
      },
    );
  }

  const canSubmit = !!campaign && !alreadyBuiltUrl;
  return {
    type: "modal",
    callback_id: CALLBACKS.request,
    private_metadata: JSON.stringify(meta),
    title: plain("Request a recap"),
    close: plain("Cancel"),
    ...(canSubmit ? { submit: plain("Submit") } : {}),
    blocks,
  };
}

export function changesModal(recapId: string, channel: string, ts: string, name: string): Record<string, unknown> {
  return {
    type: "modal",
    callback_id: CALLBACKS.changes,
    private_metadata: JSON.stringify({ recapId, channel, ts }),
    title: plain("Request changes"),
    submit: plain("Send to Peyton"),
    close: plain("Cancel"),
    blocks: [
      { type: "section", text: md(`What needs fixing on *${name}*?`) },
      {
        type: "input",
        block_id: "changes_block",
        label: plain("Changes"),
        element: {
          type: "plain_text_input",
          action_id: "changes",
          multiline: true,
          placeholder: plain("e.g. Esther's cover should be the reel, not the photo"),
        },
      },
    ],
  };
}

// ── Messages ──────────────────────────────────────────────────────────────────

export function launcherBlocks(): any[] {
  return [
    {
      type: "section",
      text: md("*Need a campaign recap?*\nPick the campaign and the Hub builds it for you. You review it, then publish."),
      accessory: {
        type: "button",
        action_id: ACTIONS.openRequest,
        style: "primary",
        text: plain("＋ Request a recap"),
      },
    },
  ];
}

export function channelRequestBlocks(requesterId: string, name: string, due?: string): any[] {
  return [
    {
      type: "section",
      text: md(`🆕 *New recap request: ${name}*\nFrom <@${requesterId}>${due ? ` · due ${prettyDate(due)}` : ""} · the Hub is building it now.`),
    },
  ];
}

export function buildingBlocks(name: string): any[] {
  return [
    {
      type: "section",
      text: md(`⏳ *Building your recap: ${name}*\nImporting the tracker and content now. I'll message you here when it's ready to review.`),
    },
  ];
}

export interface BuildSummary {
  athletes: number;
  mediaImported: number;
  missingContent: string[];
  warnings: string[];
}

function warningLines(s: BuildSummary): string[] {
  const lines = [...s.warnings];
  if (s.missingContent.length) {
    const shown = s.missingContent.slice(0, 8).join(", ");
    const more = s.missingContent.length > 8 ? ` and ${s.missingContent.length - 8} more` : "";
    lines.push(`${s.missingContent.length} athlete${s.missingContent.length === 1 ? "" : "s"} have no content yet: ${shown}${more}`);
  }
  return lines;
}

export function reviewBlocks(recapId: string, name: string, previewUrl: string, s: BuildSummary): any[] {
  const warn = warningLines(s);
  return [
    {
      type: "section",
      text: md(
        `👀 *Ready for review: ${name}*\n` +
          `${s.athletes} athletes · ${s.mediaImported} pieces of content imported.\n` +
          `Check the numbers, covers and takeaways.`,
      ),
    },
    { type: "section", text: md(`🔒 <${previewUrl}|Preview the recap>  ·  only Postgame staff can see it until you publish`) },
    ...(warn.length ? [{ type: "context", elements: [md(warn.map((w) => `:warning: ${w}`).join("\n"))] }] : []),
    {
      type: "actions",
      block_id: "review_actions",
      elements: [
        {
          type: "button",
          action_id: ACTIONS.publish,
          style: "primary",
          text: plain("🚀 Publish"),
          value: recapId,
          confirm: {
            title: plain("Publish this recap?"),
            text: md(`*${name}* will go live at a shareable link.`),
            confirm: plain("Publish"),
            deny: plain("Cancel"),
          },
        },
        { type: "button", action_id: ACTIONS.requestChanges, text: plain("Request changes"), value: recapId },
      ],
    },
  ];
}

export function reviewPointerBlocks(name: string, threadUrl?: string): any[] {
  return [
    {
      type: "section",
      text: md(
        `👀 *Ready for review: ${name}*\n` +
          (threadUrl ? `<${threadUrl}|Open the review in #campaign-recaps>` : "Open the review in the recaps channel thread.") +
          ` to preview and publish.`,
      ),
    },
  ];
}

export function reviewPublishedBlocks(name: string, publisherId: string, liveUrl: string, linkText: string): any[] {
  return [
    { type: "section", text: md(`✅ *Published: ${name}*\nPublished by <@${publisherId}> · <${liveUrl}|${linkText}>`) },
  ];
}

/** A request made in the old #campaign-recaps flow, logged here after the fact. */
export function legacyRequestBlocks(requesterId: string, name: string, requestedAt: Date): any[] {
  const when = requestedAt.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  return [
    {
      type: "section",
      text: md(`🆕 *New recap request: ${name}*\nFrom <@${requesterId}> · submitted ${when} in the old #campaign-recaps channel · logged here`),
    },
  ];
}

export function liveChannelBlocks(name: string, publisherId: string, liveUrl: string, linkText: string, at?: Date): any[] {
  const when = (at || new Date()).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return [
    {
      type: "section",
      text: md(`✅ *Recap live: ${name}*\nPublished by <@${publisherId}> · ${when}\n🔗 <${liveUrl}|${linkText}>`),
    },
  ];
}

export function failedBlocks(name: string, reason: string, editor: string): any[] {
  return [
    {
      type: "section",
      text: md(`:x: *The build hit a problem: ${name}*\n${reason}\nPeyton's been tagged. <${editor}|Open it in the Hub>`),
    },
  ];
}

export type { SlackOption };

// ── "Get a v2 performance tracker" ───────────────────────────────────────────

export interface TrackerMeta {
  brandId?: string;
  brandName?: string;
  recapId?: string;
  /** What getTrackerStatus found for the picked campaign. */
  kind?: "none" | "v2" | "old" | "no_folder";
}

/** The pop-up form: Brand → Campaign, then a one-line status of that campaign's tracker. */
export function trackerModal(meta: TrackerMeta, campaign: CampaignForRequest | null): Record<string, unknown> {
  const blocks: any[] = [
    {
      type: "section",
      text: md("Pick the campaign you're tracking. The Hub makes a fresh v2 tracker, names it and files it in the campaign's folder."),
    },
    {
      type: "input",
      block_id: "tracker_brand_block",
      dispatch_action: true,
      label: plain("Brand"),
      element: {
        type: "external_select",
        action_id: ACTIONS.trackerBrand,
        placeholder: plain("Choose a brand"),
        min_query_length: 0,
        ...(meta.brandId && meta.brandName
          ? { initial_option: { text: plain(meta.brandName), value: meta.brandId } }
          : {}),
      },
    },
  ];

  if (meta.brandId) {
    blocks.push({
      type: "input",
      block_id: `tracker_campaign_block_${meta.brandId}`,
      dispatch_action: true,
      label: plain("Campaign"),
      element: {
        type: "external_select",
        action_id: ACTIONS.trackerCampaign,
        placeholder: plain(`Choose a ${meta.brandName ?? ""} campaign`.replace(/\s+/g, " ")),
        min_query_length: 0,
        ...(campaign
          ? { initial_option: { text: plain(campaignLabel(campaign).slice(0, 75)), value: campaign.id } }
          : {}),
      },
    });
  } else {
    blocks.push({ type: "context", elements: [md("Pick a brand to see its campaigns.")] });
  }

  const status: Record<string, string> = {
    none: ":white_check_mark: No tracker yet. A new v2 tracker will be made.",
    old: ":arrows_counterclockwise: This campaign has an old-layout tracker. A fresh v2 tracker will be made, and the old one gets \"(old layout)\" added to its name.",
    v2: ":page_facing_up: This campaign already has a v2 tracker. You'll get its link.",
    no_folder: ":warning: This campaign doesn't have a Drive folder yet, so there's nowhere to put a tracker. It gets one when it's created in the admin. Ping Peyton if that's not happening.",
  };
  if (campaign && meta.kind) blocks.push({ type: "context", elements: [md(status[meta.kind])] });

  const canSubmit = !!campaign && meta.kind !== "no_folder";
  return {
    type: "modal",
    callback_id: CALLBACKS.tracker,
    private_metadata: JSON.stringify(meta),
    title: plain("Performance tracker"),
    close: plain("Cancel"),
    ...(canSubmit ? { submit: plain(meta.kind === "v2" ? "Get the link" : "Create tracker") } : {}),
    blocks,
  };
}

/** DM'd to the person once the tracker exists. */
export function trackerReadyBlocks(r: {
  name: string;
  outcome: "created" | "existing";
  trackerName: string;
  trackerUrl: string;
  folderUrl: string;
  renamedOld?: string;
}): any[] {
  const head = r.outcome === "created" ? `*Your tracker is ready: ${r.name}*` : `*Here's the tracker for ${r.name}*`;
  const lines = [
    head,
    `:bar_chart: ${r.trackerName}`,
    ...(r.renamedOld ? [`_The old-layout tracker is still in the folder as "${r.renamedOld}"._`] : []),
  ];
  return [
    { type: "section", text: md(lines.join("\n")) },
    {
      type: "actions",
      elements: [
        { type: "button", style: "primary", text: plain("Open tracker"), url: r.trackerUrl, action_id: "tracker_open_sheet" },
        { type: "button", text: plain("Open folder"), url: r.folderUrl, action_id: "tracker_open_folder" },
      ],
    },
    { type: "context", elements: [md("This campaign's recap request will fill in this tracker automatically.")] },
  ];
}

export function trackerFailedBlocks(name: string, reason: string): any[] {
  return [
    {
      type: "section",
      text: md(`:warning: *Couldn't make the tracker for ${name}*\n${reason}\nPeyton's been tagged.`),
    },
  ];
}
