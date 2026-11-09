// src/lib/slack-recap/api.ts
// ─────────────────────────────────────────────────────────────
// Shared plumbing for the "Request a recap" Slack flow.
//
// - slack(): calls a Slack Web API method with the Hub bot token
// - verifySlackRequest(): proves an incoming request really came from Slack
//   (same HMAC check the /api/cascade bot uses)
// - settings: which channel the flow posts in, who may publish
// ─────────────────────────────────────────────────────────────

import crypto from "crypto";

/** #postgame-recaps — where requests, reviews and live links are posted. */
export const RECAP_CHANNEL_ID = process.env.SLACK_RECAP_CHANNEL_ID || "C0CG1B593SP";

/** Slack user ids that may publish ANY recap (the requester can always publish their own). */
export const RECAP_ADMIN_IDS = (process.env.SLACK_RECAP_ADMIN_IDS || "U07BH6EACF5")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Peyton — tagged on change requests. First admin id. */
export const RECAP_OWNER_ID = RECAP_ADMIN_IDS[0];

/** Official Google product icons, used as small labels on the link fields. */
export const SHEETS_ICON_URL =
  process.env.SLACK_SHEETS_ICON_URL ||
  "https://ssl.gstatic.com/docs/doclist/images/mediatype/icon_1_spreadsheet_x32.png";
export const DRIVE_ICON_URL =
  process.env.SLACK_DRIVE_ICON_URL ||
  "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png";

export function hubBase(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://postgame-hub.vercel.app").replace(/\/$/, "");
}

export function liveRecapUrl(slug: string): string {
  return `${hubBase()}/recap/${slug}`;
}

/** The real recap page, rendered while still a draft. Only signed-in Hub staff
 *  can open it before publish (see allowPreviewBypass in /recap/[slug]). */
export function previewRecapUrl(slug: string): string {
  return `${hubBase()}/recap/${slug}?preview=1`;
}

export function editorUrl(recapId: string): string {
  return `${hubBase()}/dashboard/${recapId}`;
}

/** Call a Slack Web API method. Never throws — returns Slack's JSON (ok:false on failure).
 *  `tokenOverride` is for workflow-step calls, which use the short-lived token
 *  Slack hands us in the function_executed event. */
export async function slack(method: string, body: Record<string, unknown>, tokenOverride?: string): Promise<any> {
  const token = tokenOverride || process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error(`[slack-recap] ${method}: SLACK_BOT_TOKEN not set`);
    return { ok: false, error: "SLACK_BOT_TOKEN not set" };
  }
  try {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json();
    if (!json.ok) {
      console.error(`[slack-recap] ${method} failed:`, json.error, JSON.stringify(json.response_metadata ?? {}));
    }
    return json;
  } catch (e: any) {
    console.error(`[slack-recap] ${method} threw:`, e?.message || e);
    return { ok: false, error: String(e?.message || e) };
  }
}

/**
 * Verify Slack's request signature (HMAC-SHA256 over "v0:timestamp:body").
 * Rejects anything older than 5 minutes to stop replays.
 */
export function verifySlackRequest(headers: Headers, rawBody: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    console.warn("[slack-recap] SLACK_SIGNING_SECRET not configured");
    return false;
  }
  const signature = headers.get("x-slack-signature");
  const timestamp = headers.get("x-slack-request-timestamp");
  if (!signature || !timestamp) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
  if (!Number.isFinite(age) || age > 300) return false;

  const expected = `v0=${crypto.createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/** Shared secret for the Hub calling its own build worker (reuses CRON_SECRET). */
export function workerAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

export function workerHeaders(): Record<string, string> {
  const secret = process.env.CRON_SECRET;
  return {
    "Content-Type": "application/json",
    ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
  };
}
