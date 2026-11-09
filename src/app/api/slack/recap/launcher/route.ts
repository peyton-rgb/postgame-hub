// src/app/api/slack/recap/launcher/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/slack/recap/launcher — posts the "＋ Request a recap" button
// message into #postgame-recaps (pin it afterwards). Staff/one-off use only:
// requires Bearer CRON_SECRET. Run once at setup, or again if it's deleted.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { RECAP_CHANNEL_ID, slack, workerAuthorized } from "@/lib/slack-recap/api";
import { launcherBlocks } from "@/lib/slack-recap/views";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!workerAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await slack("chat.postMessage", {
    channel: RECAP_CHANNEL_ID,
    text: "Need a campaign recap? Request one here.",
    blocks: launcherBlocks(),
  });
  if (res.ok) await slack("pins.add", { channel: RECAP_CHANNEL_ID, timestamp: res.ts });
  return NextResponse.json({ ok: !!res.ok, ts: res.ts, error: res.error });
}
