// src/app/api/drive/list-folder-files/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/list-folder-files
// Body: { folderUrl: string, recapId: string }
//
// Lists the immediate media files (images/videos) in a Drive folder
// so the per-athlete folder picker can render thumbnails to pick
// from. Reports which file ids are already imported for this recap
// so the picker can grey them out.
//
// Used by the per-athlete Drive folder picker in the recap editor —
// for athletes whose content sits in a folder that isn't nested under
// the campaign's parent Drive folder (so the campaign-level
// DrivePicker can't reach it).
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { getDriveClient } from "@/lib/google-drive";
import { parseDriveUrl } from "@/lib/drive-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hard cap so we never page through a giant folder. The picker is for
// small, athlete-scoped folders; if anyone ever hits this, they should
// be using the campaign-level DrivePicker instead.
const MAX_FILES = 500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { folderUrl, recapId } = body as {
      folderUrl?: string;
      recapId?: string;
    };

    if (!recapId) {
      return NextResponse.json({ error: "Missing recapId." }, { status: 400 });
    }

    const parsed = parseDriveUrl(folderUrl ?? "");
    if (parsed.kind === "file") {
      return NextResponse.json(
        { error: "That's a file URL, not a folder URL. Paste the folder URL instead." },
        { status: 400 }
      );
    }
    if (parsed.kind === "invalid") {
      return NextResponse.json(
        { error: "That's not a valid Drive folder URL." },
        { status: 400 }
      );
    }
    const folderId = parsed.id;

    const drive = getDriveClient();

    // Fetch folder name + media listing in parallel. Media query mirrors the
    // shape used in discover-folder / google-drive.ts (shared-drive aware).
    let folderName = "Drive folder";
    const files: {
      id: string;
      name: string;
      mimeType: string;
      size: string | null;
      thumbnailLink: string | null;
      webViewLink: string | null;
      createdTime: string | null;
      isVideo: boolean;
    }[] = [];

    try {
      const nameRes = await drive.files.get({
        fileId: folderId,
        supportsAllDrives: true,
        fields: "name",
      });
      folderName = nameRes.data.name ?? "Drive folder";

      let pageToken: string | undefined;
      do {
        const res = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: "allDrives",
          fields:
            "nextPageToken, files(id, name, mimeType, size, thumbnailLink, webViewLink, createdTime)",
          pageSize: 100,
          orderBy: "name",
          pageToken,
        });
        for (const f of res.data.files ?? []) {
          if (!f.id || !f.name) continue;
          const mimeType = f.mimeType ?? "application/octet-stream";
          files.push({
            id: f.id,
            name: f.name,
            mimeType,
            size: f.size ?? null,
            thumbnailLink: f.thumbnailLink ?? null,
            webViewLink: f.webViewLink ?? null,
            createdTime: f.createdTime ?? null,
            isVideo: mimeType.startsWith("video/"),
          });
          if (files.length >= MAX_FILES) break;
        }
        pageToken = files.length >= MAX_FILES ? undefined : res.data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch (e: any) {
      const status = e?.code === 404 ? 404 : 403;
      console.error("[drive/list-folder-files] Drive access error:", e?.message || e);
      return NextResponse.json(
        {
          error:
            "Couldn't open this folder. Check that it's shared with the Postgame Google account.",
        },
        { status }
      );
    }

    // Already-imported detection for this campaign — greyed out in the picker.
    let alreadyImportedFileIds: string[] = [];
    if (files.length > 0) {
      const supabase = createServiceSupabase();
      const { data: importedRows, error: importedErr } = await supabase
        .from("media")
        .select("drive_file_id")
        .eq("campaign_id", recapId)
        .in(
          "drive_file_id",
          files.map((f) => f.id)
        );
      if (importedErr) {
        console.error(
          "[drive/list-folder-files] Imported-media fetch error:",
          importedErr.message
        );
      } else {
        alreadyImportedFileIds = (importedRows ?? [])
          .map((r) => r.drive_file_id as string)
          .filter((id): id is string => !!id);
      }
    }

    return NextResponse.json({
      folderId,
      folderName,
      files,
      alreadyImportedFileIds,
    });
  } catch (error: any) {
    console.error("[drive/list-folder-files] Error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to list folder files." },
      { status: 500 }
    );
  }
}
