"use server";

// ============================================================
// /admin/brand-mapping write path — link one admin account to one brand.
//
// The only write in the account→brand story that a human performs. Everything
// automatic is exact-match-only (see lib/account-brand-map.ts); this is where
// the cases a machine must not guess get decided.
//
// Linking also stamps brand_id onto that account's campaigns that don't have
// one — the whole point of mapping is to unblock those, so making someone run
// a separate sync afterwards would just be a second step to forget.
//
// NEVER creates a brand. The dropdown only offers brands that already exist.
// ============================================================

import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";

const BASE = "/admin/brand-mapping";

export async function linkAccountToBrand(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) return;

  const accountId = String(formData.get("admin_account_id") ?? "").trim();
  const brandId = String(formData.get("brand_id") ?? "").trim();
  if (!accountId || !brandId) return;

  const supabase = createServiceSupabase();

  const { error: mapError } = await supabase
    .from("admin_account_map")
    .update({ brand_id: brandId, mapped_by: "human", mapped_at: new Date().toISOString() })
    .eq("admin_account_id", accountId);

  if (mapError) {
    console.error("[brand-mapping] link failed:", mapError.message);
    return;
  }

  // Stamp the campaigns this unblocks. Fill-only: a campaign that already has
  // a brand keeps it, so this can never rewrite an existing association.
  const { error: stampError } = await supabase
    .from("campaign_recaps")
    .update({ brand_id: brandId })
    .eq("admin_account_id", accountId)
    .is("brand_id", null);

  if (stampError) {
    // The mapping itself succeeded and is the durable part; the stamp is
    // recoverable by re-running the account sync.
    console.error("[brand-mapping] campaign stamp failed:", stampError.message);
  }

  revalidatePath(BASE);
}
