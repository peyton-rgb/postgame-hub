// ============================================================
// Is a delivered campaign ready for its recap?
//
// One check, two callers: the daily sweep at /api/cron/recap-readiness and the
// "Check readiness" button on the campaign page. Both write a recap_readiness
// row, so a button press and a cron run are the same evidence.
//
// FIVE SIGNALS, one of which decides:
//   drive_file_count  files in drive_content_folder_id (metadata only)
//   media_count       media rows for this recap
//   tier3_count       tier3_submissions for this recap
//   has_tracker       tracker_sheet_id set
//   has_brief         brief_doc_id set
//
// ready = drive_file_count > 0 OR media_count > 0. The other three are
// reported, not decisive — a tracker and a brief say the campaign was set up,
// not that there is anything to recap.
//
// DRIVE IS METADATA ONLY. files.list with a fields mask that requests ids and
// nothing heavier; no file content is ever fetched. A recap with no
// drive_content_folder_id is not an error — it is the normal case, and
// drive_file_count stays null to say "not checked" rather than 0, which would
// claim an empty folder was read.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDriveClient } from "@/lib/google-drive";

export interface ReadinessCheck {
  recapId: string;
  name: string;
  clientName: string;
  /** null = not checked (no folder id, or Drive failed). 0 = read and empty. */
  driveFileCount: number | null;
  hasTracker: boolean;
  hasBrief: boolean;
  mediaCount: number;
  tier3Count: number;
  ready: boolean;
  /** Human-readable list of what is absent, for the "not ready" section. */
  missing: string[];
  /** Set when the Drive call itself failed, as opposed to there being no folder. */
  driveError: string | null;
}

export interface RecapRow {
  id: string;
  name: string;
  client_name: string;
  drive_content_folder_id: string | null;
  tracker_sheet_id: string | null;
  brief_doc_id: string | null;
}

/** Columns checkRecap needs — kept beside it so callers select the right set. */
export const RECAP_SELECT =
  "id, name, client_name, drive_content_folder_id, tracker_sheet_id, brief_doc_id";

/**
 * Count files in a Drive folder. Metadata only, paged, never downloads.
 *
 * Returns null when the folder cannot be read: the caller reports that
 * differently from an empty folder.
 */
async function countDriveFiles(folderId: string): Promise<{ count: number | null; error: string | null }> {
  try {
    const drive = getDriveClient();
    let count = 0;
    let pageToken: string | undefined;

    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        corpora: "allDrives",
        // Ids only. Nothing here causes Drive to return file content.
        fields: "nextPageToken, files(id)",
        pageSize: 1000,
        pageToken,
      });
      count += (res.data.files ?? []).length;
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return { count, error: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.warn(`[readiness] Drive folder ${folderId} could not be read: ${error}`);
    return { count: null, error };
  }
}

/**
 * Run the five checks for one recap and write the recap_readiness row.
 *
 * `db` must be a service-role client — recap_readiness is RLS'd to staff and
 * the cron has no session.
 */
export async function checkRecap(db: SupabaseClient, recap: RecapRow): Promise<ReadinessCheck> {
  const [drive, mediaRes, tier3Res] = await Promise.all([
    recap.drive_content_folder_id
      ? countDriveFiles(recap.drive_content_folder_id)
      : Promise.resolve({ count: null as number | null, error: null as string | null }),
    db.from("media").select("id", { count: "exact", head: true }).eq("campaign_id", recap.id),
    // recap_id OR campaign_id: tier3_submissions carries both, and which one is
    // populated depends on how the submission arrived.
    db
      .from("tier3_submissions")
      .select("id", { count: "exact", head: true })
      .or(`recap_id.eq.${recap.id},campaign_id.eq.${recap.id}`),
  ]);

  const mediaCount = mediaRes.count ?? 0;
  const tier3Count = tier3Res.count ?? 0;
  const hasTracker = Boolean(recap.tracker_sheet_id);
  const hasBrief = Boolean(recap.brief_doc_id);
  const driveFileCount = drive.count;
  const ready = (driveFileCount ?? 0) > 0 || mediaCount > 0;

  const missing: string[] = [];
  if (!driveFileCount) {
    missing.push(
      !recap.drive_content_folder_id
        ? "no Drive content folder linked"
        : drive.error
          ? "Drive folder could not be read"
          : "Drive folder is empty",
    );
  }
  if (mediaCount === 0) missing.push("no media rows");
  if (tier3Count === 0) missing.push("no athlete submissions");
  if (!hasTracker) missing.push("no tracker sheet");
  if (!hasBrief) missing.push("no brief doc");

  const check: ReadinessCheck = {
    recapId: recap.id,
    name: recap.name,
    clientName: recap.client_name,
    driveFileCount,
    hasTracker,
    hasBrief,
    mediaCount,
    tier3Count,
    ready,
    missing,
    driveError: drive.error,
  };

  const { error } = await db.from("recap_readiness").insert({
    recap_id: recap.id,
    drive_file_count: driveFileCount,
    has_tracker: hasTracker,
    has_brief: hasBrief,
    media_count: mediaCount,
    tier3_count: tier3Count,
    ready,
  });
  if (error) {
    // Reporting must not fail on a logging problem.
    console.warn(`[readiness] could not record check for ${recap.id}: ${error.message}`);
  }

  return check;
}

/** Delivered campaigns whose effective date falls in the window. */
export async function deliveredInWindow(
  db: SupabaseClient,
  days = 120,
): Promise<RecapRow[]> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  // admin_created_on is the business date and is nullable; created_at is the
  // row's own timestamp. The brief's coalesce() cannot be expressed in one
  // PostgREST filter, so both branches are fetched and merged here.
  const [byAdminDate, byCreatedAt] = await Promise.all([
    db
      .from("campaign_recaps")
      .select(RECAP_SELECT)
      .eq("lifecycle_status", "delivered")
      .not("admin_created_on", "is", null)
      .gte("admin_created_on", cutoff),
    db
      .from("campaign_recaps")
      .select(RECAP_SELECT)
      .eq("lifecycle_status", "delivered")
      .is("admin_created_on", null)
      .gte("created_at", `${cutoff}T00:00:00Z`),
  ]);

  const rows = [
    ...((byAdminDate.data as RecapRow[] | null) ?? []),
    ...((byCreatedAt.data as RecapRow[] | null) ?? []),
  ];
  return rows.sort((a, b) => a.client_name.localeCompare(b.client_name) || a.name.localeCompare(b.name));
}

/**
 * The most recent prior recap_readiness verdict for each of these recaps.
 *
 * Absent from the map means this recap has never been checked — which, for the
 * sweep, is how "newly delivered" is detected. There is no separate signal for
 * a campaign entering the window; a campaign the sweep has never seen is one it
 * has never reported on, whether it just flipped to 'delivered' or just crossed
 * into the 120 days.
 */
export async function priorVerdicts(
  db: SupabaseClient,
  recapIds: string[],
): Promise<Map<string, boolean>> {
  const prior = new Map<string, boolean>();
  if (recapIds.length === 0) return prior;

  // Ordered newest-last so the final write per recap wins, which avoids paging
  // a per-recap query and keeps this to one round trip.
  const { data, error } = await db
    .from("recap_readiness")
    .select("recap_id, ready, checked_at")
    .in("recap_id", recapIds)
    .order("checked_at", { ascending: true });

  if (error) {
    // Fail LOUD-ish but non-fatally: an empty map makes every campaign look
    // new, which sends one over-full email rather than silently suppressing a
    // real change.
    console.warn(`[readiness] prior verdicts unavailable: ${error.message}`);
    return prior;
  }
  for (const row of (data as Array<{ recap_id: string; ready: boolean }> | null) ?? []) {
    prior.set(row.recap_id, row.ready);
  }
  return prior;
}

/** Ready / not-ready totals from the latest verdict per recap, for the weekly digest. */
export async function readinessTotals(
  db: SupabaseClient,
  days = 120,
): Promise<{ total: number; ready: number; notReady: number }> {
  const recaps = await deliveredInWindow(db, days);
  const prior = await priorVerdicts(db, recaps.map((r) => r.id));
  let ready = 0;
  for (const r of recaps) if (prior.get(r.id)) ready += 1;
  return { total: recaps.length, ready, notReady: recaps.length - ready };
}
