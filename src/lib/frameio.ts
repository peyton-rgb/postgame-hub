// ============================================================
// Frame.io (V4) connection helpers.
//
// Frame.io V4 signs in through Adobe (IMS). The flow:
//   1. /api/frameio/connect  -> sends a staff member to Adobe's sign-in page
//   2. Adobe sends them back to /api/frameio/callback with a one-time code
//   3. The callback trades that code for an access token (short-lived) and a
//      refresh token (long-lived), and saves both in frameio_connection.
//
// frameio_connection holds exactly ONE row (id = 1, enforced by a CHECK
// constraint): the company's single Frame.io connection.
//
// Env (Vercel): FRAMEIO_CLIENT_ID, FRAMEIO_CLIENT_SECRET
// Optional:     FRAMEIO_REDIRECT_URI  (defaults to production callback)
//               FRAMEIO_SCOPES        (must match the scopes on the Adobe
//                                      Developer Console credential)
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export const IMS_AUTHORIZE_URL = "https://ims-na1.adobelogin.com/ims/authorize/v2";
export const IMS_TOKEN_URL = "https://ims-na1.adobelogin.com/ims/token/v3";
export const FRAMEIO_API = "https://api.frame.io/v4";

const DEFAULT_REDIRECT = "https://postgame-hub.vercel.app/api/frameio/callback";
const DEFAULT_SCOPES = "openid,email,profile,offline_access,additional_info.roles";

export function frameioConfig() {
  const clientId = process.env.FRAMEIO_CLIENT_ID;
  const clientSecret = process.env.FRAMEIO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.FRAMEIO_REDIRECT_URI || DEFAULT_REDIRECT,
    scopes: process.env.FRAMEIO_SCOPES || DEFAULT_SCOPES,
  };
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number; // seconds
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(IMS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    // Never log the body: on success it contains tokens. On failure it holds
    // an error code and description, which is safe and useful.
    const reason = [body.error, body.error_description].filter(Boolean).join(": ");
    throw new Error(`Adobe token request failed (${res.status})${reason ? `: ${reason}` : ""}`);
  }
  return body as TokenResponse;
}

export function exchangeCode(code: string) {
  const cfg = frameioConfig();
  if (!cfg) throw new Error("Frame.io is not configured");
  return tokenRequest({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
  });
}

function refresh(refreshToken: string) {
  const cfg = frameioConfig();
  if (!cfg) throw new Error("Frame.io is not configured");
  return tokenRequest({
    grant_type: "refresh_token",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    refresh_token: refreshToken,
  });
}

export const expiresAtFrom = (expiresIn?: number) =>
  new Date(Date.now() + (expiresIn ?? 3600) * 1000).toISOString();

// Returns a usable access token, refreshing it first if it expires within
// two minutes. Needs a service-role client (frameio_connection is staff-only).
export async function getFrameioAccessToken(supabase: SupabaseClient): Promise<string> {
  const { data: conn, error } = await supabase
    .from("frameio_connection")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(`Could not read frameio_connection: ${error.message}`);
  if (!conn?.access_token) throw new Error("Frame.io is not connected");

  const expiresAt = conn.expires_at ? new Date(conn.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 2 * 60 * 1000) return conn.access_token;

  if (!conn.refresh_token) throw new Error("Frame.io token expired and no refresh token is stored — reconnect");
  const t = await refresh(conn.refresh_token);
  await supabase
    .from("frameio_connection")
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? conn.refresh_token,
      expires_at: expiresAtFrom(t.expires_in),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  return t.access_token;
}

// Small GET wrapper for the Frame.io V4 API.
export async function frameioGet<T = unknown>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${FRAMEIO_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Frame.io GET ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}
