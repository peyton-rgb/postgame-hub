// src/lib/google-drive.ts
// ─────────────────────────────────────────────────────────────
// Google Drive service for fetching campaign media by athlete folder.
// Uses OAuth2 with a refresh token (no service account key needed).
//
// Env vars required:
//   GOOGLE_CLIENT_ID       — from Google Cloud OAuth client
//   GOOGLE_CLIENT_SECRET   — from Google Cloud OAuth client
//   GOOGLE_REFRESH_TOKEN   — from running get-refresh-token.js
// ─────────────────────────────────────────────────────────────

import { google, drive_v3 } from "googleapis";

// ── Auth ──────────────────────────────────────────────────────

export function getDriveClient(): drive_v3.Drive {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

// ── Types ─────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  thumbnailLink: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  createdTime: string | null;
  /** Relative path under the athlete folder: "" (root), "Photos", "Photos/Edited", … */
  subfolder: string;
}

export interface AthleteFolder {
  folderName: string;
  folderId: string;
  files: DriveFile[];
}

export interface CampaignDriveData {
  parentFolderId: string;
  parentFolderName: string;
  athletes: AthleteFolder[];
  totalFiles: number;
  scannedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function humanFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

// ── Core functions ────────────────────────────────────────────

async function listSubfolders(
  drive: drive_v3.Drive,
  parentFolderId: string
): Promise<{ id: string; name: string }[]> {
  const folders: { id: string; name: string }[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "user,allDrives",
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

async function listMediaFilesInFolder(
  drive: drive_v3.Drive,
  folderId: string,
  subfolder: string
): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "user,allDrives",
      fields:
        "nextPageToken, files(id, name, mimeType, size, thumbnailLink, webViewLink, webContentLink, createdTime)",
      pageSize: 100,
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
            size: humanFileSize(parseInt(f.size ?? "0", 10)),
            thumbnailLink: f.thumbnailLink ?? null,
            webViewLink: f.webViewLink ?? null,
            webContentLink: f.webContentLink ?? null,
            createdTime: f.createdTime ?? null,
            subfolder,
          });
        }
      }
    }

    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}

/**
 * Media inside one athlete folder: root, each immediate subfolder, and one nested
 * level under each (e.g. Photos/Edited). Deeper nesting is ignored.
 */
async function listAllMediaInAthleteFolder(
  drive: drive_v3.Drive,
  athleteFolderId: string
): Promise<DriveFile[]> {
  const out: DriveFile[] = [];

  out.push(...(await listMediaFilesInFolder(drive, athleteFolderId, "")));

  const level1 = await listSubfolders(drive, athleteFolderId);
  for (const folder1 of level1) {
    out.push(
      ...(await listMediaFilesInFolder(drive, folder1.id, folder1.name))
    );

    const level2 = await listSubfolders(drive, folder1.id);
    for (const folder2 of level2) {
      const path = `${folder1.name}/${folder2.name}`;
      out.push(...(await listMediaFilesInFolder(drive, folder2.id, path)));
    }
  }

  return out;
}

async function getFolderName(
  drive: drive_v3.Drive,
  folderId: string
): Promise<string> {
  const res = await drive.files.get({
    fileId: folderId,
    supportsAllDrives: true,
    fields: "name",
  });
  return res.data.name ?? "Unknown Folder";
}

// ── Fetch campaign media ──────────────────────────────────────

export async function getCampaignDriveMedia(
  parentFolderId: string
): Promise<CampaignDriveData> {
  const drive = getDriveClient();

  const parentFolderName = await getFolderName(drive, parentFolderId);
  const subfolders = await listSubfolders(drive, parentFolderId);

  const BATCH_SIZE = 5;
  const athletes: AthleteFolder[] = [];
  let totalFiles = 0;

  for (let i = 0; i < subfolders.length; i += BATCH_SIZE) {
    const batch = subfolders.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (folder) => {
        const files = await listAllMediaInAthleteFolder(drive, folder.id);
        return {
          folderName: folder.name,
          folderId: folder.id,
          files,
        };
      })
    );

    for (const r of results) {
      athletes.push(r);
      totalFiles += r.files.length;
    }
  }

  return {
    parentFolderId,
    parentFolderName,
    athletes,
    totalFiles,
    scannedAt: new Date().toISOString(),
  };
}

// ── Rename files ──────────────────────────────────────────────
// Renames all media files in athlete subfolders:
//   MARISA SNEE/IMG_4821.HEIC → MARISA SNEE/Marisa_Snee_01.heic
//   MARISA SNEE/DSC_0091.jpg  → MARISA SNEE/Marisa_Snee_02.jpg

export interface RenameResult {
  totalRenamed: number;
  totalSkipped: number;
  totalErrors: number;
  athletes: {
    folderName: string;
    renamed: { from: string; to: string }[];
    skipped: string[];
    errors: string[];
  }[];
}

export async function renameAthleteFiles(
  parentFolderId: string
): Promise<RenameResult> {
  const drive = getDriveClient();
  const subfolders = await listSubfolders(drive, parentFolderId);

  const result: RenameResult = {
    totalRenamed: 0,
    totalSkipped: 0,
    totalErrors: 0,
    athletes: [],
  };

  for (const folder of subfolders) {
    // Convert folder name to filename prefix: "MARISA SNEE" → "Marisa_Snee"
    const prefix = folder.name
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("_");

    const files = await listAllMediaInAthleteFolder(drive, folder.id);

    // Sort by creation date so numbering is chronological
    files.sort((a, b) => {
      const da = a.createdTime ? new Date(a.createdTime).getTime() : 0;
      const db = b.createdTime ? new Date(b.createdTime).getTime() : 0;
      return da - db;
    });

    const athleteResult = {
      folderName: folder.name,
      renamed: [] as { from: string; to: string }[],
      skipped: [] as string[],
      errors: [] as string[],
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const num = String(i + 1).padStart(2, "0");

      // Get extension from current filename
      const ext = file.name.includes(".")
        ? file.name.split(".").pop()!.toLowerCase()
        : "jpg";

      const newName = `${prefix}_${num}.${ext}`;

      // Skip if already named correctly
      if (file.name === newName) {
        athleteResult.skipped.push(file.name);
        result.totalSkipped++;
        continue;
      }

      // Also skip if it already matches the pattern (e.g. Marisa_Snee_01.jpg)
      const alreadyRenamed = new RegExp(
        `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_\\d{2}\\.\\w+$`
      );
      if (alreadyRenamed.test(file.name)) {
        athleteResult.skipped.push(file.name);
        result.totalSkipped++;
        continue;
      }

      try {
        await drive.files.update({
          fileId: file.id,
          requestBody: { name: newName },
        });
        athleteResult.renamed.push({ from: file.name, to: newName });
        result.totalRenamed++;
      } catch (err: any) {
        athleteResult.errors.push(
          `${file.name} → ${newName}: ${err.message}`
        );
        result.totalErrors++;
      }
    }

    result.athletes.push(athleteResult);
  }

  return result;
}

// ── Thumbnail proxy ───────────────────────────────────────────

export async function getDriveThumbnail(
  fileId: string
): Promise<Buffer | null> {
  try {
    const drive = getDriveClient();
    const meta = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: "thumbnailLink",
    });

    if (meta.data.thumbnailLink) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET!
      );
      oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      });
      const token = await oauth2Client.getAccessToken();

      const response = await fetch(meta.data.thumbnailLink, {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
      }
    }

    // Fallback: download the file itself (works for images)
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(res.data as ArrayBuffer);
  } catch {
    return null;
  }
}
