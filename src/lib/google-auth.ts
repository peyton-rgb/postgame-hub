// src/lib/google-auth.ts
// ─────────────────────────────────────────────────────────────
// Shared Google OAuth2 helper.
//
// Instantiates a single authenticated OAuth2 client from the
// already-authorized refresh token. Reuse this across every Google
// API integration (Drive, Sheets, …) so we have exactly one place
// that knows how our service account talks to Google.
//
// Env vars required:
//   GOOGLE_CLIENT_ID       — Google Cloud OAuth client ID
//   GOOGLE_CLIENT_SECRET   — Google Cloud OAuth client secret
//   GOOGLE_REFRESH_TOKEN   — refresh token produced by get-refresh-token.js
// ─────────────────────────────────────────────────────────────

import { google, Auth } from "googleapis";

/**
 * Returns an authenticated `OAuth2Client` ready to pass into any
 * `google.<service>({ auth })` call (Drive, Sheets, Calendar, …).
 *
 * Usage:
 * ```ts
 * import { getGoogleAuth } from "@/lib/google-auth";
 * const auth = getGoogleAuth();
 * const sheets = google.sheets({ version: "v4", auth });
 * const drive  = google.drive({ version: "v3", auth });
 * ```
 *
 * Call this every time you need a fresh client — it's cheap; the
 * `googleapis` library handles access-token refresh internally from
 * the refresh token we set on the client, so there's no benefit to
 * caching the client across requests.
 *
 * @throws {Error} if any of GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *   or GOOGLE_REFRESH_TOKEN are missing from the process env. The
 *   error message lists exactly which ones are missing so deploy
 *   misconfigurations are obvious.
 */
export function getGoogleAuth(): Auth.OAuth2Client {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (!process.env.GOOGLE_REFRESH_TOKEN) missing.push("GOOGLE_REFRESH_TOKEN");
  if (missing.length) {
    throw new Error(
      `getGoogleAuth: missing required env var(s): ${missing.join(", ")}`
    );
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return client;
}
