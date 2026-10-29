// src/app/api/drive/pick-best/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/pick-best
// Body: { files: Array<{ id, name, mimeType }> }  (one athlete's or team's files)
// Returns: { ids: string[] }  — the files the picker should pre-select:
//   • the latest version of the video (see pickLatestVideo)
//   • up to 10 best photos that aren't near-copies of each other
//
// Each photo is measured from Drive's small preview image (not the full
// 10MB+ original), so a 50-photo folder takes seconds, not minutes.
// Measurements: a 64-bit dHash fingerprint for copy detection, and a
// quality score = edge sharpness, penalised for very dark/blown-out frames.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getDriveClient } from "@/lib/drive-import";
import { getGoogleAuth } from "@/lib/google-auth";
import { pickBestPhotos, pickLatestVideo, type MeasuredPhoto } from "@/lib/pick-best";
import { dHash, quality } from "@/lib/pick-best-measure";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 150;
const CONCURRENCY = 6;

interface InFile {
  id: string;
  name: string;
  mimeType: string;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const authClient = createServerSupabase();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const files: InFile[] = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
    if (files.length === 0) return NextResponse.json({ ids: [] });

    const drive = getDriveClient();
    const { token } = await getGoogleAuth().getAccessToken();

    const videos = files.filter((f) => f.mimeType?.startsWith("video/"));
    const photos = files.filter((f) => f.mimeType?.startsWith("image/"));

    const videoMeta = await mapLimit(videos, CONCURRENCY, async (f) => {
      try {
        const r = await drive.files.get({ fileId: f.id, supportsAllDrives: true, fields: "modifiedTime" });
        return { id: f.id, name: f.name, modifiedTime: r.data.modifiedTime ?? null };
      } catch {
        return { id: f.id, name: f.name, modifiedTime: null };
      }
    });

    const measured: MeasuredPhoto[] = await mapLimit(photos, CONCURRENCY, async (f) => {
      try {
        const r = await drive.files.get({ fileId: f.id, supportsAllDrives: true, fields: "thumbnailLink" });
        const link = r.data.thumbnailLink;
        if (!link) return { id: f.id, name: f.name, hash: null, quality: 0 };
        // Ask Drive for a ~400px preview instead of the default 220px.
        const url = link.replace(/=s\d+$/, "=s400");
        const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) return { id: f.id, name: f.name, hash: null, quality: 0 };
        const img = Buffer.from(await res.arrayBuffer());
        const [hash, flipHash, q] = await Promise.all([dHash(img), dHash(img, true), quality(img)]);
        return { id: f.id, name: f.name, hash, flipHash, quality: q };
      } catch {
        return { id: f.id, name: f.name, hash: null, quality: 0 };
      }
    });

    const latestVideo = pickLatestVideo(videoMeta);
    const ids = [...(latestVideo ? [latestVideo] : []), ...pickBestPhotos(measured)];
    return NextResponse.json({
      ids,
      measured: measured.filter((m) => m.hash).length,
      photos: photos.length,
      videos: videos.length,
    });
  } catch (error: any) {
    console.error("[drive/pick-best] Error:", error);
    return NextResponse.json({ error: error?.message || "Pick best failed" }, { status: 500 });
  }
}
