// src/app/api/slack/recap/set-cover/route.ts
// ─────────────────────────────────────────────────────────────
// Set one video's cover by hand, from a moment in the video.
//
//   GET /api/slack/recap/set-cover?media=<video media id>&t=<seconds>
//   GET /api/slack/recap/set-cover?media=<video media id>&image=<https link>
//
// With image=, a finished cover (e.g. retouched/graded in Adobe) is used
// as-is instead of grabbing a still. Only Adobe's presigned links are allowed.
//
// Grabs the still at t seconds, crops it on the athlete with the person
// detector, saves it and makes it the video's cover (thumbnail_url) — which is
// also the athlete's card on the recap. Open in a browser while logged in to
// the Hub as staff.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { setCoverFromImage, setCoverFromStill } from "@/lib/slack-recap/build";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const text = (msg: string, status = 200) =>
  new NextResponse(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(req: Request) {
  const staff = await getHubStaff();
  if (!staff.ok) return text("Log in to the Hub as staff first, then open this link again.", 401);
  const url = new URL(req.url);
  const media = url.searchParams.get("media") || "";
  const image = url.searchParams.get("image") || "";
  if (media && image) {
    try {
      const cover = await setCoverFromImage(media, image);
      return text(`Cover set from the edited image.\n${cover}`);
    } catch (e: any) {
      return text(`Couldn't set the cover: ${e?.message || e}`, 500);
    }
  }
  const t = Number(url.searchParams.get("t"));
  if (!media || !Number.isFinite(t) || t < 0) return text("Add ?media=<video media id>&t=<seconds> (or &image=<link>) to the link.", 400);
  try {
    const cover = await setCoverFromStill(media, t);
    return text(`Cover set from the still at ${t}s.\n${cover}`);
  } catch (e: any) {
    return text(`Couldn't set the cover: ${e?.message || e}`, 500);
  }
}
