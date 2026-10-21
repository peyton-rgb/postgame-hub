// ============================================================
// GET /api/frameio/connect  (staff only)
//
// Sends the signed-in staff member to Adobe's sign-in page to connect the
// Hub to Frame.io. A random `state` value is stored in a short-lived cookie
// and checked by /api/frameio/callback, so a forged return trip is rejected.
// ============================================================

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { frameioConfig, IMS_AUTHORIZE_URL } from "@/lib/frameio";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const staff = await getHubStaff();
  if (!staff.ok) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cfg = frameioConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "FRAMEIO_CLIENT_ID / FRAMEIO_CLIENT_SECRET are not set" },
      { status: 503 }
    );
  }

  const state = randomBytes(24).toString("hex");
  const url = new URL(IMS_AUTHORIZE_URL);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", cfg.scopes);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("frameio_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/frameio",
    maxAge: 10 * 60,
  });
  return res;
}
