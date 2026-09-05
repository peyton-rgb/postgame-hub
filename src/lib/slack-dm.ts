// ============================================================
// Slack direct messages (bot token, env-gated)
//
// Sends a PRIVATE DM from the "Postgame Hub" bot to one person. Deliberately
// separate from lib/slack.ts, which posts to a shared channel through an
// incoming webhook: these messages name an athlete and are addressed to the one
// manager who owns the campaign, so they must never land in a channel.
//
// Up to three Web API calls, plain fetch, no SDK:
//   1. users.lookupByEmail  → the user id behind an @pstgm.com address
//                             SKIPPED when profiles.slack_user_id is set
//   2. conversations.open   → the DM channel with that user
//   3. chat.postMessage     → the message itself
//
// Step 1 is the fragile one: it is the only call needing users:read.email, and
// it is the only one that can fail for reasons outside this app (the person's
// Slack email differing from their Asana one, a deactivated account). So a
// recipient whose profiles.slack_user_id is populated skips it entirely and
// goes straight to step 2. Email lookup remains the fallback for everyone
// whose id has not been recorded yet.
//
// SCOPES: chat:write and im:write (conversations.open) are required on every
// path; users:read / users:read.email are required ONLY for the email-lookup
// path. If a scope is missing the affected call returns missing_scope and this
// module logs and gives up; it never throws.
//
// Note that a stored id cannot rescue a token that is missing chat:write or
// im:write, nor an invalid_auth token — those break every path equally.
//
// STUB-SAFE throughout: no bot token, no recipient, or a Slack-side failure all
// resolve to a logged no-op. Nothing here is allowed to fail a caller.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

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
  /** Slack puts the actually useful detail here — "missing required field:
   *  email" arrives beside a bare `invalid_arguments`. Logged with the code,
   *  because the code alone sent the first debug of this down the wrong path. */
  response_metadata?: { messages?: string[] };
}

/** Slack's error code plus whatever detail it attached. Never includes the token. */
function describeError(body: SlackResponse | null): string {
  if (!body) return "no response";
  const detail = (body.response_metadata?.messages ?? []).join("; ");
  return detail ? `${body.error ?? "unknown"} (${detail})` : (body.error ?? "unknown");
}

/**
 * POST to a Slack Web API method. Returns null when the call cannot be made.
 *
 * Form-encoded, NOT JSON. users.lookupByEmail is one of the Web API methods
 * that accepts only application/x-www-form-urlencoded: handed a JSON body it
 * does not read the parameters at all and answers `invalid_arguments` with
 * "missing required field: email", which is exactly how this failed in
 * production on 31 Aug. Every method used here takes flat string parameters and
 * all three accept form encoding, so one encoding serves the whole module and
 * the distinction cannot bite again. Anything richer (Block Kit) would need to
 * move back to JSON on the methods that support it.
 */
async function slackPost(method: string, params: Record<string, unknown>): Promise<SlackResponse | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: "POST",
      headers: {
        // The token is a credential — it goes in the header and is never logged,
        // not on the success path and not in any error below.
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)]),
      ).toString(),
    });
    return (await res.json()) as SlackResponse;
  } catch (e) {
    console.error(`[slack-dm] ${method} request failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * A Supabase client that can read `profiles`.
 *
 * Aliased to the library's own client type rather than a hand-rolled structural
 * interface: the builder chain's real types are generic and do not match a
 * simplified shape, and slack-dm still imports no app code — callers hand a
 * client in, or don't.
 */
export type ProfileReader = SupabaseClient;

/**
 * The Slack id recorded against an email in `profiles`, or null.
 *
 * `ilike` rather than `eq`: manager_email arrives from Asana and its casing is
 * not guaranteed to match the profile row. Never throws — a database hiccup
 * here must degrade to the email lookup, not lose the message.
 */
async function storedUserId(db: ProfileReader | undefined, email: string): Promise<string | null> {
  if (!db) return null;
  try {
    const { data } = await db
      .from("profiles")
      .select("slack_user_id")
      .ilike("email", email)
      .maybeSingle();
    const id = (data as { slack_user_id: string | null } | null)?.slack_user_id;
    return id ?? null;
  } catch (e) {
    console.warn(`[slack-dm] profiles lookup failed for ${email}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Slack user id for an email address, or null if there isn't one. */
async function lookupUserId(email: string): Promise<string | null> {
  const body = await slackPost("users.lookupByEmail", { email });
  if (!body?.ok) {
    // users_not_found is routine (the person isn't in the workspace, or their
    // Slack email differs from their Asana one) — the caller falls back.
    console.warn(`[slack-dm] users.lookupByEmail failed for ${email}: ${describeError(body)}`);
    return null;
  }
  return body.user?.id ?? null;
}

/** Open (or reuse) the DM channel with a user id. Needs the `im:write` scope. */
async function openDm(userId: string): Promise<string | null> {
  const body = await slackPost("conversations.open", { users: userId });
  if (!body?.ok) {
    console.warn(`[slack-dm] conversations.open failed: ${describeError(body)}`);
    return null;
  }
  return body.channel?.id ?? null;
}

/**
 * Deliver one message to one person. Returns false if it didn't land.
 *
 * Stored id first, email lookup second. The stored id is trusted without a
 * round-trip: if it is stale, conversations.open says so and the caller falls
 * back to the next recipient exactly as it would for a failed lookup.
 */
async function deliver(email: string, text: string, db?: ProfileReader): Promise<boolean> {
  const stored = await storedUserId(db, email);
  const userId = stored ?? (await lookupUserId(email));
  if (!userId) return false;
  if (stored) console.log(`[slack-dm] using stored slack_user_id for ${email} (no email lookup)`);

  const channel = await openDm(userId);
  if (!channel) return false;

  // `text` doubles as the notification/plain-text fallback, so the message is
  // readable on a lock screen and not just inside the Slack client.
  //
  // Unfurling off in both directions: the only link in these messages is a Hub
  // dashboard behind staff auth, so a preview card can never show anything but
  // a login page — it would add a block of dead chrome under a deliberately
  // four-line message.
  const body = await slackPost("chat.postMessage", {
    channel,
    text,
    mrkdwn: true,
    unfurl_links: false,
    unfurl_media: false,
  });
  if (!body?.ok) {
    console.warn(`[slack-dm] chat.postMessage failed: ${describeError(body)}`);
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
  db?: ProfileReader,
): Promise<DmOutcome> {
  if (!process.env.SLACK_BOT_TOKEN) {
    return { ok: false, reason: "SLACK_BOT_TOKEN is not set", usedFallback: false };
  }

  const fallback = (process.env.SLACK_FALLBACK_EMAIL ?? "").trim();
  const manager = (managerEmail ?? "").trim();

  if (manager) {
    if (await deliver(manager, text, db)) {
      return { ok: true, channel: "dm", recipient: manager, usedFallback: false };
    }
    // Mapped but unreachable: still the right message, just the wrong inbox.
    const fallbackUsable = Boolean(fallback) && fallback !== manager;
    if (fallbackUsable && (await deliver(fallback, text, db))) {
      return { ok: true, channel: "dm", recipient: fallback, usedFallback: true };
    }
    // Say which recipients were actually tried. The old wording claimed "or the
    // fallback" even when no fallback was configured or it was the same address
    // as the manager, which sent the first debug of this looking for a failure
    // that had never been attempted.
    const reason = !fallback
      ? `could not reach ${manager}; SLACK_FALLBACK_EMAIL is not set`
      : fallback === manager
        ? `could not reach ${manager} (SLACK_FALLBACK_EMAIL is the same address)`
        : `could not reach ${manager} or the fallback ${fallback}`;
    return { ok: false, reason, usedFallback: fallbackUsable };
  }

  if (!fallback) {
    return { ok: false, reason: "no manager mapped and SLACK_FALLBACK_EMAIL is not set", usedFallback: false };
  }
  if (await deliver(fallback, `${unmappedNotice}\n\n${text}`, db)) {
    return { ok: true, channel: "dm", recipient: fallback, usedFallback: true };
  }
  return { ok: false, reason: `could not reach the fallback ${fallback}`, usedFallback: true };
}
