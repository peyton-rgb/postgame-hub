// ============================================================
// Slack direct messages (bot token, env-gated)
//
// Sends a PRIVATE DM from the "Postgame Hub" bot to one person. Deliberately
// separate from lib/slack.ts, which posts to a shared channel through an
// incoming webhook: these messages name an athlete and are addressed to the one
// manager who owns the campaign, so they must never land in a channel.
//
// Three Web API calls, plain fetch, no SDK:
//   1. users.lookupByEmail  → the user id behind an @pstgm.com address
//   2. conversations.open   → the DM channel with that user
//   3. chat.postMessage     → the message itself
//
// SCOPES: conversations.open needs `im:write`, which the app does not have at
// time of writing. Until it is added and the app reinstalled, step 2 returns
// missing_scope and this module logs and gives up — it never throws.
//
// STUB-SAFE throughout: no bot token, no recipient, or a Slack-side failure all
// resolve to a logged no-op. Nothing here is allowed to fail a caller.
// ============================================================

const SLACK_API = "https://slack.com/api";

/** What happened, for the caller's own logging. Never throws. */
export type DmOutcome =
  | { ok: true; channel: string; recipient: string; usedFallback: boolean }
  | { ok: false; reason: string; usedFallback: boolean };

interface SlackResponse {
  ok?: boolean;
  error?: string;
  user?: { id?: string };
  channel?: { id?: string };
}

/** POST to a Slack Web API method. Returns null when the call cannot be made. */
async function slackPost(method: string, body: Record<string, unknown>): Promise<SlackResponse | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        // The token is a credential — it goes in the header and is never logged,
        // not on the success path and not in any error below.
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    return (await res.json()) as SlackResponse;
  } catch (e) {
    console.error(`[slack-dm] ${method} request failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Slack user id for an email address, or null if there isn't one. */
async function lookupUserId(email: string): Promise<string | null> {
  const body = await slackPost("users.lookupByEmail", { email });
  if (!body?.ok) {
    // users_not_found is routine (the person isn't in the workspace, or their
    // Slack email differs from their Asana one) — the caller falls back.
    console.warn(`[slack-dm] users.lookupByEmail failed for ${email}: ${body?.error ?? "no response"}`);
    return null;
  }
  return body.user?.id ?? null;
}

/** Open (or reuse) the DM channel with a user id. Needs the `im:write` scope. */
async function openDm(userId: string): Promise<string | null> {
  const body = await slackPost("conversations.open", { users: userId });
  if (!body?.ok) {
    console.warn(`[slack-dm] conversations.open failed: ${body?.error ?? "no response"}`);
    return null;
  }
  return body.channel?.id ?? null;
}

/** Deliver one message to one email address. Returns false if it didn't land. */
async function deliver(email: string, text: string): Promise<boolean> {
  const userId = await lookupUserId(email);
  if (!userId) return false;

  const channel = await openDm(userId);
  if (!channel) return false;

  // `text` doubles as the notification/plain-text fallback, so the message is
  // readable on a lock screen and not just inside the Slack client.
  const body = await slackPost("chat.postMessage", { channel, text, mrkdwn: true });
  if (!body?.ok) {
    console.warn(`[slack-dm] chat.postMessage failed: ${body?.error ?? "no response"}`);
    return false;
  }
  return true;
}

/**
 * DM the campaign manager, falling back to SLACK_FALLBACK_EMAIL.
 *
 * The fallback is used in two different situations, and both matter:
 *   • no manager is mapped for the campaign  → `text` is prefixed with a warning
 *     so the recipient knows why it reached them and that Asana needs fixing
 *   • a manager IS mapped but Slack can't reach them → the message is forwarded
 *     unprefixed rather than dropped
 */
export async function dmCampaignManager(
  managerEmail: string | null | undefined,
  text: string,
  unmappedNotice: string,
): Promise<DmOutcome> {
  if (!process.env.SLACK_BOT_TOKEN) {
    return { ok: false, reason: "SLACK_BOT_TOKEN is not set", usedFallback: false };
  }

  const fallback = (process.env.SLACK_FALLBACK_EMAIL ?? "").trim();
  const manager = (managerEmail ?? "").trim();

  if (manager) {
    if (await deliver(manager, text)) {
      return { ok: true, channel: "dm", recipient: manager, usedFallback: false };
    }
    // Mapped but unreachable: still the right message, just the wrong inbox.
    if (fallback && fallback !== manager && (await deliver(fallback, text))) {
      return { ok: true, channel: "dm", recipient: fallback, usedFallback: true };
    }
    return { ok: false, reason: `could not reach ${manager} or the fallback`, usedFallback: true };
  }

  if (!fallback) {
    return { ok: false, reason: "no manager mapped and SLACK_FALLBACK_EMAIL is not set", usedFallback: false };
  }
  if (await deliver(fallback, `${unmappedNotice}\n\n${text}`)) {
    return { ok: true, channel: "dm", recipient: fallback, usedFallback: true };
  }
  return { ok: false, reason: `could not reach the fallback ${fallback}`, usedFallback: true };
}
