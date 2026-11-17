// src/app/api/slack/recap/replace-photo/route.ts
// ─────────────────────────────────────────────────────────────
// Swap one recap photo for a converted or edited copy.
//
//   GET /api/slack/recap/replace-photo?media=<photo media id>&image=<https link>
//
// For photos browsers can't show (iPhone HEIC, camera raw .cr2): convert them,
// put the JPEG on Adobe, then open this link. It saves the JPEG as the photo,
// re-frames the card copy on the athlete, and repoints any of that athlete's
// videos whose cover was the old file. Open in a browser while logged in to the
// Hub as staff. Only Adobe's presigned links are allowed.
// ─────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { getHubStaff } from "@/lib/staff-auth";
import { replacePhotoFromImage } from "@/lib/slack-recap/build";

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
  if (!media || !image) return text("Add ?media=<photo media id>&image=<link> to the link.", 400);
  try {
    const r = await replacePhotoFromImage(media, image);
    return text(
      `Photo replaced.\nphoto: ${r.file_url}\ncard: ${r.thumbnail_url}\nvideo covers repointed: ${r.videos_repointed}`,
    );
  } catch (e: any) {
    return text(`Couldn't replace the photo: ${e?.message || e}`, 500);
  }
}
