"use server";

// ============================================================
// User edit write paths — all confirmed POSTs, access-gated,
// audit-logged, scoped by id. No GET mutations anywhere.
//
// DNW (do-not-work-with, migration 025): any staff can SET with a
// required reason; only admin+ can REMOVE; both are logged. Until
// 025 is applied these fail honest (redirect flag pending025).
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

export async function savePerson(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/users");

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .single();
  if (beforeError || !before) redirect("/admin/users");

  const update: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) update[key] = value;
  };
  set("first_name", cleanText(formData.get("first_name")));
  set("last_name", cleanText(formData.get("last_name")));
  set("email", cleanText(formData.get("email")));
  set("phone", cleanText(formData.get("phone")));
  set("instagram_handle", cleanText(formData.get("instagram_handle"))?.replace(/^@/, ""));
  set("tiktok_handle", cleanText(formData.get("tiktok_handle"))?.replace(/^@/, ""));
  set("sport", cleanText(formData.get("sport")));
  set("gender", cleanText(formData.get("gender")));
  set("rating", cleanText(formData.get("rating")));
  set("roster_status", cleanText(formData.get("roster_status")));
  set("shipping_address", cleanText(formData.get("shipping_address")));
  set("shipping_city", cleanText(formData.get("shipping_city")));
  set("shipping_state", cleanText(formData.get("shipping_state")));
  set("shipping_zip", cleanText(formData.get("shipping_zip")));

  let failed = false;
  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("people").update(update).eq("id", id);
    failed = Boolean(error);
  }

  if (!failed) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "person.update",
      entity: "people",
      entityId: id,
      before: Object.fromEntries(Object.keys(update).map((k) => [k, (before as any)[k]])),
      after: update,
    });
  }

  revalidatePath(`/admin/users/${id}`);
  redirect(`/admin/users/${id}?result=${failed ? "error" : "saved"}`);
}

export async function toggleActive(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/users");

  const supabase = createServiceSupabase();
  const { data: before } = await supabase.from("people").select("id, is_active").eq("id", id).single();
  if (!before) redirect("/admin/users");

  const next = !before.is_active;
  const { error } = await supabase.from("people").update({ is_active: next }).eq("id", id);
  if (!error) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: next ? "person.activate" : "person.deactivate",
      entity: "people",
      entityId: id,
      before: { is_active: before.is_active },
      after: { is_active: next },
    });
  }
  revalidatePath(`/admin/users/${id}`);
  redirect(`/admin/users/${id}?result=${error ? "error" : "saved"}`);
}

export async function setDnw(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const reason = cleanText(formData.get("dnw_reason"));
  const category = cleanText(formData.get("dnw_category"));
  if (!id) redirect("/admin/users");
  if (!reason) redirect(`/admin/users/${id}?result=dnw-needs-reason`);

  const supabase = createServiceSupabase();
  const { error } = await supabase
    .from("people")
    .update({
      dnw_flag: true,
      dnw_reason: reason,
      dnw_category: category,
      dnw_set_by: actor.id,
      dnw_set_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error && isMissingSchemaError(error)) {
    redirect(`/admin/users/${id}?result=pending025`);
  }
  if (!error) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "person.dnw_set",
      entity: "people",
      entityId: id,
      after: { dnw_flag: true, dnw_reason: reason, dnw_category: category },
    });
  }
  revalidatePath(`/admin/users/${id}`);
  redirect(`/admin/users/${id}?result=${error ? "error" : "saved"}`);
}

export async function removeDnw(formData: FormData): Promise<void> {
  const actor = await getAdminActor("admin"); // admin+ only
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/users");

  const supabase = createServiceSupabase();
  const { data: before } = await supabase
    .from("people")
    .select("dnw_flag, dnw_reason, dnw_category")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("people")
    .update({ dnw_flag: false, dnw_reason: null, dnw_category: null, dnw_set_by: null, dnw_set_at: null })
    .eq("id", id);

  if (error && isMissingSchemaError(error)) {
    redirect(`/admin/users/${id}?result=pending025`);
  }
  if (!error) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "person.dnw_remove",
      entity: "people",
      entityId: id,
      before: before ?? undefined,
      after: { dnw_flag: false },
    });
  }
  revalidatePath(`/admin/users/${id}`);
  redirect(`/admin/users/${id}?result=${error ? "error" : "saved"}`);
}
