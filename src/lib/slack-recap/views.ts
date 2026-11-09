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
} as const;

export const CALLBACKS = {
  request: "recap_request",
  changes: "recap_changes",
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
          md(`*Performance tracker*${campaign.trackerUrl ? "  ·  ✓ from the Hub" : ""}`),
        ],
      },
      {
        type: "input",
        block_id: "tracker_block",
        label: plain("Google Sheets link"),
        hint: plain("Use the v2 tracker template."),
        element: {
          type: "url_text_input",
          action_id: "tracker",
          placeholder: plain("Paste the Google Sheets link"),
          ...(campaign.trackerUrl ? { initial_value: campaign.trackerUrl } : {}),
        },
      },
      {
        type: "context",
        elements: [
          { type: "image", image_url: DRIVE_ICON_URL, alt_text: "Google Drive" },
          md(`*Content folder*${campaign.contentFolderUrl ? "  ·  ✓ from the Hub" : ""}`),
        ],
      },
      {
        type: "input",
        block_id: "folder_block",
        label: plain("Google Drive folder link"),
        element: {
          type: "url_text_input",
          action_id: "folder",
          placeholder: plain("Paste the Google Drive folder link"),
          ...(campaign.contentFolderUrl ? { initial_value: campaign.contentFolderUrl } : {}),
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
    { type: "section", text: md(`🔒 <${previewUrl}|Preview the draft in the Hub>  ·  private until you publish`) },
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

export function reviewPublishedBlocks(name: string, publisherId: string, liveUrl: string, linkText: string): any[] {
  return [
    { type: "section", text: md(`✅ *Published: ${name}*\nPublished by <@${publisherId}> · <${liveUrl}|${linkText}>`) },
  ];
}

export function liveChannelBlocks(name: string, publisherId: string, liveUrl: string, linkText: string): any[] {
  const when = new Date().toLocaleString("en-US", {
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
