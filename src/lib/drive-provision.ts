// ============================================================
// Campaign Drive folder provisioning.
//
//   {client root} / {brand root} / {year} / {campaign name} /
//       ├── Content
//       ├── Contracts
//       └── Trackers
//
// The client root (DRIVE_CLIENT_ROOT_FOLDER_ID) holds one folder per brand and
// is the one level this module never creates into — see resolveBrandRoot.
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
  | "ambiguous_brand_root"
  | "brand_root_not_found"
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
  /** How the year shelf was resolved, and what it is actually called — an
   *  adopted variant ("adidas 2026") is not named after the year. */
  yearFolderVia: YearFolderVia;
  yearFolderName: string;
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
 * True when `name` carries `year` as a standalone token.
 *
 * Splitting on runs of non-alphanumerics is deliberate over a regex word
 * boundary: it is easier to reason about, needs no lookbehind, and treats "_"
 * as a separator, so "adidas_2026" matches the way "adidas 2026" does.
 *
 *   "adidas 2026" ✓   "2026 CK" ✓   "…Football 2026)" ✓
 *   "20261" ✗         "2026x" ✗     "adidas2026" ✗
 */
export function hasYearToken(name: string, year: number): boolean {
  const target = String(year);
  return name.split(/[^0-9A-Za-z]+/).some((token) => token === target);
}

/**
 * Folders that must never be adopted as a year shelf, by Drive id.
 *
 * Both of these carry 2026 as a standalone token and would otherwise be adopted
 * — but both are CAMPAIGN folders, not year shelves; "Campaign" is in each
 * name. Adopting one would file every new campaign for that brand *inside* an
 * existing campaign. Token matching cannot see the difference, and inventing a
 * heuristic to guess is explicitly out of scope, so the two known cases are
 * named here instead.
 *
 * A brand whose only candidate is on this list falls through to
 * ambiguous_year_folder — deliberately NOT to "create a plain {year}", because
 * a second shelf beside the existing folder is the split-shelf outcome this
 * resolution order exists to avoid. A human sets the shelf.
 *
 * To retire an entry: give the brand a real year shelf in Drive, or seed
 * brand_year_folders for it — the stored id short-circuits before this list is
 * ever consulted — then delete the line.
 */
export const NEVER_ADOPT_AS_YEAR_FOLDER: Record<string, string> = {
  // Dr. Scholl's → "Dr. Scholl's 24-Hour Campaign 2026"
  "1TFvw4l1aAqEYoeNd_s1bX3wFJWq9mEuU": 'Dr. Scholl\'s — "Dr. Scholl\'s 24-Hour Campaign 2026"',
  // Zenni → "Zenni 2026 Campaign"
  "1w8cJoa3WgtZrTFnaWGB2Y7FYXpdkAdh7": 'Zenni — "Zenni 2026 Campaign"',
};

/** How a brand root was arrived at. There is no "created" — see below. */
export type BrandRootVia = "stored" | "matched";

export interface BrandRootResolved {
  id: string;
  via: BrandRootVia;
  /** The folder's actual name, which is the brand's name as SALES spelled it. */
  name: string;
}

/**
 * Resolve a brand's folder under the client root.
 *
 * Order, most authoritative first:
 *   1. stored brands.drive_parent_folder_id — used as-is, never re-resolved
 *   2. exactly one child of the client root matching the brand name → adopt
 *   3. two or more matches → ambiguous, a human picks
 *   4. no match → notFound
 *
 * THIS NEVER CREATES THE BRAND FOLDER. Sales owns making it, and "zero matches"
 * means they have not yet — a normal, temporary state, not a failure. Creating
 * one here would put a rival folder beside the real one the moment sales made
 * it, which is the split-tree outcome the whole resolution order exists to
 * avoid. The next cron pass picks the brand up once the folder appears.
 *
 * The caller is expected to PERSIST an adopted id onto the brand. That is what
 * makes this cheap: the client root is listed once per brand, ever, and step 1
 * short-circuits every run after.
 *
 * Deliberately the same list-and-compare as resolveYearFolder — listChildFolders
 * + matchesByName, refusing on ambiguity rather than guessing. One matcher, one
 * set of rules, at both levels.
 */
export async function resolveBrandRoot(
  drive: drive_v3.Drive,
  clientRootId: string,
  brandName: string,
  storedId: string | null,
): Promise<
  | BrandRootResolved
  | { ambiguous: Array<{ id: string; name: string }> }
  | { notFound: true }
> {
  if (storedId) return { id: storedId, via: "stored", name: brandName.trim() };

  const name = brandName.trim();
  // An unnamed brand cannot be searched for; matching "" against every folder
  // would be an ambiguity that means nothing.
  if (!name) return { notFound: true };

  const matches = matchesByName(await listChildFolders(drive, clientRootId), name);
  if (matches.length > 1) return { ambiguous: matches };
  if (matches.length === 1) return { id: matches[0].id, via: "matched", name: matches[0].name };
  return { notFound: true };
}

/** How a year shelf was arrived at — reported so an adoption is visible. */
export type YearFolderVia = "stored" | "exact" | "variant" | "created";

export interface YearFolderResolved {
  id: string;
  via: YearFolderVia;
  /** The folder's actual name. Differs from the year when a variant is adopted. */
  name: string;
}

/**
 * Resolve the year shelf under a brand root.
 *
 * Order, most authoritative first:
 *   1. stored id from brand_year_folders — never re-resolved by name
 *   2. a folder named exactly {year}. Exact ALWAYS outranks a variant, even
 *      when variants also exist.
 *   3. a folder carrying {year} as a standalone token ("adidas 2026",
 *      "2026 CK"), minus anything in NEVER_ADOPT_AS_YEAR_FOLDER. Exactly one is
 *      adopted as the shelf; more than one refuses. If every candidate was
 *      excluded, that refuses too rather than creating a rival shelf.
 *   4. nothing matched at all → create a plain {year}.
 *
 * Adoption records the folder in brand_year_folders and NOTHING ELSE — the
 * variant is never renamed. This feature does not rename anything.
 *
 * More than one candidate at any level is a human decision, never a guess.
 */
export async function resolveYearFolder(
  drive: drive_v3.Drive,
  brandRootId: string,
  year: number,
  storedId: string | null,
): Promise<
  | YearFolderResolved
  | { ambiguous: Array<{ id: string; name: string }>; blocked?: boolean }
> {
  if (storedId) return { id: storedId, via: "stored", name: String(year) };

  const children = await listChildFolders(drive, brandRootId);

  // 2 ── exact wins outright.
  const exact = matchesByName(children, String(year));
  if (exact.length > 1) return { ambiguous: exact };
  if (exact.length === 1) return { id: exact[0].id, via: "exact", name: exact[0].name };

  // 3 ── token-bearing variants. Exact matches are already ruled out above, so
  // there is no overlap to exclude here.
  const variants = children.filter((c) => hasYearToken(c.name.trim(), year));
  const adoptable = variants.filter((c) => !(c.id in NEVER_ADOPT_AS_YEAR_FOLDER));

  if (adoptable.length > 1) return { ambiguous: adoptable };
  if (adoptable.length === 1) return { id: adoptable[0].id, via: "variant", name: adoptable[0].name };

  // Every candidate was excluded: refuse rather than create a rival shelf
  // alongside the campaign folder that already carries the year.
  if (variants.length > 0) return { ambiguous: variants, blocked: true };

  // 4 ── nothing to adopt.
  return { id: await createFolder(String(year), brandRootId), via: "created", name: String(year) };
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
    const names = yearFolder.ambiguous.map((f) => `"${f.name}"`).join(", ");
    return {
      campaignId: candidate.id,
      campaignName: candidate.name,
      reason: "ambiguous_year_folder",
      detail: yearFolder.blocked
        ? `the only ${year} candidate under the brand root is ${names}, which is a campaign folder rather than a year shelf — set this brand's ${year} shelf by hand`
        : `${yearFolder.ambiguous.length} folders under the brand root could be the ${year} shelf (${names}) — a human has to pick one`,
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
    yearFolderVia: yearFolder.via,
    yearFolderName: yearFolder.name,
    campaignFolderId,
    contentFolderId: subIds.Content,
    contractsFolderId: subIds.Contracts,
    trackersFolderId: subIds.Trackers,
  };
}
