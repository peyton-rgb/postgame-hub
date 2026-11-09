// src/app/api/slack/recap/launcher/route.ts
// ─────────────────────────────────────────────────────────────
// Posts the "＋ Request a recap" button message into the recaps channel and
// pins it. Run once at setup, or again if it's deleted.
//   GET  — open in a browser while logged in to the Hub as staff
//   POST — Bearer CRON_SECRET (scripts)
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { RECAP_CHANNEL_ID, slack, workerAuthorized } from "@/lib/slack-recap/api";
import { launcherBlocks } from "@/lib/slack-recap/views";
import { getStaffUser } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

async function postLauncher() {
  const res = await slack("chat.postMessage", {
    channel: RECAP_CHANNEL_ID,
    text: "Need a campaign recap? Request one here.",
    blocks: launcherBlocks(),
  });
  if (res.ok) await slack("pins.add", { channel: RECAP_CHANNEL_ID, timestamp: res.ts });
  return { ok: !!res.ok, ts: res.ts as string | undefined, error: res.error as string | undefined };
}

export async function POST(req: Request) {
  if (!workerAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await postLauncher());
}

export async function GET() {
  const staff = await getStaffUser();
  if (!staff) {
    return new NextResponse("Log in to the Hub as staff first, then open this link again.", { status: 401 });
  }
  const r = await postLauncher();
  const msg = r.ok
    ? "Done — the Request a recap button is posted and pinned in Slack. You can close this tab."
    : `Slack said: ${r.error || "unknown error"}. Send this message to Claude.`;
  return new NextResponse(msg, { status: r.ok ? 200 : 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
