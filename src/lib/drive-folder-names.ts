// ============================================================
// Pure folder-name helpers for the nightly Drive sweep (drive-provision.ts).
// Kept import-free so they can be unit-tested with node --test.
// ============================================================

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

/**
 * Trimmed, lower-cased, curly apostrophes straightened. "Raising Cane’s" typed
 * on a phone and "Raising Cane's" typed on a laptop are the same brand.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[\u2018\u2019]/g, "'");
}

/**
 * The name the postgame1.com admin gives a campaign folder (Sep 21 2026
 * standard): "{Campaign} - {Brand} {Year}", e.g.
 * "Holiday Bikes - Raising Cane's 2026".
 *
 * WHY THIS EXISTS (Nov 16 2026): the admin builds this folder every evening,
 * but its handoff to the Hub (admin_drive_queue) has never been wired, so the
 * Hub row arrives with no drive_folder_id. This sweep then looked only for a
 * folder named exactly "Holiday Bikes", didn't find one, and built a twin next
 * to the admin's — Holiday Bikes and Heisman 2026 on Raising Cane's both got
 * duplicated this way. Recognising the admin's name stops that.
 */
export function adminCampaignFolderName(campaignName: string, brandName: string, year: number): string {
  return `${folderNameFor(campaignName)} - ${brandName.trim()} ${year}`;
}

/**
 * Subfolders whose name is `sub` exactly, or `sub` followed by the admin's
 * " - {context}" suffix ("Content - Raising Cane's Holiday Bikes 2026").
 */
export function matchesSubfolder(
  children: Array<{ id: string; name: string }>,
  sub: string,
): Array<{ id: string; name: string }> {
  const exact = normalizeName(sub);
  const prefix = `${exact} - `;
  return children.filter((c) => {
    const n = normalizeName(c.name);
    return n === exact || n.startsWith(prefix);
  });
}

/**
 * Every name the admin may have given this campaign's folder. Today the admin
 * appends the year even when the campaign name already ends in one
 * ("Heisman 2026 - Raising Cane's 2026"); once that is fixed it will write
 * "Heisman - Raising Cane's 2026". Both count, so neither era makes a twin.
 */
export function adminCampaignFolderNames(campaignName: string, brandName: string, year: number): string[] {
  const names = [adminCampaignFolderName(campaignName, brandName, year)];
  const base = folderNameFor(campaignName);
  const trailingYear = new RegExp(`[\\s'’]*${year}$`);
  if (trailingYear.test(base)) {
    const without = base.replace(trailingYear, "").trim();
    if (without) names.push(`${without} - ${brandName.trim()} ${year}`);
  }
  return names;
}

/** The admin's year-folder name: "{Year} - {Brand}", e.g. "2026 - CVS". */
export function adminYearFolderName(brandName: string, year: number): string {
  return `${year} - ${brandName.trim()}`;
}
