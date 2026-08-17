"use server";

// ============================================================
// Campaign edit — confirmed POST write path.
//
// Rules applied (from the CF security audit):
// - server action = real POST; the UI interposes a confirm dialog
// - access-gated (staff+), athlete/anon rejected
// - link fields URL-validated
// - audit-log insert attached (fail-open until migration 027)
// - lifecycle_status / owner_id (migration 023) are written in a
//   SEPARATE update so a missing column can't sink the core save;
//   pre-migration the caller sees an honest "pending 023" note.
//
// NOTE (overnight run): this code path executes only when a human
// submits the form in a browser. Nothing calls it tonight.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/admin/auth";
import { isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

const LIFECYCLE_VALUES = ["draft", "active", "delivered", "closed"];

function cleanUrl(raw: FormDataEntryValue | null): string | null | undefined {
  if (raw == null) return undefined; // field absent -> leave untouched
  const v = String(raw).trim();
  if (v === "") return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined; // invalid URL -> do not write ("N/A" can never land in a link field again)
  }
}

function cleanText(raw: FormDataEntryValue | null): string | null | undefined {
  if (raw == null) return undefined;
  const v = String(raw).trim();
  return v === "" ? null : v;
}

export async function saveCampaign(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/campaigns");

  const supabase = createServiceSupabase();

  // SELECT the affected row first (standing DB rule + audit before-state).
  const { data: before, error: beforeError } = await supabase
    .from("campaign_recaps")
    .select("*")
    .eq("id", id)
    .single();
  if (beforeError || !before) redirect("/admin/campaigns");

  const core: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) core[key] = value;
  };

  set("name", cleanText(formData.get("name")));
  set("client_name", cleanText(formData.get("client_name")));
  set("description", cleanText(formData.get("description")));
  set("brief_url", cleanUrl(formData.get("brief_url")));
  set("tracker_url", cleanUrl(formData.get("tracker_url")));
  const status = cleanText(formData.get("status"));
  if (status === "draft" || status === "published") core.status = status;
  const tagsRaw = formData.get("tags");
  if (tagsRaw != null) {
    const tags = String(tagsRaw)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    core.tags = tags.length ? tags : null;
  }

  let saveError: string | null = null;
  if (Object.keys(core).length > 0) {
    const { error } = await supabase
      .from("campaign_recaps")
      .update(core)
      .eq("id", id); // scoped write
    if (error) saveError = error.message;
  }

  // Lifecycle fields (migration 023) — separate, honest-failing update.
  let lifecyclePending = false;
  const lifecycle: Record<string, unknown> = {};
  const lifecycleStatus = cleanText(formData.get("lifecycle_status"));
  if (lifecycleStatus && LIFECYCLE_VALUES.includes(lifecycleStatus)) {
    lifecycle.lifecycle_status = lifecycleStatus;
  }
  const ownerId = cleanText(formData.get("owner_id"));
  if (ownerId !== undefined) lifecycle.owner_id = ownerId;
  if (Object.keys(lifecycle).length > 0) {
    const { error } = await supabase.from("campaign_recaps").update(lifecycle).eq("id", id);
    if (error && isMissingSchemaError(error)) lifecyclePending = true;
    else if (error && !saveError) saveError = error.message;
  }

  if (!saveError) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "campaign.update",
      entity: "campaign_recaps",
      entityId: id,
      before: {
        name: before.name,
        client_name: before.client_name,
        status: before.status,
        brief_url: before.brief_url,
        tracker_url: before.tracker_url,
        tags: before.tags,
      },
      after: { ...core, ...(!lifecyclePending ? lifecycle : {}) },
    });
  }

  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath("/admin/campaigns");
  const flag = saveError ? "error" : lifecyclePending ? "saved-pending023" : "saved";
  redirect(`/admin/campaigns/${id}/edit?result=${flag}`);
}
