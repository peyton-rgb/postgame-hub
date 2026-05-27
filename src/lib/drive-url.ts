// src/lib/drive-url.ts
// ─────────────────────────────────────────────────────────────
// Shared Google Drive URL parsing. Distinguishes folder URLs from
// file URLs so callers can give precise errors ("that's a file URL,
// not a folder URL"). The folder regex matches the one originally
// inlined in DrivePicker.tsx so behavior is identical.
//
// Folder URL shapes:
//   https://drive.google.com/drive/folders/<id>
//   https://drive.google.com/drive/u/0/folders/<id>
//   https://drive.google.com/drive/folders/<id>?usp=sharing
// File URL shapes (rejected by extractDriveFolderId):
//   https://drive.google.com/file/d/<id>/view
//   https://drive.google.com/open?id=<id>
//   https://drive.google.com/uc?id=<id>
// ─────────────────────────────────────────────────────────────

export type ParsedDriveUrl =
  | { kind: "folder"; id: string }
  | { kind: "file"; id: string }
  | { kind: "invalid" };

const FOLDER_RE = /\/folders\/([a-zA-Z0-9_-]+)/;
const FILE_RE = /\/file\/d\/([a-zA-Z0-9_-]+)/;
const ID_PARAM_RE = /[?&]id=([a-zA-Z0-9_-]+)/;

/**
 * Classify a pasted Drive URL as a folder, a file, or invalid.
 * Folder detection takes precedence (a /folders/ link is always a folder).
 */
export function parseDriveUrl(input: string): ParsedDriveUrl {
  const url = (input ?? "").trim();
  if (!url) return { kind: "invalid" };

  const folder = url.match(FOLDER_RE);
  if (folder) return { kind: "folder", id: folder[1] };

  const file = url.match(FILE_RE);
  if (file) return { kind: "file", id: file[1] };

  // `open?id=` / `uc?id=` links are typically file links.
  const idParam = url.match(ID_PARAM_RE);
  if (idParam) return { kind: "file", id: idParam[1] };

  return { kind: "invalid" };
}

/**
 * Extract a Drive folder id, or null if the URL isn't a folder URL.
 * Mirrors the original DrivePicker behavior for valid folder links.
 */
export function extractDriveFolderId(input: string): string | null {
  const parsed = parseDriveUrl(input);
  return parsed.kind === "folder" ? parsed.id : null;
}
