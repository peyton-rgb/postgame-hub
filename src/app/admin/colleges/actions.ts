"use server";

// ============================================================
// Colleges admin write paths — confirmed POSTs, audit-logged.
// - saveCollege: scoped UPDATE on colleges
// - mapAlias: INSERT into school_aliases (the dedupe mapper —
//   attaches an unmatched raw school string to a canonical college)
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

function cleanText(raw: FormDataEntryValue | null): string | null | undefined {
  if (raw == null) return undefined;
  const v = String(raw).trim();
  return v === "" ? null : v;
}

export async function saveCollege(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = parseInt(String(formData.get("id") ?? ""), 10);
  if (Number.isNaN(id)) redirect("/admin/colleges");

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("colleges")
    .select("*")
    .eq("id", id)
    .single();
  if (beforeError || !before) redirect("/admin/colleges");

  const update: Record<string, unknown> = {};
  const set = (key: string, value: unknown) => {
    if (value !== undefined) update[key] = value;
  };
  set("name", cleanText(formData.get("name")));
  set("short_name", cleanText(formData.get("short_name")));
  set("city", cleanText(formData.get("city")));
  set("state", cleanText(formData.get("state")));
  set("zip", cleanText(formData.get("zip")));
  set("website", cleanText(formData.get("website")));
  set("ncaa_division", cleanText(formData.get("ncaa_division")));
  const active = cleanText(formData.get("is_active"));
  if (active === "true" || active === "false") update.is_active = active === "true";

  let failed = false;
  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("colleges").update(update).eq("id", id);
    failed = Boolean(error);
  }
  if (!failed) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "college.update",
      entity: "colleges",
      entityId: String(id),
      before: Object.fromEntries(Object.keys(update).map((k) => [k, (before as any)[k]])),
      after: update,
    });
  }
  revalidatePath(`/admin/colleges/${id}/edit`);
  revalidatePath("/admin/colleges");
  redirect(`/admin/colleges/${id}/edit?result=${failed ? "error" : "saved"}`);
}

export async function mapAlias(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const alias = cleanText(formData.get("alias"));
  const collegeId = parseInt(String(formData.get("college_id") ?? ""), 10);
  const backTo = String(formData.get("back") ?? "/admin/colleges/mapper");
  if (!alias || Number.isNaN(collegeId)) redirect(backTo);

  const supabase = createServiceSupabase();

  // SELECT first: the canonical college must exist, and the alias
  // must not already be mapped (duplicates would poison matching).
  const [{ data: college }, { data: existing }] = await Promise.all([
    supabase.from("colleges").select("id, name").eq("id", collegeId).single(),
    supabase.from("school_aliases").select("id, college_id").ilike("alias", alias).limit(1),
  ]);
  if (!college) redirect(`${backTo}?result=no-college`);
  if (existing && existing.length > 0) redirect(`${backTo}?result=already-mapped`);

  const { error } = await supabase.from("school_aliases").insert({
    alias,
    school_name: college.name,
    college_id: college.id,
  });

  if (!error) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "school_alias.map",
      entity: "school_aliases",
      after: { alias, college_id: college.id, school_name: college.name },
    });
  }
  revalidatePath("/admin/colleges/mapper");
  redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}result=${error ? "error" : "mapped"}`);
}
