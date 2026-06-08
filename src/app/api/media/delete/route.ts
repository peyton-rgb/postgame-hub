// src/app/api/media/delete/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/media/delete   (application/json)
// Body: { mediaId }
//
// Deletes a single media row and best-effort removes its backing
// Storage objects (the primary file and, for videos, the separate
// poster/thumbnail image).
//
// Storage layout is messy: many older rows have storage_path /
// storage_bucket = NULL, and some files are Wix-hosted (not in
// Supabase storage at all). So we resolve the bucket+path from the
// explicit columns when present, otherwise parse them out of a
// Supabase public URL, and skip anything external.
//
// Storage removal is best-effort — if it fails we still delete the
// DB row (an orphaned object is far less bad than a phantom row).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PUBLIC_MARKER = "/storage/v1/object/public/";

// URL-decode each path segment. The real Storage object key is the DECODED
// form (a literal space, not "%20"); .remove() matches on that. Decoding a
// path that has no encoding is a harmless no-op.
function decodePathSegments(path: string): string {
  return path
    .split("/")
    .map((seg) => {
      try {
        return decodeURIComponent(seg);
      } catch {
        return seg;
      }
    })
    .join("/");
}

// Parse a Supabase public URL into its { bucket, path } pair.
// The segment right after "/public/" is the bucket; everything after
// that is the object path. The path is URL-DECODED for remove().
// Returns null for non-Supabase (e.g. wixstatic.com) URLs.
function parseSupabasePublicUrl(url: string): { bucket: string; path: string } | null {
  const idx = url.indexOf(PUBLIC_MARKER);
  if (idx === -1) return null;
  const rest = url.slice(idx + PUBLIC_MARKER.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  const bucket = rest.slice(0, slash);
  // Strip any query string, then decode each path segment.
  const rawPath = rest.slice(slash + 1).split("?")[0];
  if (!bucket || !rawPath) return null;
  const path = decodePathSegments(rawPath);
  return { bucket, path };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const mediaId = String(body.mediaId || "");
    if (!mediaId) {
      return NextResponse.json({ error: "Missing required field: mediaId." }, { status: 400 });
    }

    const supabase = createServiceSupabase();

    const { data: media, error: lookupError } = await supabase
      .from("media")
      .select("id, type, file_url, thumbnail_url, storage_path, storage_bucket")
      .eq("id", mediaId)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: "Media lookup failed: " + lookupError.message },
        { status: 500 }
      );
    }
    if (!media) {
      return NextResponse.json({ error: "Media not found." }, { status: 404 });
    }

    // Collect storage objects to delete, grouped by bucket.
    const byBucket: Record<string, string[]> = {};
    const addTarget = (bucket: string, path: string) => {
      if (!bucket || !path) return;
      const list = (byBucket[bucket] ||= []);
      if (!list.includes(path)) list.push(path);
    };

    // PRIMARY FILE — prefer the explicit columns, fall back to parsing the URL.
    if (media.storage_path && media.storage_bucket) {
      // storage_path may be stored URL-ENCODED ("Arkansas%20Sweeps.mov") even
      // though the real object key is decoded — decode before removing.
      addTarget(media.storage_bucket, decodePathSegments(media.storage_path));
    } else if (media.file_url) {
      const parsed = parseSupabasePublicUrl(media.file_url);
      if (parsed) addTarget(parsed.bucket, parsed.path);
      // External (e.g. wixstatic.com) → no storage object to remove.
    }

    // POSTER / THUMBNAIL — videos store a separate poster image here.
    if (
      media.thumbnail_url &&
      media.thumbnail_url !== media.file_url &&
      media.thumbnail_url.includes(PUBLIC_MARKER)
    ) {
      const parsed = parseSupabasePublicUrl(media.thumbnail_url);
      if (parsed) addTarget(parsed.bucket, parsed.path);
    }

    // Best-effort storage removal — log failures but never fail the request.
    const deletedStorage: string[] = [];
    for (const [bucket, paths] of Object.entries(byBucket)) {
      try {
        const { error: rmError } = await supabase.storage.from(bucket).remove(paths);
        if (rmError) {
          console.error(`[media/delete] storage remove failed for ${bucket}:`, rmError.message);
        } else {
          deletedStorage.push(...paths);
        }
      } catch (e: any) {
        console.error(`[media/delete] storage remove threw for ${bucket}:`, e?.message || e);
      }
    }

    // Delete the DB row — this one is authoritative.
    const { error: deleteError } = await supabase.from("media").delete().eq("id", mediaId);
    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete media record: " + deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deletedStorage, rowDeleted: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Delete failed" }, { status: 500 });
  }
}
