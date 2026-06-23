// src/app/api/drive/list-folder-files/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/list-folder-files
// Body: { folderUrl: string, recapId: string, recursive?: boolean }
//
// Lists media files (images/videos) in a Drive folder so a folder
// picker can render thumbnails to pick from. Reports which file ids
// are already imported for this recap so the picker can grey them out.
//
// By default lists only the IMMEDIATE files in the dropped folder
// (used by the per-athlete picker — unchanged). When `recursive` is
// true (event imports), it walks the folder tree and tags each file
// with the `folderName` it sits in, so the picker can group by
// subfolder. Each file also carries `folderPath` for nested cases.
//
// Note: a separate campaign-level DrivePicker exists elsewhere — this
// route is only used by AthleteDriveFolderPicker.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { getDriveClient } from "@/lib/google-drive";
import { parseDriveUrl } from "@/lib/drive-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Hard caps so we never page through a giant tree. Flat (athlete) imports
// keep the original 500 cap; recursive (event) imports get a larger cap
// plus depth / folder-count guards against huge or shortcut-looped trees.
const MAX_FILES = 500;
const MAX_FILES_EVENT = 1000;
const MAX_DEPTH = 8;
const MAX_FOLDERS = 200;

type PickerFile = {
  id: string;
  name: string;
  mimeType: string;
  size: string | null;
  thumbnailLink: string | null;
  webViewLink: string | null;
  createdTime: string | null;
  isVideo: boolean;
  folderName: string;
  folderPath: string;
};

export async function POST(request: NextRequest) {
  try {
    const authClient = createServerSupabase();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { folderUrl, recapId, recursive } = body as {
      folderUrl?: string;
      recapId?: string;
      recursive?: boolean;
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
    const maxFiles = recursive ? MAX_FILES_EVENT : MAX_FILES;

    let folderName = "Drive folder";
    const files: PickerFile[] = [];

    // List the direct media files in one folder, tagging each with the
    // folder it sits in. Appends to `files`, stopping at the cap.
    async function collectMedia(fId: string, fName: string, pathNames: string[]) {
      let pageToken: string | undefined;
      do {
        const res = await drive.files.list({
          q: `'${fId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`,
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
            folderName: fName,
            folderPath: pathNames.join(" / "),
          });
          if (files.length >= maxFiles) break;
        }
        pageToken = files.length >= maxFiles ? undefined : res.data.nextPageToken ?? undefined;
      } while (pageToken);
    }

    // List immediate subfolders of a folder (shared-drive aware).
    async function listSubfolders(fId: string): Promise<{ id: string; name: string }[]> {
      const out: { id: string; name: string }[] = [];
      let pageToken: string | undefined;
      do {
        const res = await drive.files.list({
          q: `'${fId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          corpora: "allDrives",
          fields: "nextPageToken, files(id, name)",
          pageSize: 100,
          orderBy: "name",
          pageToken,
        });
        for (const f of res.data.files ?? []) {
          if (!f.id || !f.name) continue;
          out.push({ id: f.id, name: f.name });
        }
        pageToken = res.data.nextPageToken ?? undefined;
      } while (pageToken);
      return out;
    }

    try {
      const nameRes = await drive.files.get({
        fileId: folderId,
        supportsAllDrives: true,
        fields: "name",
      });
      folderName = nameRes.data.name ?? "Drive folder";

      if (recursive) {
        // Breadth-first walk. Guards: file cap, depth cap, folder-count cap,
        // and a `seen` set so a shortcut loop can't revisit a folder.
        let foldersVisited = 0;
        const seen = new Set<string>([folderId]);
        const queue: { id: string; name: string; pathNames: string[]; depth: number }[] = [
          { id: folderId, name: folderName, pathNames: [folderName], depth: 0 },
        ];
        while (queue.length > 0) {
          if (files.length >= maxFiles || foldersVisited >= MAX_FOLDERS) break;
          const cur = queue.shift()!;
          foldersVisited++;
          await collectMedia(cur.id, cur.name, cur.pathNames);
          if (files.length >= maxFiles) break;
          if (cur.depth >= MAX_DEPTH) continue;
          const subs = await listSubfolders(cur.id);
          for (const sub of subs) {
            if (seen.has(sub.id)) continue;
            seen.add(sub.id);
            queue.push({
              id: sub.id,
              name: sub.name,
              pathNames: [...cur.pathNames, sub.name],
              depth: cur.depth + 1,
            });
          }
        }
      } else {
        // Flat (athlete) path — immediate files only, identical to before.
        await collectMedia(folderId, folderName, [folderName]);
      }
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
    // Works off the full collected file-id list, so dedup spans all subfolders.
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
