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
// PACING. The first production run hit "User rate limit exceeded" and got
// through 5 of 25 campaigns. Each campaign is three folder lookups, issued back
// to back with nothing between them, so 25 campaigns is 75 Drive calls in a
// tight loop — comfortably enough to trip Google's per-user limit.
//
// Three changes, none of which is sufficient alone:
//   • a short delay between calls, so the loop stops arriving as a burst
//   • retry with exponential backoff + jitter on throttling only
//   • a smaller batch, so one run cannot queue 75 calls in the first place
//
// Backoff alone would have kept the burst and just spread the failures; a
// delay alone would still fail whenever Drive is busy for another reason.
//
// A DEADLINE bounds the whole pass. The route's budget is 300s and the
// provisioning sweep runs first, so the repair cannot be allowed to spend the
// remainder in backoff — it stops cleanly and reports what is left rather than
// being killed mid-update by the platform.
//
// Nothing here moves, renames or deletes, and nothing reads file content.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findFolderByName,
  ensureFolder,
  withDriveRetry,
  driveSleep,
  isDriveRateLimit,
} from "@/lib/google-drive";
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
  reason: "no Content subfolder in the campaign folder" | "drive error" | "not attempted";
  detail?: string;
}

export interface RepairReport {
  considered: number;
  repaired: RepairOutcome[];
  skipped: RepairSkip[];
  /** Set when the pass stopped before working through every candidate. */
  stoppedEarly: null | "deadline" | "rate limited";
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
  opts: {
    limit?: number;
    create?: boolean;
    statuses?: string[];
    /** Milliseconds between Drive calls. */
    paceMs?: number;
    /** Stop starting new campaigns after this long. */
    deadlineMs?: number;
  } = {},
): Promise<RepairReport> {
  const limit = opts.limit ?? 10;
  const create = opts.create ?? false;
  const paceMs = opts.paceMs ?? 250;
  const deadline = Date.now() + (opts.deadlineMs ?? 120_000);

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
  const report: RepairReport = {
    considered: candidates.length,
    repaired: [],
    skipped: [],
    stoppedEarly: null,
  };

  for (const c of candidates) {
    if (Date.now() > deadline) {
      report.stoppedEarly = "deadline";
      report.skipped.push({ campaignId: c.id, name: c.name, reason: "not attempted" });
      continue;
    }
    try {
      const patch: Record<string, string> = {};
      const recorded: string[] = [];
      let createdAny = false;

      // Both branches are paced and retried identically — ?create=1 issues the
      // same lookup and can add a create on top, so it is the heavier of the two
      // and the one that most needs the pacing.
      for (const sub of SUBFOLDERS) {
        await driveSleep(paceMs);
        if (create) {
          const { id, created } = await withDriveRetry(`ensureFolder ${sub}`, () =>
            ensureFolder(sub, c.drive_folder_id),
          );
          patch[COLUMN_FOR[sub]] = id;
          recorded.push(sub);
          createdAny = createdAny || created;
        } else {
          const id = await withDriveRetry(`findFolderByName ${sub}`, () =>
            findFolderByName(sub, c.drive_folder_id),
          );
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
      // Still throttled after the retries: Drive is asking for a longer pause
      // than this run can give it. Stop rather than spending the remaining
      // candidates confirming the same thing — they keep for the next run.
      if (isDriveRateLimit(e)) {
        report.stoppedEarly = "rate limited";
        break;
      }
    }
  }

  return report;
}
