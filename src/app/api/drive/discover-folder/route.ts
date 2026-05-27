// src/app/api/drive/discover-folder/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/discover-folder
// Body: { folderUrl: string, campaignId: string, force?: boolean }
//
// The Media Library "empty-state" doorway into the existing Drive
// import pipeline. Parses a pasted folder URL, lists its immediate
// subfolders (one per athlete), upserts athlete rows, and reports
// which Drive files were already imported so the picker can grey
// them out. The actual file download/upload still happens through
// the existing /api/drive/import endpoint (driven by DrivePicker).
//
// Returns one of:
//   { shape: "per_athlete", folderId, folderName, athletes[], alreadyImportedFileIds[] }
//   { shape: "flat", folderId, folderName, fileCount }
//   { shape: "confirm_replace", existingFolderId, newFolderId }
//   { error: "..." }  (with appropriate HTTP status)
//
// Env vars (shared with the rest of the Drive integration):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { getDriveClient } from "@/lib/google-drive";
import { parseDriveUrl } from "@/lib/drive-url";
import type { drive_v3 } from "googleapis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// List immediate child subfolders of a Drive folder. Mirrors the query
// options used elsewhere in the Drive integration (shared-drive aware).
async function listImmediateSubfolders(
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
      corpora: "allDrives",
      fields: "nextPageToken, files(id, name)",
      pageSize: 100,
      orderBy: "name",
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name) folders.push({ id: f.id, name: f.name });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return folders;
}

// Count loose media files (images/videos) sitting directly in the folder.
async function countLooseMediaFiles(
  drive: drive_v3.Drive,
  folderId: string
): Promise<number> {
  let count = 0;
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
      fields: "nextPageToken, files(id)",
      pageSize: 100,
      pageToken,
    });
    count += (res.data.files ?? []).length;
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return count;
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
  return res.data.name ?? "Drive folder";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { folderUrl, campaignId, force } = body as {
      folderUrl?: string;
      campaignId?: string;
      force?: boolean;
    };

    if (!campaignId) {
      return NextResponse.json({ error: "Missing campaignId." }, { status: 400 });
    }

    // 1. Parse the URL → folder id (precise errors for file/invalid URLs).
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

    const supabase = createServiceSupabase();

    // 2. Guard against silently re-pointing a campaign at a different folder.
    const { data: campaign, error: campaignErr } = await supabase
      .from("campaign_recaps")
      .select("id, drive_folder_id")
      .eq("id", campaignId)
      .single();
    if (campaignErr || !campaign) {
      return NextResponse.json(
        { error: "Couldn't find that campaign." },
        { status: 404 }
      );
    }
    const existingFolderId: string | null = campaign.drive_folder_id ?? null;
    if (existingFolderId && existingFolderId !== folderId && !force) {
      return NextResponse.json({
        shape: "confirm_replace",
        existingFolderId,
        newFolderId: folderId,
      });
    }

    // 3. Open the folder and list its immediate children.
    const drive = getDriveClient();
    let folderName: string;
    let subfolders: { id: string; name: string }[];
    try {
      [folderName, subfolders] = await Promise.all([
        getFolderName(drive, folderId),
        listImmediateSubfolders(drive, folderId),
      ]);
    } catch (e: any) {
      const status = e?.code === 404 ? 404 : e?.code === 403 ? 403 : 403;
      console.error("[drive/discover-folder] Drive access error:", e?.message || e);
      return NextResponse.json(
        {
          error:
            "Couldn't open this folder. Check that it's shared with the Postgame Google account.",
        },
        { status }
      );
    }

    // 4. Flat folder (no subfolders) → not importable here; report file count.
    if (subfolders.length === 0) {
      const fileCount = await countLooseMediaFiles(drive, folderId);
      // Persist the folder link even for the flat case so a later re-paste of
      // the same URL doesn't trigger a spurious confirm_replace.
      if (!existingFolderId || existingFolderId !== folderId) {
        await supabase
          .from("campaign_recaps")
          .update({ drive_folder_id: folderId })
          .eq("id", campaignId);
      }
      return NextResponse.json({ shape: "flat", folderId, folderName, fileCount });
    }

    // 5. Per-athlete: derive a deduped, alphabetically sorted athlete list.
    //    Trim names, drop empties, dedupe case-insensitively (first wins).
    const uniqueByKey = new Map<string, string>(); // lower(trimmed) -> display name
    for (const sf of subfolders) {
      const name = (sf.name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!uniqueByKey.has(key)) uniqueByKey.set(key, name);
    }
    const desiredNames = Array.from(uniqueByKey.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    // Reuse existing athlete rows (match by trimmed, case-insensitive name).
    const { data: existingAthletes, error: existingErr } = await supabase
      .from("athletes")
      .select("id, name, sort_order")
      .eq("campaign_id", campaignId);
    if (existingErr) {
      console.error("[drive/discover-folder] Athlete fetch error:", existingErr.message);
      return NextResponse.json(
        { error: "Couldn't read existing athletes for this campaign." },
        { status: 500 }
      );
    }
    const existingByKey = new Map<string, { id: string; name: string; sort_order: number | null }>();
    for (const a of existingAthletes ?? []) {
      existingByKey.set((a.name ?? "").trim().toLowerCase(), a);
    }

    // Insert any athletes that don't exist yet. Track inserts for rollback.
    const insertedIds: string[] = [];
    const resolved: { id: string; name: string }[] = [];
    try {
      for (let i = 0; i < desiredNames.length; i++) {
        const name = desiredNames[i];
        const existing = existingByKey.get(name.toLowerCase());
        if (existing) {
          resolved.push({ id: existing.id, name: existing.name });
          // Keep ordering aligned with the alphabetical list (spec: sort_order
          // reflects alphabetical order). Only write when it actually changes.
          if (existing.sort_order !== i) {
            const { error: updErr } = await supabase
              .from("athletes")
              .update({ sort_order: i })
              .eq("id", existing.id);
            if (updErr) throw new Error(updErr.message);
          }
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from("athletes")
            .insert({ campaign_id: campaignId, name, sort_order: i, school: "", sport: "" })
            .select("id, name")
            .single();
          if (insErr || !inserted) throw new Error(insErr?.message || "insert failed");
          insertedIds.push(inserted.id);
          resolved.push({ id: inserted.id, name: inserted.name });
        }
      }
    } catch (e: any) {
      // Rollback any athletes we created in this request.
      if (insertedIds.length > 0) {
        await supabase.from("athletes").delete().in("id", insertedIds);
      }
      console.error("[drive/discover-folder] Athlete creation failed:", e?.message || e);
      return NextResponse.json(
        { error: "Couldn't create athlete rows for this campaign. No changes were saved." },
        { status: 500 }
      );
    }

    // 6. Build the final, alphabetically-ordered athlete payload.
    const athletes = resolved
      .map((a, idx) => ({ id: a.id, name: a.name, sort_order: idx }))
      .sort((x, y) =>
        x.name.localeCompare(y.name, undefined, { sensitivity: "base" })
      )
      .map((a, idx) => ({ ...a, sort_order: idx }));

    // 7. Already-imported Drive file ids for this campaign (re-import detection).
    const { data: importedRows, error: importedErr } = await supabase
      .from("media")
      .select("drive_file_id")
      .eq("campaign_id", campaignId)
      .not("drive_file_id", "is", null);
    if (importedErr) {
      console.error("[drive/discover-folder] Imported-media fetch error:", importedErr.message);
    }
    const alreadyImportedFileIds = (importedRows ?? [])
      .map((r) => r.drive_file_id as string)
      // Exclude the collab marker ids ("collab:<id>") — those aren't Drive file ids.
      .filter((id) => id && !id.startsWith("collab:"));

    // 8. Save the campaign's drive_folder_id (only if new or changed-and-forced).
    if (!existingFolderId || existingFolderId !== folderId) {
      const { error: folderErr } = await supabase
        .from("campaign_recaps")
        .update({ drive_folder_id: folderId })
        .eq("id", campaignId);
      if (folderErr) {
        console.error("[drive/discover-folder] drive_folder_id update error:", folderErr.message);
      }
    }

    return NextResponse.json({
      shape: "per_athlete",
      folderId,
      folderName,
      athletes,
      alreadyImportedFileIds,
    });
  } catch (error: any) {
    console.error("[drive/discover-folder] Error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to discover folder." },
      { status: 500 }
    );
  }
}
