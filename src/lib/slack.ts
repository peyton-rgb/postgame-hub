// ============================================================
// Slack delivery (env-gated)
//
// Posts manager events to Slack via an incoming webhook (SLACK_WEBHOOK_URL).
// STUB-SAFE: if the webhook is unset it NO-OPS (in-app notifications still
// fire). Set SLACK_DRY_RUN=1 to log the payload instead of sending (echo path
// for testing without a real workspace).
//
// Events are already batched upstream (one notifyManagers() call per submit /
// per curator run), so we don't fan a single action into many Slack messages.
// ============================================================

import type { ManagerEvent } from "@/lib/manager-notify";

// Absolute base for links back into the Hub (Slack needs absolute URLs).
function hubBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://postgame-hub.vercel.app").replace(/\/$/, "");
}

// Optional per-event-type allowlist: SLACK_EVENTS="content_submitted,compliance_flag".
function eventEnabled(type: string): boolean {
  const list = process.env.SLACK_EVENTS;
  if (!list) return true;
  return list.split(",").map((s) => s.trim()).includes(type);
}

const EMOJI: Record<string, string> = {
  content_submitted: ":inbox_tray:",
  post_awaiting_verification: ":satellite_antenna:",
  compliance_flag: ":rotating_light:",
  new_optin: ":wave:",
  deadline_soon: ":hourglass_flowing_sand:",
  deadline_passed: ":alarm_clock:",
};

// Build a simple Slack mrkdwn string with a link back to the Hub.
export function formatSlack(ev: ManagerEvent): string {
  const emoji = EMOJI[ev.type] || ":bell:";
  const link = ev.linkUrl ? `\n<${hubBase()}${ev.linkUrl}|Open in the Hub>` : "";
  const body = ev.message ? `\n${ev.message}` : "";
  return `${emoji} *${ev.title}*${body}${link}`;
}

// Post to Slack. No-op without a webhook; dry-run logs instead of sending.
export async function sendSlack(type: string, text: string): Promise<void> {
  if (!eventEnabled(type)) return;

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    // TODO: set SLACK_WEBHOOK_URL to enable Slack delivery. In-app still works.
    return;
  }
  if (process.env.SLACK_DRY_RUN === "1") {
    console.log("[slack dry-run]", JSON.stringify({ text }));
    return;
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    console.error(`[slack] webhook responded ${res.status}`);
  }
}
