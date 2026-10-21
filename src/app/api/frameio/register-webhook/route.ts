// ============================================================
// GET /api/frameio/register-webhook  (staff only, run once)
//
// Asks Frame.io to send every comment.* event in the connected workspace to
// /api/frameio/webhook, then saves the webhook's id and signing secret into
// frameio_connection. Frame.io shows the secret only once, at creation, so
// it is stored here directly and never displayed.
//
// Safe to revisit: if a webhook is already registered it says so and does
// nothing, so it can't create duplicates.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { FRAMEIO_API, getFrameioAccessToken } from "@/lib/frameio";

export const dynamic = "force-dynamic";

const EVENTS = [
  "comment.created",
  "comment.updated",
  "comment.deleted",
  "comment.completed",
  "comment.uncompleted",
];

const WEBHOOK_URL =
  process.env.FRAMEIO_WEBHOOK_URL || "https://postgame-hub.vercel.app/api/frameio/webhook";

export async function GET(request: NextRequest) {
  const staff = await getHubStaff();
  if (!staff.ok) return NextResponse.redirect(new URL("/login", request.url));

  const supabase = createLiveServiceSupabase();
  const { data: conn, error } = await supabase
    .from("frameio_connection")
    .select("account_id, workspace_id, workspace_name, webhook_id")
    .eq("id", 1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!conn) {
    return NextResponse.json({ error: "Frame.io is not connected — visit /api/frameio/connect first" }, { status: 409 });
  }
  if (conn.webhook_id) {
    return NextResponse.json({
      ok: true,
      already_registered: true,
      webhook_id: conn.webhook_id,
      workspace: conn.workspace_name,
    });
  }
  if (!conn.account_id || !conn.workspace_id) {
    return NextResponse.json({ error: "Connection has no account/workspace saved" }, { status: 409 });
  }

  try {
    const token = await getFrameioAccessToken(supabase);
    const res = await fetch(
      `${FRAMEIO_API}/accounts/${conn.account_id}/workspaces/${conn.workspace_id}/webhooks`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { name: "Postgame Hub — comment logbook", url: WEBHOOK_URL, events: EVENTS },
        }),
        cache: "no-store",
      }
    );
    const body = await res.json().catch(() => ({}));
    const hook = body?.data as { id?: string; secret?: string; events?: string[] } | undefined;
    if (!res.ok || !hook?.id || !hook?.secret) {
      return NextResponse.json(
        { error: `Frame.io refused (${res.status})`, detail: body?.errors ?? body?.message ?? null },
        { status: 502 }
      );
    }

    const { error: saveError } = await supabase
      .from("frameio_connection")
      .update({ webhook_id: hook.id, webhook_secret: hook.secret, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (saveError) {
      // The webhook exists in Frame.io but we couldn't store its secret.
      // Report the id so it can be deleted and re-created.
      return NextResponse.json(
        { error: `Webhook created (${hook.id}) but its secret could not be saved: ${saveError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      webhook_id: hook.id,
      workspace: conn.workspace_name,
      url: WEBHOOK_URL,
      events: hook.events ?? EVENTS,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
