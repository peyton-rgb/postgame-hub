// ============================================================
// Recording the Content folder id for campaigns that already have a folder.
//
// THE BUG. 186 campaign_recaps rows have drive_folder_id; 6 have
// drive_content_folder_id. The correlation with drive_provisioned_at is exact —
// 6 provisioned, 6 with a Content id, no exceptions either way — because only
// one of the six writers of drive_folder_id records the subfolders:
//
//   sets BOTH   api/sync/drive-folders   (provisionCampaign -> all three ids)
//   sets ONLY drive_folder_id:
//     dashboard/[id]/page.tsx            (manual folder link)
//     api/submission-forms/[token]       (folder chosen for a form)
//     api/drive/discover-folder          (two paths)
//     api/drive/campaign-folder
//     lib/recap-intake.ts                (intake attaches a found folder)
//
// The two filters then make it permanent. The provisioner's candidate query is
//     .is("drive_folder_id", null).gte("created_at", FEATURE_LAUNCH_DATE)
// so the moment any ad-hoc path sets drive_folder_id, that campaign is excluded
// from provisioning FOREVER and its Content id is never recorded. A campaign
// that got its folder from the intake or the "link folder" button can never be
// repaired by re-running the provisioner.
//
// THE FIX, deliberately at the read end rather than the six write ends. This
// pass finds campaigns with a folder but no Content id and records the ids of
// the subfolders already sitting inside that folder. It is idempotent, it runs
// beside the existing daily provisioning sweep, and — because it keys off the
// missing column rather than off who wrote the folder — it also repairs any
// FUTURE row the five ad-hoc writers leave behind. Fixing the writers instead
// would mean six edits and would still leave the 180 existing rows broken.
//
// ADOPT-ONLY BY DEFAULT. Subfolders are matched by name; nothing is created
// unless `create` is passed. 180 campaigns times three subfolders is ~540 new
// Drive folders in the team's shared drive, which is not a side effect a daily
// cron should have without someone asking for it. Campaigns whose folder has no
// "Content" child are reported, not modified.
//
// Nothing here moves, renames or deletes, and nothing reads file content.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { findFolderByName, ensureFolder } from "@/lib/google-drive";
import { SUBFOLDERS } from "@/lib/drive-provision";

export interface RepairOutcome {
  campaignId: string;
  name: string;
  /** Which subfolder ids were recorded. */
  recorded: string[];
  /** True when a folder had to be created rather than adopted. */
  created: boolean;
}

export interface RepairSkip {
  campaignId: string;
  name: string;
  reason: "no Content subfolder in the campaign folder" | "drive error";
  detail?: string;
}

export interface RepairReport {
  considered: number;
  repaired: RepairOutcome[];
  skipped: RepairSkip[];
}

const COLUMN_FOR: Record<string, string> = {
  Content: "drive_content_folder_id",
  Contracts: "drive_contracts_folder_id",
  Trackers: "drive_trackers_folder_id",
};

/**
 * Record subfolder ids for campaigns that have a Drive folder but no Content id.
 *
 * `create: true` creates a missing subfolder instead of skipping the campaign.
 * `limit` bounds one run so a cron cannot spend the whole Drive quota.
 */
export async function repairSubfolderIds(
  db: SupabaseClient,
  opts: { limit?: number; create?: boolean; statuses?: string[] } = {},
): Promise<RepairReport> {
  const limit = opts.limit ?? 25;
  const create = opts.create ?? false;

  // `statuses` narrows which campaigns are touched. It exists because creating
  // is not symmetric with adopting: adopting a folder that already exists is
  // free, whereas creating one puts a new folder in the team's shared drive.
  // Restricting creation to the campaigns still being worked on ('active')
  // avoids manufacturing Content folders for hundreds of finished campaigns
  // that will never have anything filed in them.
  let query = db
    .from("campaign_recaps")
    .select("id, name, drive_folder_id")
    .not("drive_folder_id", "is", null)
    .is("drive_content_folder_id", null);
  if (opts.statuses?.length) query = query.in("lifecycle_status", opts.statuses);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);

  if (error) throw new Error(`repair candidate query failed: ${error.message}`);

  const candidates = (data as Array<{ id: string; name: string; drive_folder_id: string }> | null) ?? [];
  const report: RepairReport = { considered: candidates.length, repaired: [], skipped: [] };

  for (const c of candidates) {
    try {
      const patch: Record<string, string> = {};
      const recorded: string[] = [];
      let createdAny = false;

      for (const sub of SUBFOLDERS) {
        if (create) {
          const { id, created } = await ensureFolder(sub, c.drive_folder_id);
          patch[COLUMN_FOR[sub]] = id;
          recorded.push(sub);
          createdAny = createdAny || created;
        } else {
          const id = await findFolderByName(sub, c.drive_folder_id);
          if (id) {
            patch[COLUMN_FOR[sub]] = id;
            recorded.push(sub);
          }
        }
      }

      // Content is the one that decides. Contracts and Trackers ride along
      // because they are the same lookup, but a campaign is not repaired
      // unless the column the Drive check reads is now set.
      if (!patch.drive_content_folder_id) {
        report.skipped.push({
          campaignId: c.id,
          name: c.name,
          reason: "no Content subfolder in the campaign folder",
        });
        continue;
      }

      const { error: updateError } = await db
        .from("campaign_recaps")
        .update(patch)
        .eq("id", c.id);

      if (updateError) {
        report.skipped.push({
          campaignId: c.id,
          name: c.name,
          reason: "drive error",
          detail: updateError.message,
        });
        continue;
      }

      report.repaired.push({ campaignId: c.id, name: c.name, recorded, created: createdAny });
    } catch (e) {
      report.skipped.push({
        campaignId: c.id,
        name: c.name,
        reason: "drive error",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return report;
}
