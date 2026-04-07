// src/app/api/drive/list/route.ts
// ─────────────────────────────────────────────────────────────
// GET /api/drive/list?folderId=XXXXX
//
// Lists image and video files in a Google Drive folder, walking
// one level into subfolders. Each file is tagged with its source
// subfolder name. Accepts a folder ID or a full Drive URL.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/google-drive";
import type { drive_v3 } from "googleapis";

export const dynamic = "force-dynamic";

/** Extract a folder ID from a full Drive URL or return as-is if already an ID. */
function parseFolderId(input: string): string | null {
  const trimmed = input.trim();

  // Already a bare ID (alphanumeric, hyphens, underscores)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;

  // https://drive.google.com/drive/folders/FOLDER_ID?...
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

interface ListedFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  thumbnailLink: string | null;
  folderName: string | null;
}

/** List all image/video files in a single folder. */
async function listMediaFiles(
  drive: drive_v3.Drive,
  folderId: string,
  folderName: string | null
): Promise<ListedFile[]> {
  const files: ListedFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`,
      fields: "nextPageToken, files(id, name, mimeType, size, thumbnailLink)",
      pageSize: 200,
      orderBy: "name",
      pageToken,
    });

    if (res.data.files) {
      for (const f of res.data.files) {
        if (f.id && f.name) {
          files.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType ?? "application/octet-stream",
            size: parseInt(f.size ?? "0", 10),
            thumbnailLink: f.thumbnailLink ?? null,
            folderName,
          });
        }
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/** List immediate subfolders of a folder. */
async function listSubfolders(
  drive: drive_v3.Drive,
  parentId: string
): Promise<{ id: string; name: string }[]> {
  const folders: { id: string; name: string }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: 100,
      orderBy: "name",
      pageToken,
    });

    if (res.data.files) {
      for (const f of res.data.files) {
        if (f.id && f.name) {
          folders.push({ id: f.id, name: f.name });
        }
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return folders;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("folderId");

    if (!raw) {
      return NextResponse.json(
        { error: "Missing folderId parameter" },
        { status: 400 }
      );
    }

    const folderId = parseFolderId(raw);
    if (!folderId) {
      return NextResponse.json(
        { error: "Could not parse a folder ID from the provided input" },
        { status: 400 }
      );
    }

    const drive = getDriveClient();

    // Get folder name
    const folderMeta = await drive.files.get({
      fileId: folderId,
      fields: "name",
    });

    // List root-level media files + subfolders in parallel
    const [rootFiles, subfolders] = await Promise.all([
      listMediaFiles(drive, folderId, null),
      listSubfolders(drive, folderId),
    ]);

    // List media in each subfolder (one level deep)
    const subfolderResults = await Promise.all(
      subfolders.map((sf) => listMediaFiles(drive, sf.id, sf.name))
    );

    const files = [...rootFiles, ...subfolderResults.flat()];

    return NextResponse.json({
      folderId,
      folderName: folderMeta.data.name ?? "Unknown Folder",
      files,
    });
  } catch (error: any) {
    console.error("[drive/list] Error:", error);

    if (error?.code === 404) {
      return NextResponse.json(
        { error: "Folder not found. Check the URL and make sure it's accessible." },
        { status: 404 }
      );
    }
    if (error?.code === 403) {
      return NextResponse.json(
        { error: "Access denied. Make sure the folder is shared with the connected Google account." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to list Drive folder" },
      { status: 500 }
    );
  }
}
