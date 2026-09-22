// ============================================================
// Draining admin_drive_queue — the other half of the 202.
//
// POST /api/admin-drive/campaign returns 202 and parks a handoff when the Hub
// has not synced the campaign yet. This is what makes that promise true: the
// nightly campaign sync calls it right after inserting new campaigns, so a
// handoff parked yesterday lands the moment its campaign appears.
//
// Without this the 202 is a lie with a database table behind it.
//
// The SAME contract as the live endpoint — mergeIds, so a parked handoff is
// held to the identical 409 rule. A payload that would overwrite an id somebody
// set in the meantime is marked failed and left for a human, not applied
// because it happened to be queued first.
// ============================================================

import { CAMPAIGN_FIELDS, mergeIds, toColumnPatch } from "./contract";
import type { UpdateFor } from "./db-types";
import { adminDriveDb, type AdminDriveDb } from "./service";

/** How many parked handoffs one sync run will try. Bounds the sync's runtime. */
const MAX_PER_RUN = 200;

export type QueueDrainResult = {
  considered: number;
  applied: number;
  /** Still waiting — the campaign has not synced yet. Normal, not an error. */
  stillWaiting: number;
  failed: number;
  errors: string[];
};

/**
 * Apply every parked handoff whose campaign now exists.
 *
 * Never throws. This runs as a tail step of the nightly campaign sync, and a
 * queue problem must not fail a sync that already wrote campaigns correctly —
 * the report carries what happened instead.
 */
export async function applyQueuedHandoffs(
  client?: AdminDriveDb,
): Promise<QueueDrainResult> {
  const db = client ?? adminDriveDb();
  const result: QueueDrainResult = {
    considered: 0,
    applied: 0,
    stillWaiting: 0,
    failed: 0,
    errors: [],
  };

  try {
    const { data: queued, error: readError } = await db
      .from("admin_drive_queue")
      .select("id, cf_campaign_id, admin_account_id, payload, attempts")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(MAX_PER_RUN);

    if (readError) {
      result.errors.push(`queue read failed: ${readError.message}`);
      return result;
    }

    result.considered = queued?.length ?? 0;
    const now = new Date().toISOString();

    for (const entry of queued ?? []) {
      try {
        const { data: matches, error: findError } = await db
          .from("campaign_recaps")
          .select(
            "id, drive_folder_id, drive_content_folder_id, drive_legal_folder_id, drive_legal_brand_folder_id, drive_legal_athlete_folder_id, drive_trackers_folder_id, tracker_sheet_id, tracker_url, tracker_internal_sheet_id, tracker_internal_url, tracker_external_sheet_id, tracker_external_url",
          )
          .eq("admin_campaign_id", entry.cf_campaign_id)
          .limit(2);

        if (findError) throw new Error(`campaign lookup failed: ${findError.message}`);

        // Still not here. Count the attempt and move on — this is the expected
        // state for a handoff parked before its campaign syncs, not a failure.
        if (!matches || matches.length === 0) {
          result.stillWaiting++;
          await db
            .from("admin_drive_queue")
            .update({ attempts: (entry.attempts ?? 0) + 1, updated_at: now })
            .eq("id", entry.id);
          continue;
        }

        if (matches.length > 1) {
          throw new Error(
            `${matches.length} campaign_recaps rows carry admin_campaign_id ${entry.cf_campaign_id} — a human has to de-duplicate them`,
          );
        }

        const campaign = matches[0];
        const payload = (entry.payload ?? {}) as Record<string, unknown>;
        const merged = mergeIds(
          campaign as unknown as Record<string, unknown>,
          toColumnPatch(payload, CAMPAIGN_FIELDS),
        );

        if (!merged.ok) {
          throw new Error(
            `id conflict: ${merged.conflicts
              .map((c) => `${c.field} holds ${c.existing}, handoff sent ${c.incoming}`)
              .join("; ")}`,
          );
        }

        const fields = Object.keys(merged.patch);
        if (fields.length > 0) {
          const { data: updated, error: updateError } = await db
            .from("campaign_recaps")
            .update(merged.patch as UpdateFor<"campaign_recaps">)
            .eq("id", campaign.id)
            .select("id");

          if (updateError) throw new Error(`campaign update failed: ${updateError.message}`);
          if (!updated || updated.length === 0) {
            throw new Error(`campaign update matched no rows for id ${campaign.id}`);
          }
        }

        // Mark applied only AFTER the write landed. If the process dies between
        // the two, the entry stays queued and the next run re-applies it — and
        // re-applying is safe, because mergeIds treats the now-identical ids as
        // unchanged rather than as a conflict.
        const { error: markError } = await db
          .from("admin_drive_queue")
          .update({
            status: "applied",
            applied_at: now,
            applied_campaign_id: campaign.id,
            attempts: (entry.attempts ?? 0) + 1,
            updated_at: now,
          })
          .eq("id", entry.id);

        if (markError) {
          result.errors.push(
            `handoff ${entry.cf_campaign_id} applied but the queue row was not marked: ${markError.message}`,
          );
        }
        result.applied++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.failed++;
        result.errors.push(`handoff ${entry.cf_campaign_id}: ${message}`);
        await db
          .from("admin_drive_queue")
          .update({
            status: "failed",
            last_error: message,
            attempts: (entry.attempts ?? 0) + 1,
            updated_at: now,
          })
          .eq("id", entry.id);
      }
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
  }

  return result;
}
