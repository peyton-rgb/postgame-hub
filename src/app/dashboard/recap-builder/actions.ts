"use server";

// Saving a recap_config.
//
// Two things this has to get right.
//
// REVALIDATION. Next caches the recap page's Supabase read in its fetch Data
// Cache, which lives on disk and survives a restart — a saved config was
// invisible on the recap page through two dev-server restarts until .next was
// cleared. So the write is followed by targeted invalidation of the pages that
// read it. Not no-store on the recap query: that would strip caching from
// public client-facing recaps that carry real traffic, to solve a problem that
// only exists in the instant someone saves.
//
// VALIDATION ON WRITE. What goes into the column is what the validator
// produces, not what the client posted. The builder and the page then read the
// same normalised shape, and a malformed payload cannot be stored at all.
import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase";
import { validateRecapConfig, type RecapConfig } from "@/lib/recap-v2/config";

export interface SaveResult {
  ok: boolean;
  error?: string;
  /** Anything the validator dropped, so the builder can say so. */
  issues?: string[];
  /** The stored shape, for the client to reset its baseline against. */
  saved?: RecapConfig;
}

export async function saveRecapConfig(
  campaignId: string,
  incoming: unknown,
): Promise<SaveResult> {
  if (!campaignId) return { ok: false, error: "No campaign id." };

  const { config, issues } = validateRecapConfig(incoming);
  const supabase = createServiceSupabase();

  // The slug is what the public route is keyed on, so it has to be read before
  // the path can be invalidated.
  const { data: campaign, error: readError } = await supabase
    .from("campaign_recaps")
    .select("slug")
    .eq("id", campaignId)
    .single();
  if (readError || !campaign) {
    return { ok: false, error: "Campaign not found." };
  }

  const { error } = await supabase
    .from("campaign_recaps")
    .update({ recap_config: config })
    .eq("id", campaignId);
  if (error) return { ok: false, error: error.message };

  // The recap itself, and the builder, which reads the config back on load.
  revalidatePath(`/recap/${campaign.slug}`);
  revalidatePath(`/dashboard/recap-builder/${campaignId}`);

  return { ok: true, issues, saved: config };
}
