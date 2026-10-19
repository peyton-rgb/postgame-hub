// ============================================================
// Campaign server actions — create, save, delete.
// Writes the blended `campaigns` table (migration 083), keyed by
// campaign_id (the ColdFusion campaign number for migrated rows).
//
// Every action re-checks the signed-in user on the server (never
// trusts the page), writes only the columns the form owns, and
// scopes every update/delete to one campaign_id.
// ============================================================

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminActor } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";

// Text columns the edit form owns (empty input -> null).
const TEXT_FIELDS = [
  "campaign_name",
  "sow_link",
  "invoice_link",
  "campaign_brief_link",
  "campaign_webpage",
  "campaign_tracker",
  "campaign_recap_link",
  "campaign_style_guide",
  "asana_link",
  "affiliate_link",
  "affiliate_landing_page",
  "affiliate_ad_id",
  "affiliate_param_template",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "custom_tracking",
] as const;

// Money / percent columns (strip $ , % and spaces; empty -> null).
const NUMBER_FIELDS = [
  "total_budget",
  "est_athlete_spend",
  "est_videographer_spend",
  "management_fee",
  "other_spend",
  "est_margin_goal",
] as const;

// uuid link columns (empty -> null).
const UUID_FIELDS = ["brand_id", "manager_person_id", "assistant_person_id"] as const;

function text(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = typeof v === "string" ? v.replace(/[$,%\s]/g, "") : "";
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function campaignIdFrom(formData: FormData): number | null {
  const n = Number(formData.get("campaign_id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function createCampaign(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const name = text(formData.get("campaign_name"));
  if (!name) redirect("/admin/campaigns/new?result=name-required");

  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      campaign_name: name,
      brand_id: text(formData.get("brand_id")),
      is_active: true,
      date_stamp: new Date().toISOString(),
      user_stamp: actor.email,
    })
    .select("campaign_id")
    .single();

  if (error || !data) {
    console.error("[admin/campaigns] create failed", error);
    redirect("/admin/campaigns/new?result=error");
  }

  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${data.campaign_id}/edit?result=created`);
}

export async function saveCampaign(formData: FormData) {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = campaignIdFrom(formData);
  if (!id) redirect("/admin/campaigns");

  const patch: Record<string, string | number | boolean | null> = {
    is_active: formData.get("is_active") === "on",
    user_stamp: actor.email,
  };
  for (const f of TEXT_FIELDS) patch[f] = text(formData.get(f));
  for (const f of NUMBER_FIELDS) patch[f] = num(formData.get(f));
  for (const f of UUID_FIELDS) patch[f] = text(formData.get(f));
  if (!patch.campaign_name) redirect(`/admin/campaigns/${id}/edit?result=name-required`);

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("campaigns").update(patch).eq("campaign_id", id);
  if (error) {
    console.error("[admin/campaigns] save failed", id, error);
    redirect(`/admin/campaigns/${id}/edit?result=error`);
  }

  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${id}/edit?result=saved`);
}

export async function deleteCampaign(formData: FormData) {
  // Deleting is admin-only, as in the Lovable admin.
  const actor = await getAdminActor("admin");
  if (!actor) redirect("/admin/campaigns");

  const id = campaignIdFrom(formData);
  if (!id) redirect("/admin/campaigns");
  if (formData.get("confirm") !== "DELETE") {
    redirect(`/admin/campaigns/${id}/edit?result=delete-unconfirmed`);
  }

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("campaigns").delete().eq("campaign_id", id);
  if (error) {
    // Content, opt-in pages and contracts block the delete on purpose
    // (database rule: on delete restrict) so nothing is lost by accident.
    console.error("[admin/campaigns] delete failed", id, error);
    redirect(`/admin/campaigns/${id}/edit?result=delete-blocked`);
  }

  revalidatePath("/admin/campaigns");
  redirect("/admin/campaigns?result=deleted");
}
