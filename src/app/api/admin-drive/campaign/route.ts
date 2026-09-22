// ============================================================
// POST /api/admin-drive/campaign — the admin hands the Hub a campaign's Drive
// ids: the campaign folder, Content, the Legal subtree, Trackers, and the three
// tracker sheets.
//
// Brief 15 §1b. Same 409 rule as the brand endpoint, plus one thing the brand
// endpoint does not need:
//
// THE 202 QUEUE. A campaign created in the admin today does not reach the Hub
// until the 10:45 sync tomorrow, so a handoff can legitimately arrive before
// the campaign row exists. Refusing it would make the admin either retry on a
// timer or learn the Hub's schedule, and both of those are the Hub's problem
// leaking outward. So an unknown campaign is ACCEPTED (202) and parked in
// admin_drive_queue; the nightly sync applies it when the row appears.
//
// 202 is not a quiet 404. The response says the handoff is parked, not applied,
// and names what has to happen before it lands.
//
// tracker_sheet_id / tracker_url stay the PERFORMANCE tracker. The recap
// refresh and the master-tracker rollup both read them, so the INTERNAL and
// EXTERNAL sheets get their own columns rather than sharing these.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  CAMPAIGN_FIELDS,
  mergeIds,
  requireFields,
  toColumnPatch,
} from "@/lib/admin-drive/contract";
import type { UpdateFor } from "@/lib/admin-drive/db-types";
import {
  adminDriveDb,
  authorized,
  logRun,
  NOT_FOUND,
  readJsonBody,
  type AdminDriveDb,
} from "@/lib/admin-drive/service";

export const dynamic = "force-dynamic";

/** Postgres unique-violation. Here it means a concurrent request queued first. */
const UNIQUE_VIOLATION = "23505";

/**
 * Park a handoff for a campaign the Hub cannot see yet.
 *
 * One live entry per (cf_campaign_id, admin_account_id): a repeat replaces the
 * parked payload rather than stacking duplicates, which is what makes the 202
 * path idempotent in the same way the 200 path is.
 *
 * Not an upsert. The unique index is PARTIAL (`where status = 'queued'`) so
 * that applied and failed rows stay as history, and ON CONFLICT cannot infer a
 * partial index without repeating its WHERE clause — which PostgREST has no way
 * to express. Read-then-write, with the index itself as the backstop for the
 * race: a concurrent insert loses on 23505, and losing that race still means
 * the handoff is queued, so it is reported as success rather than as an error.
 */
async function queueHandoff(
  db: AdminDriveDb,
  cfCampaignId: string,
  adminAccountId: string,
  payload: Record<string, unknown>,
): Promise<{ queueId: string | null; replaced: boolean }> {
  const { data: existing, error: readError } = await db
    .from("admin_drive_queue")
    .select("id")
    .eq("cf_campaign_id", cfCampaignId)
    .eq("admin_account_id", adminAccountId)
    .eq("status", "queued")
    .maybeSingle();

  if (readError) throw new Error(`admin_drive_queue lookup failed: ${readError.message}`);

  if (existing) {
    const { data: updated, error: updateError } = await db
      .from("admin_drive_queue")
      .update({ payload: payload as never, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id");
    if (updateError) throw new Error(`admin_drive_queue update failed: ${updateError.message}`);
    if (!updated || updated.length === 0) {
      throw new Error(`admin_drive_queue update matched no rows for id ${existing.id}`);
    }
    return { queueId: existing.id, replaced: true };
  }

  const { data: inserted, error: insertError } = await db
    .from("admin_drive_queue")
    .insert({
      cf_campaign_id: cfCampaignId,
      admin_account_id: adminAccountId,
      payload: payload as never,
    })
    .select("id");

  if (insertError) {
    if (insertError.code === UNIQUE_VIOLATION) return { queueId: null, replaced: true };
    throw new Error(`admin_drive_queue insert failed: ${insertError.message}`);
  }
  return { queueId: inserted?.[0]?.id ?? null, replaced: false };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NOT_FOUND;

  const startedAt = Date.now();
  const body = await readJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const missing = requireFields(body, ["cf_campaign_id", "admin_account_id"]);
  if (missing.length > 0) {
    return NextResponse.json({ error: "Missing required fields", missing }, { status: 400 });
  }

  const cfCampaignId = String(body.cf_campaign_id).trim();
  const adminAccountId = String(body.admin_account_id).trim();
  const db = adminDriveDb();

  try {
    // The admin's campaign id lands on campaign_recaps.admin_campaign_id —
    // that is the column the nightly sync stamps, and the Hub's own uuid does
    // not exist until it has run.
    const { data: matches, error: findError } = await db
      .from("campaign_recaps")
      .select(
        "id, name, admin_account_id, drive_folder_id, drive_content_folder_id, drive_legal_folder_id, drive_legal_brand_folder_id, drive_legal_athlete_folder_id, drive_trackers_folder_id, tracker_sheet_id, tracker_url, tracker_internal_sheet_id, tracker_internal_url, tracker_external_sheet_id, tracker_external_url",
      )
      .eq("admin_campaign_id", cfCampaignId)
      .limit(2);

    if (findError) throw new Error(`campaign_recaps lookup failed: ${findError.message}`);

    // Two Hub rows claiming one admin campaign is a data problem, and writing
    // ids onto a coin-flip winner would bury it. Refuse and say so.
    if (matches && matches.length > 1) {
      const detail = `${matches.length} campaign_recaps rows carry admin_campaign_id ${cfCampaignId} (${matches.map((m) => m.id).join(", ")})`;
      await logRun(db, {
        endpoint: "campaign",
        input: { cf_campaign_id: cfCampaignId, admin_account_id: adminAccountId },
        output: { ambiguous: matches.map((m) => m.id) },
        status: "failed",
        startedAt,
        errorMessage: detail,
      });
      return NextResponse.json(
        {
          error: "ambiguous_campaign",
          detail,
          resolution: "A human de-duplicates the Hub rows, then this handoff succeeds on retry.",
        },
        { status: 409 },
      );
    }

    const campaign = matches?.[0] ?? null;

    // ── 202: the campaign has not synced yet ────────────────────────────────
    if (!campaign) {
      const { queueId, replaced } = await queueHandoff(db, cfCampaignId, adminAccountId, body);
      const output = { queued: true, queue_id: queueId, replaced };
      await logRun(db, {
        endpoint: "campaign",
        input: { cf_campaign_id: cfCampaignId, admin_account_id: adminAccountId },
        output,
        status: "complete",
        startedAt,
      });
      return NextResponse.json(
        {
          ok: true,
          queued: true,
          applied: false,
          queue_id: queueId,
          detail:
            "The Hub does not have this campaign yet. The handoff is parked and will be applied by the nightly campaign sync once the campaign appears.",
          cf_campaign_id: cfCampaignId,
        },
        { status: 202 },
      );
    }

    // A campaign under a different account than the one handing it over means
    // one of the two systems has it filed wrong. Do not write across it.
    if (campaign.admin_account_id && campaign.admin_account_id !== adminAccountId) {
      const detail = `campaign ${cfCampaignId} belongs to account ${campaign.admin_account_id} in the Hub, but the handoff came from account ${adminAccountId}`;
      await logRun(db, {
        endpoint: "campaign",
        input: { cf_campaign_id: cfCampaignId, admin_account_id: adminAccountId },
        output: { mismatch: campaign.admin_account_id },
        status: "failed",
        startedAt,
        errorMessage: detail,
      });
      return NextResponse.json({ error: "account_mismatch", detail }, { status: 409 });
    }

    const incoming = toColumnPatch(body, CAMPAIGN_FIELDS);
    const merged = mergeIds(campaign as unknown as Record<string, unknown>, incoming);

    if (!merged.ok) {
      await logRun(db, {
        endpoint: "campaign",
        input: { cf_campaign_id: cfCampaignId, campaign_id: campaign.id, incoming },
        output: { conflicts: merged.conflicts },
        status: "failed",
        startedAt,
        errorMessage: `${merged.conflicts.length} id conflict(s)`,
      });
      return NextResponse.json(
        {
          error: "id_conflict",
          detail: "One or more ids already hold a different value. Nothing was written.",
          campaign_id: campaign.id,
          conflicts: merged.conflicts,
        },
        { status: 409 },
      );
    }

    const fields = Object.keys(merged.patch);
    if (fields.length > 0) {
      const { data: updated, error: updateError } = await db
        .from("campaign_recaps")
        .update(merged.patch as UpdateFor<"campaign_recaps">)
        .eq("id", campaign.id)
        .select("id");

      if (updateError) throw new Error(`campaign_recaps update failed: ${updateError.message}`);
      if (!updated || updated.length === 0) {
        throw new Error(`campaign_recaps update matched no rows for id ${campaign.id}`);
      }
    }

    const output = {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      written: fields,
      unchanged: merged.unchanged,
    };
    await logRun(db, {
      endpoint: "campaign",
      input: { cf_campaign_id: cfCampaignId, campaign_id: campaign.id, incoming },
      output,
      status: "complete",
      startedAt,
    });

    return NextResponse.json({ ok: true, queued: false, applied: true, ...output }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-drive/campaign]", message);
    await logRun(db, {
      endpoint: "campaign",
      input: { cf_campaign_id: cfCampaignId, admin_account_id: adminAccountId },
      output: null,
      status: "failed",
      startedAt,
      errorMessage: message,
    });
    return NextResponse.json({ error: "internal_error", detail: message }, { status: 500 });
  }
}
