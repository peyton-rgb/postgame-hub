"use server";

// ============================================================
// Brand edit write path — confirmed POST, staff-gated, audit-
// logged. Lifecycle/kit/MSA/socials (migration 024) update in a
// SEPARATE statement so a missing column can't sink the core save.
// Client-brand kit assets (logos, colors, fonts) are NOT edited
// here — the brand kit flow owns those; this is registry data.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

function cleanText(raw: FormDataEntryValue | null): string | null | undefined {
  if (raw == null) return undefined;
  const v = String(raw).trim();
  return v === "" ? null : v;
}

function cleanUrl(raw: FormDataEntryValue | null): string | null | undefined {
  if (raw == null) return undefined;
  const v = String(raw).trim();
  if (v === "") return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export async function saveBrand(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/brands");

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .single();
  if (beforeError || !before) redirect("/admin/brands");

  const core: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) core[key] = value;
  };
  set("name", cleanText(formData.get("name")));
  set("industry", cleanText(formData.get("industry")));
  set("website", cleanUrl(formData.get("website")));
  set("tagline", cleanText(formData.get("tagline")));
  set("notes", cleanText(formData.get("notes")));

  let failed = false;
  if (Object.keys(core).length > 0) {
    const { error } = await supabase.from("brands").update(core).eq("id", id);
    failed = Boolean(error);
  }

  // Migration 024 fields — separate honest-failing update.
  let lifecyclePending = false;
  const ext: Record<string, unknown> = {};
  const lifecycleStage = cleanText(formData.get("lifecycle_stage"));
  if (lifecycleStage !== undefined) ext.lifecycle_stage = lifecycleStage;
  const kitStatus = cleanText(formData.get("kit_status"));
  if (kitStatus === "placeholder" || kitStatus === "official") ext.kit_status = kitStatus;
  const msa = cleanUrl(formData.get("msa_url"));
  if (msa !== undefined) ext.msa_url = msa;
  const ig = cleanText(formData.get("ig_handle"));
  if (ig !== undefined) ext.ig_handle = ig ? ig.replace(/^@/, "") : null;
  const tt = cleanText(formData.get("tiktok_handle"));
  if (tt !== undefined) ext.tiktok_handle = tt ? tt.replace(/^@/, "") : null;

  if (Object.keys(ext).length > 0) {
    const { error } = await supabase.from("brands").update(ext).eq("id", id);
    if (error && isMissingSchemaError(error)) lifecyclePending = true;
    else if (error) failed = true;
  }

  if (!failed) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "brand.update",
      entity: "brands",
      entityId: id,
      before: {
        name: before.name,
        industry: before.industry,
        website: before.website,
        tagline: before.tagline,
      },
      after: { ...core, ...(!lifecyclePending ? ext : {}) },
    });
  }

  revalidatePath(`/admin/brands/${id}/edit`);
  revalidatePath("/admin/brands");
  redirect(
    `/admin/brands/${id}/edit?result=${failed ? "error" : lifecyclePending ? "saved-pending024" : "saved"}`
  );
}
