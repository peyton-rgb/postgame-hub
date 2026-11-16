// src/lib/slack-recap/content-links.ts
// ─────────────────────────────────────────────────────────────
// Each athlete's content folder, read from the tracker's "Content Folder"
// column.
//
// In the v2 Performance Tracker the Content Folder cell shows the words
// "Content Folder" with the athlete's Drive folder linked behind them. The CSV
// export the recap build reads only carries the words, so the build could
// never see those links and fell back to guessing folders by name inside the
// pasted folder — which found nothing for Brooks Ghost Max 4 (2026-11-16),
// whose athlete folders live in the requester's Drive, one per athlete, linked
// only from the tracker.
//
// This reads the cell hyperlinks through the Sheets API instead and returns
// athlete name → folder id. Name matching is loose (case/spacing/punctuation
// insensitive), the same rule the folder-name fallback uses.
// ─────────────────────────────────────────────────────────────

import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-auth";
import { normLoose } from "@/lib/admin-campaigns";
import { extractDriveFolderId } from "@/lib/drive-url";
import { parseSheetIdAndGid } from "@/lib/slack-recap-queue";

/** Only the identity block is needed; the Content Folder column sits in it. */
const SCAN_RANGE = "A1:L600";

function headerKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * normLoose(athlete name) → Drive folder id, for every tracker row whose
 * Content Folder cell links a Drive folder. Never throws: any failure returns
 * an empty map and the build falls back to folder-name matching.
 */
export async function readTrackerContentFolders(trackerUrl: string | null | undefined): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!trackerUrl) return out;
  const { id, gid } = parseSheetIdAndGid(trackerUrl);
  if (!id) return out;

  try {
    const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });

    // Which tab? The one the link points at (gid), else the first.
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets.properties(sheetId,title)" });
    const tabs = meta.data.sheets ?? [];
    const tab =
      (gid ? tabs.find((t) => String(t.properties?.sheetId) === String(gid)) : undefined) ?? tabs[0];
    const title = tab?.properties?.title;
    if (!title) return out;

    const res = await sheets.spreadsheets.get({
      spreadsheetId: id,
      ranges: [`'${title.replace(/'/g, "''")}'!${SCAN_RANGE}`],
      fields: "sheets.data.rowData.values(formattedValue,hyperlink)",
    });
    const rows = res.data.sheets?.[0]?.data?.[0]?.rowData ?? [];
    const cell = (r: number, c: number) => rows[r]?.values?.[c];
    const text = (r: number, c: number) => String(cell(r, c)?.formattedValue ?? "").trim();

    // Find the header row: the first one with a "Content Folder" column.
    let headerRow = -1;
    let cFolder = -1;
    let cFirst = -1;
    let cLast = -1;
    let cFull = -1;
    for (let r = 0; r < Math.min(rows.length, 10) && headerRow === -1; r++) {
      const keys = (rows[r]?.values ?? []).map((v) => headerKey(String(v?.formattedValue ?? "")));
      const f = keys.indexOf("contentfolder");
      if (f === -1) continue;
      headerRow = r;
      cFolder = f;
      cFirst = keys.findIndex((k) => k === "firstname" || k === "first");
      cLast = keys.findIndex((k) => k === "lastname" || k === "last");
      cFull = keys.findIndex((k) => k === "name" || k === "fullname" || k === "athletename" || k === "athlete");
    }
    if (headerRow === -1) return out;

    for (let r = headerRow + 1; r < rows.length; r++) {
      const name =
        cFirst !== -1 || cLast !== -1
          ? `${cFirst !== -1 ? text(r, cFirst) : ""} ${cLast !== -1 ? text(r, cLast) : ""}`.trim()
          : cFull !== -1
            ? text(r, cFull)
            : "";
      if (!name || /calculations|do not/i.test(name)) continue;
      const c = cell(r, cFolder);
      const link = c?.hyperlink || (String(c?.formattedValue ?? "").startsWith("http") ? String(c?.formattedValue) : "");
      const folderId = link ? extractDriveFolderId(link) : null;
      if (folderId) out.set(normLoose(name), folderId);
    }
  } catch (e: any) {
    console.warn("[slack-recap] couldn't read Content Folder links from the tracker:", e?.message || e);
  }
  return out;
}
