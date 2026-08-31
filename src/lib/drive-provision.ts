// ============================================================
// Campaign Drive folder provisioning.
//
//   Brands (Master) / {brand root} / {year} / {campaign name} /
//       ├── Content
//       ├── Contracts
//       └── Trackers
//
// CREATION ONLY. Nothing here ever moves, renames, trashes or deletes anything
// in Drive. The only mutating call is files.create.
//
// Idempotent by construction: a campaign that already has drive_folder_id is
// never a candidate, and every level looks for an existing folder by name
// before creating one — so a re-run after a partial failure links what is
// already there instead of making a second copy.
//
// Shared-drive rules that are easy to get wrong and are load-bearing here:
//   • every call passes supportsAllDrives: true
//   • list calls pass includeItemsFromAllDrives + corpora: "allDrives"
//     ("user,allDrives" is a 400)
// ============================================================

import type { drive_v3 } from "googleapis";
import { getDriveClient, createFolder } from "@/lib/google-drive";

/** The three subfolders every campaign gets. One Trackers folder holds both
 *  internal and external tracker sheets — decided; do not split. */
export const SUBFOLDERS = ["Content", "Contracts", "Trackers"] as const;

/** Why a campaign was not provisioned. Surfaced in the run report so the fix
 *  (usually: fill in the brand's Drive root) is a known task, not silent. */
export type SkipReason =
  | "no_brand_id"
  | "no_brand_root"
  | "ambiguous_year_folder"
  | "empty_campaign_name"
  | "error";

export interface CampaignCandidate {
  id: string;
  name: string;
  brand_id: string | null;
  admin_created_on: string | null;
  created_at: string;
}

export interface ProvisionOutcome {
  campaignId: string;
  campaignName: string;
  year: number;
  /** True when the campaign folder already existed and was linked, not created. */
  linkedExisting: boolean;
  campaignFolderId: string;
  contentFolderId: string;
  contractsFolderId: string;
  trackersFolderId: string;
}

export interface ProvisionSkip {
  campaignId: string;
  campaignName: string;
  reason: SkipReason;
  detail?: string;
}

/**
 * The year shelf a campaign belongs on: the campaign's own admin date when it
 * has one, otherwise when the Hub row appeared. Plain "2026", never a range.
 */
export function campaignYear(candidate: CampaignCandidate): number {
  const source = candidate.admin_created_on ?? candidate.created_at;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return new Date(candidate.created_at).getUTCFullYear();
  return parsed.getUTCFullYear();
}

/**
 * A campaign name as a folder name.
 *
 * Trims, and removes "/" because Drive treats it as a path separator. Nothing
 * else: the brief is explicit that names go in as-is, so no case changes, no
 * punctuation stripping, no "tidying".
 */
export function folderNameFor(campaignName: string): string {
  return campaignName.replace(/\//g, "").trim();
}

/** Child folders of a parent, as {id, name}. Handles shared drives and pages. */
async function listChildFolders(
  drive: drive_v3.Drive,
  parentId: string,
): Promise<Array<{ id: string; name: string }>> {
  const out: Array<{ id: string; name: string }> = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
      fields: "nextPageToken, files(id, name)",
      pageSize: 200,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      if (f.id && f.name) out.push({ id: f.id, name: f.name });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return out;
}

/**
 * Child folders whose name matches `target`, compared trimmed and
 * case-insensitively.
 *
 * Deliberately a list-and-compare rather than google-drive.ts's
 * findFolderByName, which issues a `name = '…'` query with pageSize 1. That
 * helper cannot see a SECOND folder of the same name — and distinguishing one
 * match from many is the whole point here. It also cannot match "2025 " (a real
 * folder on the Raising Cane's root, with a trailing space) against "2025".
 */
function matchesByName(
  children: Array<{ id: string; name: string }>,
  target: string,
): Array<{ id: string; name: string }> {
  const needle = target.trim().toLowerCase();
  return children.filter((c) => c.name.trim().toLowerCase() === needle);
}

/**
 * Resolve the year shelf under a brand root.
 *
 * Stored id wins. On a miss, exactly one name match is adopted, zero creates
 * one, and MORE THAN ONE refuses — a duplicate year shelf is a human decision,
 * never a guess.
 */
export async function resolveYearFolder(
  drive: drive_v3.Drive,
  brandRootId: string,
  year: number,
  storedId: string | null,
): Promise<{ id: string; created: boolean } | { ambiguous: string[] }> {
  if (storedId) return { id: storedId, created: false };

  const children = await listChildFolders(drive, brandRootId);
  const matches = matchesByName(children, String(year));

  if (matches.length > 1) return { ambiguous: matches.map((m) => m.id) };
  if (matches.length === 1) return { id: matches[0].id, created: false };

  return { id: await createFolder(String(year), brandRootId), created: true };
}

/**
 * Provision one campaign. Returns the four folder ids.
 *
 * `onYearFolderResolved` is called when a year shelf is resolved for the first
 * time, so the caller can persist it to brand_year_folders — this function does
 * no database work of its own.
 */
export async function provisionCampaign(
  candidate: CampaignCandidate,
  brandRootId: string,
  storedYearFolderId: string | null,
  onYearFolderResolved: (year: number, folderId: string) => Promise<void>,
): Promise<ProvisionOutcome | ProvisionSkip> {
  const drive = getDriveClient();
  const year = campaignYear(candidate);
  const name = folderNameFor(candidate.name);

  if (!name) {
    return {
      campaignId: candidate.id,
      campaignName: candidate.name,
      reason: "empty_campaign_name",
      detail: "name is empty once trimmed — refusing to create an unnamed folder",
    };
  }

  const yearFolder = await resolveYearFolder(drive, brandRootId, year, storedYearFolderId);
  if ("ambiguous" in yearFolder) {
    return {
      campaignId: candidate.id,
      campaignName: candidate.name,
      reason: "ambiguous_year_folder",
      detail: `${yearFolder.ambiguous.length} folders named "${year}" under the brand root — a human has to pick one`,
    };
  }

  if (!storedYearFolderId) await onYearFolderResolved(year, yearFolder.id);

  // The campaign folder: adopt an existing one rather than making a twin. This
  // is also what makes a re-run after a partial failure safe.
  const existing = matchesByName(await listChildFolders(drive, yearFolder.id), name);
  const linkedExisting = existing.length > 0;
  const campaignFolderId = linkedExisting
    ? existing[0].id
    : await createFolder(name, yearFolder.id);

  // Same adopt-or-create rule one level down.
  const children = linkedExisting ? await listChildFolders(drive, campaignFolderId) : [];
  const subIds: Record<string, string> = {};
  for (const sub of SUBFOLDERS) {
    const hit = matchesByName(children, sub);
    subIds[sub] = hit.length > 0 ? hit[0].id : await createFolder(sub, campaignFolderId);
  }

  return {
    campaignId: candidate.id,
    campaignName: candidate.name,
    year,
    linkedExisting,
    campaignFolderId,
    contentFolderId: subIds.Content,
    contractsFolderId: subIds.Contracts,
    trackersFolderId: subIds.Trackers,
  };
}
