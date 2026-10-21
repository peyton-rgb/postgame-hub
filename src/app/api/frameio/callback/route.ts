// ============================================================
// GET /api/frameio/callback  (Adobe redirects here after sign-in)
//
// 1. Checks the staff session and the `state` cookie from /connect.
// 2. Trades Adobe's one-time code for access + refresh tokens.
// 3. Looks up the Frame.io account and workspace this login can see.
// 4. Saves everything to frameio_connection (single row, id = 1).
// 5. Sends the user back to /admin/settings with a status flag.
//
// Tokens are never logged or shown; only error codes are.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { exchangeCode, expiresAtFrom, frameioGet } from "@/lib/frameio";

export const dynamic = "force-dynamic";

type Named = { id: string; name?: string };
type ListResponse = { data?: Named[] };
type MeResponse = { data?: { email?: string } };

function back(request: NextRequest, status: string, detail?: string) {
  const url = new URL("/admin/settings", request.url);
  url.searchParams.set("frameio", status);
  if (detail) url.searchParams.set("frameio_detail", detail.slice(0, 200));
  const res = NextResponse.redirect(url);
  res.cookies.delete({ name: "frameio_oauth_state", path: "/api/frameio" });
  return res;
}

export async function GET(request: NextRequest) {
  const staff = await getHubStaff();
  if (!staff.ok) return NextResponse.redirect(new URL("/login", request.url));

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(request, "denied", params.get("error") ?? undefined);

  const code = params.get("code");
  const state = params.get("state");
  const expected = request.cookies.get("frameio_oauth_state")?.value;
  if (!code || !state || !expected || state !== expected) {
    return back(request, "error", "Sign-in check failed — try Connect again");
  }

  try {
    const tokens = await exchangeCode(code);

    // Which Frame.io account / workspace does this login reach?
    const accounts = await frameioGet<ListResponse>(tokens.access_token, "/accounts");
    const account = accounts.data?.[0];
    let workspace: Named | undefined;
    if (account) {
      const ws = await frameioGet<ListResponse>(
        tokens.access_token,
        `/accounts/${account.id}/workspaces`
      );
      // Only auto-pick when there is exactly one; otherwise leave it for a
      // deliberate choice rather than guessing.
      if (ws.data?.length === 1) workspace = ws.data[0];
    }
    const me = await frameioGet<MeResponse>(tokens.access_token, "/me").catch(() => ({} as MeResponse));

    const now = new Date().toISOString();
    const supabase = createLiveServiceSupabase();
    const { error } = await supabase.from("frameio_connection").upsert({
      id: 1,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: expiresAtFrom(tokens.expires_in),
      account_id: account?.id ?? null,
      workspace_id: workspace?.id ?? null,
      workspace_name: workspace?.name ?? null,
      user_email: me.data?.email ?? null,
      connected_by: staff.id,
      connected_at: now,
      updated_at: now,
    });
    if (error) throw new Error(`Could not save connection: ${error.message}`);

    return back(request, "connected");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[frameio-callback]", msg);
    return back(request, "error", msg);
  }
}
