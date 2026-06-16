// ============================================================
// Athlete Drive folders
//
// On content upload, ensures a Drive folder tree exists for the deal:
//   <ATHLETE_DRIVE_ROOT_FOLDER_ID>/[Brand]/[Campaign]/[Athlete]
// and caches the leaf folder id on the opt-in. Reuses the existing
// google-drive ensureFolder helper.
//
// STUB-SAFE: if the Drive service account or the root folder env var is not
// configured, this logs a TODO and no-ops so uploads never break.
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";

function one(v: any) {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

function sanitize(name: string): string {
  // Drive folder names can't be empty; keep them tidy.
  return (name || "").replace(/[\\/]+/g, "-").trim() || "Untitled";
}

export async function ensureAthleteDealFolder(optinId: string): Promise<string | null> {
  const root = process.env.ATHLETE_DRIVE_ROOT_FOLDER_ID;
  if (!root || !process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) {
    console.warn(
      "[drive] athlete deal folders disabled — set ATHLETE_DRIVE_ROOT_FOLDER_ID and GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON to enable. TODO."
    );
    return null;
  }

  const service = createServiceSupabase();
  const { data } = await service
    .from("athlete_campaign_optins")
    .select(
      "id,drive_folder_id,athlete:profiles!athlete_id(full_name,email),campaign:optin_campaigns(title,brand:brands(name))"
    )
    .eq("id", optinId)
    .maybeSingle();

  if (!data) return null;
  if (data.drive_folder_id) return data.drive_folder_id;

  const athlete = one((data as any).athlete);
  const campaign = one((data as any).campaign);
  const brand = campaign ? one(campaign.brand) : null;

  const brandName = sanitize(brand?.name || "Unknown Brand");
  const campaignName = sanitize(campaign?.title || "Campaign");
  const athleteName = sanitize(athlete?.full_name || athlete?.email || "Athlete");

  try {
    const { ensureFolder } = await import("@/lib/google-drive");
    const brandFolder = await ensureFolder(brandName, root);
    const campaignFolder = await ensureFolder(campaignName, brandFolder.id);
    const athleteFolder = await ensureFolder(athleteName, campaignFolder.id);

    await service
      .from("athlete_campaign_optins")
      .update({ drive_folder_id: athleteFolder.id, updated_at: new Date().toISOString() })
      .eq("id", optinId);

    return athleteFolder.id;
  } catch (e: any) {
    console.error("[drive] ensureAthleteDealFolder failed:", e?.message || e);
    return null;
  }
}
