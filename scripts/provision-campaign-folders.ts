// scripts/provision-campaign-folders.ts
// ─────────────────────────────────────────────────────────────
// Create the missing Drive folders for the 13 active campaigns that have no
// drive_folder_id, and record the id on each row.
//
//   <Brand folder> / <Year> / <Campaign name>
//     ├── Content
//     └── Contracts/
//         ├── Drafts
//         └── Signed
//
// Run:
//   npx tsx --env-file=.env.local scripts/provision-campaign-folders.ts            # dry run
//   npx tsx --env-file=.env.local scripts/provision-campaign-folders.ts --execute  # writes
//
// DRY RUN IS THE DEFAULT. Nothing is created or written without --execute.
//
// Why a script and not the existing POST /api/drive/campaign-folder: that route
// parents on brand.drive_campaign_subfolder_id ?? brand.drive_parent_folder_id
// and has NO year layer — it only lands under a year because adidas happens to
// have its "adidas 2026" folder recorded as the grouper. Every other brand here
// would get a campaign folder directly at the brand root. The subfolder tree it
// builds is reused exactly.
//
// Year folders in this Drive are inconsistent — "adidas 2026", "CVS 2026",
// "Zenni 2026 Campaign". An existing one is ADOPTED, never renamed; a bare
// "2026" is only created when the brand has none.
// ─────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";
import { getDriveClient, ensureFolder, findFolderByName } from "../src/lib/google-drive";

const EXECUTE = process.argv.includes("--execute");
const ROOT = "1z0szyZYdD2CGd9zAeRTO8MM-ArQAgz-a";

// The 13, by admin_campaign_id. Years are assigned by decision (1000, 1005 and
// 1007 have no admin_created_on), so they are listed rather than computed.
const TARGETS: { adm: string; year: string }[] = [
  { adm: "972", year: "2026" },
  { adm: "982", year: "2026" },
  { adm: "983", year: "2026" },
  { adm: "984", year: "2026" },
  { adm: "988", year: "2026" },
  { adm: "929", year: "2026" },
  { adm: "985", year: "2026" },
  { adm: "1007", year: "2026" },
  { adm: "970", year: "2026" },
  { adm: "930", year: "2026" },
  { adm: "1005", year: "2026" },
  { adm: "1000", year: "2026" },
  { adm: "989", year: "2026" },
];

// Brand folders the crawl already identified but which are not on the brands
// row. Unsung's exists and is empty — using it avoids a second one at root.
const KNOWN_BRAND_FOLDERS: Record<string, string> = {
  Unsung: "1_6xxFobb6ksaZDcc2nZzhSRm3nOwwGyf",
};

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type FolderInfo = { id: string; name: string; canAddChildren: boolean; trashed: boolean };

async function inspect(folderId: string): Promise<FolderInfo | null> {
  try {
    const { data } = await getDriveClient().files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: "id, name, trashed, mimeType, capabilities(canAddChildren)",
    });
    if (data.mimeType !== "application/vnd.google-apps.folder") return null;
    return {
      id: data.id!,
      name: data.name ?? "",
      canAddChildren: data.capabilities?.canAddChildren ?? false,
      trashed: !!data.trashed,
    };
  } catch {
    return null;
  }
}

async function listChildFolders(parentId: string) {
  const res = await getDriveClient().files.list({
    q: `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
    fields: "files(id, name)",
    pageSize: 200,
  });
  return (res.data.files ?? []).map((f) => ({ id: f.id!, name: f.name ?? "" }));
}

/** Case-insensitive, whitespace-trimmed name match — the Hub says "Adidas", Drive says "adidas". */
const norm = (s: string) => s.trim().toLowerCase();

async function main() {
  const { data: rows, error } = await db
    .from("campaign_recaps")
    .select(
      "id, admin_campaign_id, name, drive_folder_id, admin_is_active, content_host, brand:brands!campaigns_brand_id_fkey(name, drive_parent_folder_id, drive_campaign_subfolder_id)"
    )
    .in("admin_campaign_id", TARGETS.map((t) => t.adm));
  if (error) throw new Error(error.message);

  console.log(`\n${EXECUTE ? "EXECUTE" : "DRY RUN"} — ${rows?.length ?? 0} campaigns loaded\n`);

  const rootFolders = await listChildFolders(ROOT);
  const plans: any[] = [];
  const blocked: string[] = [];

  for (const t of TARGETS) {
    const row: any = rows?.find((r: any) => r.admin_campaign_id === t.adm);
    if (!row) { blocked.push(`${t.adm}: not found in campaign_recaps`); continue; }

    const campaignName = (row.name ?? "").trim();
    const brandName = row.brand?.name ?? "(no brand)";

    if (row.drive_folder_id) { blocked.push(`${t.adm} ${campaignName}: already has drive_folder_id — skipping`); continue; }
    if (!campaignName) { blocked.push(`${t.adm}: no campaign name`); continue; }

    // ── brand folder ──
    let brandFolderId: string | null =
      row.brand?.drive_parent_folder_id ?? KNOWN_BRAND_FOLDERS[brandName] ?? null;
    let brandSource = row.brand?.drive_parent_folder_id
      ? "brands.drive_parent_folder_id"
      : KNOWN_BRAND_FOLDERS[brandName]
        ? "known id (crawl)"
        : "";

    if (!brandFolderId) {
      const matches = rootFolders.filter((f) => norm(f.name) === norm(brandName));
      if (matches.length === 1) {
        brandFolderId = matches[0].id;
        brandSource = `matched at root: "${matches[0].name}"`;
      } else {
        // A duplicate brand folder is far worse than a missing campaign folder.
        blocked.push(
          `${t.adm} ${campaignName} (${brandName}): ${matches.length === 0 ? "no brand folder found at root" : `${matches.length} root folders match`} — NOT creating one`
        );
        continue;
      }
    }

    const brandInfo = await inspect(brandFolderId);
    if (!brandInfo || brandInfo.trashed) { blocked.push(`${t.adm} ${campaignName}: brand folder ${brandFolderId} missing or trashed`); continue; }
    if (!brandInfo.canAddChildren) { blocked.push(`${t.adm} ${campaignName}: brand folder "${brandInfo.name}" is not writable (canAddChildren=false)`); continue; }

    // ── year folder: adopt an existing one, else plan a bare year ──
    const children = await listChildFolders(brandFolderId);
    const yearMatches = children.filter((f) => f.name.includes(t.year));
    let yearFolderId: string | null = null;
    let yearNote = "";

    // adidas records its year folder as the campaign grouper.
    const grouper = row.brand?.drive_campaign_subfolder_id ?? null;
    if (grouper && children.some((c) => c.id === grouper)) {
      yearFolderId = grouper;
      yearNote = `ADOPT "${children.find((c) => c.id === grouper)!.name}" (recorded grouper)`;
    } else if (yearMatches.length === 1) {
      yearFolderId = yearMatches[0].id;
      yearNote = `ADOPT "${yearMatches[0].name}"`;
    } else if (yearMatches.length > 1) {
      blocked.push(`${t.adm} ${campaignName}: ${yearMatches.length} folders contain "${t.year}" under "${brandInfo.name}" (${yearMatches.map((m) => `"${m.name}"`).join(", ")}) — ambiguous`);
      continue;
    } else {
      yearNote = `CREATE "${t.year}"`;
    }

    if (yearFolderId) {
      const yi = await inspect(yearFolderId);
      if (!yi || yi.trashed) { blocked.push(`${t.adm} ${campaignName}: year folder missing or trashed`); continue; }
      if (!yi.canAddChildren) { blocked.push(`${t.adm} ${campaignName}: year folder "${yi.name}" is not writable`); continue; }
    }

    // ── campaign folder: does one already sit there? ──
    let campaignExisting: string | null = null;
    if (yearFolderId) campaignExisting = await findFolderByName(campaignName, yearFolderId);

    plans.push({
      adm: t.adm,
      recapId: row.id,
      brandName,
      brandFolderId,
      brandFolderName: brandInfo.name,
      brandSource,
      year: t.year,
      yearFolderId,
      yearNote,
      campaignName,
      rawName: row.name,
      campaignExisting,
    });
  }

  // ── report ──
  console.log("PLANNED\n" + "=".repeat(96));
  for (const p of plans) {
    const trimmed = p.rawName !== p.campaignName ? `  (trimmed from ${JSON.stringify(p.rawName)})` : "";
    console.log(`\n${p.adm}  ${p.brandName} — ${p.campaignName}${trimmed}`);
    console.log(`     brand  : "${p.brandFolderName}"  ${p.brandFolderId}   [${p.brandSource}]`);
    console.log(`     year   : ${p.yearNote}${p.yearFolderId ? `  ${p.yearFolderId}` : "  (to be created under the brand folder)"}`);
    console.log(`     campaign: ${p.campaignExisting ? `ADOPT existing  ${p.campaignExisting}` : `CREATE "${p.campaignName}"`}`);
    console.log(`     then    : Content, Contracts/Drafts, Contracts/Signed`);
    console.log(`     write   : campaign_recaps.drive_folder_id  (recap ${p.recapId})`);
  }

  if (blocked.length) {
    console.log(`\n\nBLOCKED / SKIPPED — ${blocked.length}\n` + "=".repeat(96));
    for (const b of blocked) console.log(`  · ${b}`);
  }

  const newYearFolders = new Set(plans.filter((p) => !p.yearFolderId).map((p) => `${p.brandFolderId}/${p.year}`));
  console.log(
    `\n\nSUMMARY: ${plans.length} campaign folders, ${newYearFolders.size} new year folders, ` +
      `${plans.length * 4} subfolders, ${plans.length} database writes. Blocked: ${blocked.length}.`
  );

  if (!EXECUTE) {
    console.log("\nDRY RUN — nothing was created or written. Re-run with --execute to apply.\n");
    return;
  }

  // ── execute, one campaign at a time ──
  console.log("\n\nEXECUTING\n" + "=".repeat(96));
  for (const p of plans) {
    try {
      const year = p.yearFolderId
        ? { id: p.yearFolderId, created: false }
        : await ensureFolder(p.year, p.brandFolderId);
      const campaign = await ensureFolder(p.campaignName, year.id);

      // Record the id BEFORE the subfolders, so a failure below leaves a row
      // pointing at a folder that exists rather than one that doesn't.
      const { error: wErr } = await db
        .from("campaign_recaps")
        .update({ drive_folder_id: campaign.id })
        .eq("id", p.recapId);
      if (wErr) throw new Error(`db write failed: ${wErr.message}`);

      const content = await ensureFolder("Content", campaign.id);
      const contracts = await ensureFolder("Contracts", campaign.id);
      const drafts = await ensureFolder("Drafts", contracts.id);
      const signed = await ensureFolder("Signed", contracts.id);

      console.log(
        `  OK  ${p.adm} ${p.campaignName} -> ${campaign.id}` +
          `  [year ${year.created ? "created" : "adopted"}, campaign ${campaign.created ? "created" : "adopted"},` +
          ` subfolders ${[content, contracts, drafts, signed].filter((f) => f.created).length}/4 new]`
      );
    } catch (e: any) {
      console.log(`  FAIL ${p.adm} ${p.campaignName}: ${e?.message}`);
    }
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
