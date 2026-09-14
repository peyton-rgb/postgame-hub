// src/app/api/cron/sync-master-trackers/route.ts
// ============================================================
// GET/POST /api/cron/sync-master-trackers — roll each brand's campaign
// tracker dashboards up into that brand's Master Tracker.
//
// Per brand, per night:
//   1. Look for an existing "Trackers" folder in the brand's Drive root.
//      ADOPT-ONLY — never created here. Several brand folders are mid a
//      manual standardization pass right now; a brand without one yet is
//      simply skipped and picked up automatically the moment it's ready,
//      with no flag to flip.
//   2. If the brand has no master_tracker_id yet, create a blank
//      "{Brand} Master Tracker" Sheet in that folder and save its id/url.
//   3. For every campaign of that brand with a tracker_sheet_id, read its
//      RECAP SUMMARY dashboard (values, not formulas — see tracker-sheet.ts)
//      and write it into a same-named tab in the Master Tracker, fully
//      overwriting whatever was there before.
//
// Two callers, one route — matches /api/sync/drive-folders exactly:
//   • the nightly Vercel cron, authenticated by CRON_SECRET
//   • a staff session, for a manual "Refresh now" button
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { findFileByName, createSpreadsheet } from "@/lib/google-drive";
import { readRecapSummaryValues, writeCampaignTab } from "@/lib/tracker-sheet";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Most brands processed per run — same circuit-breaker role as the drive-
 *  folders sync's MAX_PER_RUN, so a large backlog can't run past the
 *  function timeout. */
const MAX_BRANDS_PER_RUN = 50;

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
  return process.env.NODE_ENV !== "production";
}

async function resolveActor(
  supabase: ReturnType<typeof createLiveServiceSupabase>,
  staffId: string | null,
): Promise<string | null> {
  if (staffId) return staffId;
  const email = process.env.SLACK_FALLBACK_EMAIL;
  if (!email) return null;
  const { data } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function logRun(
  supabase: ReturnType<typeof createLiveServiceSupabase>,
  actorId: string | null,
  inputPayload: Record<string, unknown>,
  outputPayload: Record<string, unknown> | null,
  status: "complete" | "failed",
  startedAt: number,
  errorMessage?: string,
): Promise<void> {
  if (!actorId) {
    console.warn("[master-tracker-sync] no actor to attribute the run to — skipping agent_runs insert");
    return;
  }
  const { error } = await supabase.from("agent_runs").insert({
    agent_name: "admin_sync",
    triggered_by: actorId,
    input_payload: inputPayload,
    output_payload: outputPayload,
    model: "none",
    status,
    duration_ms: Date.now() - startedAt,
    error_message: errorMessage ?? null,
  });
  if (error) console.error("[master-tracker-sync] agent_runs insert failed:", error.message);
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const supabase = createLiveServiceSupabase();

  const viaCron = cronAuthorized(req);
  const staff = viaCron ? null : await getStaffUser();
  if (!viaCron && !staff) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const actorId = await resolveActor(supabase, staff?.id ?? null);
  const inputPayload = { source: "sync-master-trackers", via: viaCron ? "cron" : "staff", cap: MAX_BRANDS_PER_RUN };

  const missingGoogle = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"].filter(
    (v) => !process.env[v],
  );
  if (missingGoogle.length) {
    const message = `Master tracker sync unavailable — missing ${missingGoogle.join(", ")}.`;
    await logRun(supabase, actorId, inputPayload, null, "failed", startedAt, message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 503 });
  }

  try {
    const { data: brandRows, error: brandsError } = await supabase
      .from("brands")
      .select("id, name, drive_parent_folder_id, master_tracker_id, master_tracker_url")
      .not("drive_parent_folder_id", "is", null)
      .limit(MAX_BRANDS_PER_RUN);

    if (brandsError) throw new Error(`brands query failed: ${brandsError.message}`);
    const brands = (brandRows ?? []) as Array<{
      id: string;
      name: string;
      drive_parent_folder_id: string;
      master_tracker_id: string | null;
      master_tracker_url: string | null;
    }>;

    const synced: Array<{ brand: string; campaigns: number }> = [];
    const skipped: Array<{ brand: string; reason: string }> = [];

    for (const brand of brands) {
      // Per-brand isolation: one bad brand must not end the sweep.
      try {
        let masterTrackerId = brand.master_tracker_id;
        if (!masterTrackerId) {
          // Master Tracker sits loose at the brand root — no Trackers
          // subfolder. Adopt-before-create: check whether one already exists
          // by name before making a new one.
          const existing = await findFileByName(
            `${brand.name} Master Tracker`,
            brand.drive_parent_folder_id,
          );
          const sheet = existing ?? await createSpreadsheet(
            `${brand.name} Master Tracker`,
            brand.drive_parent_folder_id,
          );
          masterTrackerId = sheet.id;
          const { error: brandUpdateError } = await supabase
            .from("brands")
            .update({ master_tracker_id: sheet.id, master_tracker_url: sheet.url })
            .eq("id", brand.id);
          if (brandUpdateError) {
            throw new Error(`saving new master tracker id failed: ${brandUpdateError.message}`);
          }
        }

        const { data: campaignRows, error: campaignsError } = await supabase
          .from("campaign_recaps")
          .select("id, name, tracker_sheet_id")
          .eq("brand_id", brand.id)
          .not("tracker_sheet_id", "is", null);

        if (campaignsError) throw new Error(`campaigns query failed: ${campaignsError.message}`);
        const campaigns = (campaignRows ?? []) as Array<{
          id: string;
          name: string;
          tracker_sheet_id: string;
        }>;

        for (const campaign of campaigns) {
          // Per-campaign isolation within the brand: one bad tracker must
          // not stop the rest of this brand's campaigns from syncing.
          try {
            const values = await readRecapSummaryValues(campaign.tracker_sheet_id);
            await writeCampaignTab(masterTrackerId, campaign.name, values);
          } catch (e) {
            console.error(
              `[master-tracker-sync] campaign ${campaign.id} (${campaign.name}) failed:`,
              e instanceof Error ? e.message : String(e),
            );
          }
        }

        synced.push({ brand: brand.name, campaigns: campaigns.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[master-tracker-sync] ${brand.id} (${brand.name}) failed:`, message);
        skipped.push({ brand: brand.name, reason: message });
      }
    }

    const report = {
      brandsConsidered: brands.length,
      synced,
      skipped,
      capped: brands.length === MAX_BRANDS_PER_RUN,
    };

    await logRun(supabase, actorId, inputPayload, report, "complete", startedAt).catch(() => {});
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[master-tracker-sync] run failed:", message);
    await logRun(supabase, actorId, inputPayload, null, "failed", startedAt, message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
