// ============================================================
// Frame.io webhook helpers — the "wax seal" check.
//
// Frame.io (V4) signs every webhook delivery with a secret that it hands out
// exactly once, when the webhook is created. That secret lives in Vercel as
// FRAMEIO_WEBHOOK_SECRET.
//
// Each delivery carries two headers:
//   X-Frameio-Request-Timestamp   unix seconds when Frame.io sent it
//   X-Frameio-Signature           "v0=" + hex HMAC-SHA256 of "v0:{timestamp}:{raw body}"
//
// We recompute the HMAC and compare. We also reject deliveries older than
// five minutes, so a captured request can't be replayed later.
// ============================================================

import { createHmac, timingSafeEqual } from "crypto";

const MAX_AGE_SECONDS = 5 * 60;

export function verifyFrameioSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  if (!timestamp || !signature || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > MAX_AGE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest();

  const hex = signature.trim().replace(/^v0=/, "").toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex)) return false;
  const given = Buffer.from(hex, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Pull the IDs out of a Frame.io payload. Every V4 payload has the same shape:
// { type, resource: {id, type}, account: {id}, workspace: {id}, project: {id}, user: {id} }
// Payloads carry IDs only — the comment's text has to be looked up separately.
type IdBox = { id?: unknown } | undefined | null;
const idOf = (box: IdBox): string | null =>
  box && typeof box.id === "string" && box.id ? box.id : null;

export function summarizeFrameioPayload(payload: Record<string, unknown>) {
  const resource = payload.resource as { id?: unknown; type?: unknown } | undefined;
  return {
    event_type: typeof payload.type === "string" ? payload.type : "unknown",
    resource_type: resource && typeof resource.type === "string" ? resource.type : null,
    resource_id: idOf(resource),
    account_id: idOf(payload.account as IdBox),
    workspace_id: idOf(payload.workspace as IdBox),
    project_id: idOf(payload.project as IdBox),
    user_id: idOf(payload.user as IdBox),
  };
}
