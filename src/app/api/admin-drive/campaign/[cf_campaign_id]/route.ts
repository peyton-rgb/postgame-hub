// ============================================================
// GET /api/admin-drive/campaign/[cf_campaign_id] — read back what the Hub
// holds for a campaign.
//
// Brief 15 §2. This is how the admin reconciles without guessing: it asks what
// the Hub has, compares against what it provisioned, and re-posts only what is
// missing. Without it the only way to discover a half-applied handoff is to
// post again and read the 409.
//
// It also reports a PARKED handoff. A campaign the Hub has not synced yet has
// no row to report ids from, and answering a plain 404 there would tell the
// admin the handoff was lost when it is sitting in the queue waiting for the
// nightly sync. So the queue is checked before 404 is returned.
//
// Read-only. Nothing here writes, and nothing here is logged to agent_runs —
// agent_runs records what an agent DID, and a read did nothing.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { CAMPAIGN_FIELDS, CAMPAIGN_SELECT } from "@/lib/admin-drive/contract";
import { adminDriveDb, authorized, NOT_FOUND } from "@/lib/admin-drive/service";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { cf_campaign_id: string } },
) {
  if (!authorized(req)) return NOT_FOUND;

  const cfCampaignId = String(params.cf_campaign_id || "").trim();
  if (!cfCampaignId) {
    return NextResponse.json({ error: "cf_campaign_id is required" }, { status: 400 });
  }

  const db = adminDriveDb();

  try {
    const { data: matches, error } = await db
      .from("campaign_recaps")
      .select(`id, name, admin_campaign_id, admin_account_id, brand_id, ${CAMPAIGN_SELECT}` as const)
      .eq("admin_campaign_id", cfCampaignId)
      .limit(2);

    if (error) throw new Error(`campaign_recaps lookup failed: ${error.message}`);

    if (matches && matches.length > 1) {
      return NextResponse.json(
        {
          error: "ambiguous_campaign",
          detail: `${matches.length} campaign_recaps rows carry admin_campaign_id ${cfCampaignId}`,
        },
        { status: 409 },
      );
    }

    const campaign = matches?.[0] as Record<string, unknown> | undefined;

    if (!campaign) {
      // Not synced yet — but possibly already handed over. Say which.
      const { data: queued, error: queueError } = await db
        .from("admin_drive_queue")
        .select("id, admin_account_id, status, attempts, last_error, created_at, updated_at")
        .eq("cf_campaign_id", cfCampaignId)
        .eq("status", "queued")
        .maybeSingle();

      if (queueError) throw new Error(`admin_drive_queue lookup failed: ${queueError.message}`);

      if (queued) {
        return NextResponse.json(
          {
            found: false,
            queued: true,
            detail:
              "The Hub has not synced this campaign yet. A handoff is parked and will be applied by the nightly campaign sync.",
            cf_campaign_id: cfCampaignId,
            queue: queued,
          },
          { status: 200 },
        );
      }

      return NextResponse.json(
        {
          found: false,
          queued: false,
          detail: "No campaign with this cf_campaign_id, and no parked handoff.",
          cf_campaign_id: cfCampaignId,
        },
        { status: 404 },
      );
    }

    // Report by the admin's own field names, so the response can be diffed
    // directly against the body it would post.
    const ids: Record<string, unknown> = {};
    const missing: string[] = [];
    for (const [bodyKey, column] of Object.entries(CAMPAIGN_FIELDS)) {
      const value = campaign[column] ?? null;
      ids[bodyKey] = value;
      if (value === null || String(value).trim() === "") missing.push(bodyKey);
    }

    return NextResponse.json(
      {
        found: true,
        queued: false,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        cf_campaign_id: campaign.admin_campaign_id,
        admin_account_id: campaign.admin_account_id,
        brand_id: campaign.brand_id,
        ids,
        /** What the admin still needs to hand over. The point of the endpoint. */
        missing,
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-drive/campaign/read]", message);
    return NextResponse.json({ error: "internal_error", detail: message }, { status: 500 });
  }
}
