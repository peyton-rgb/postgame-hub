"use server";

// ============================================================
// Saved audiences — write paths (saved_audiences, migration 083).
// Staff-gated, audit-logged. The filters are stored in the same
// params vocabulary the builder URL uses (src/lib/admin/audience.ts),
// re-parsed here so only known keys are ever stored. Until 083 is
// applied the save fails honest: back to the builder with
// result=pending, filters intact.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";
import { audienceParams, audienceQuery, buildAudienceFilters } from "@/lib/admin/audience";

export async function saveAudience(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim().slice(0, 120) || "Untitled audience";
  const description = String(formData.get("description") ?? "").trim().slice(0, 500) || null;
  const download = formData.get("download") === "1";

  let raw: Record<string, string | undefined> = {};
  try {
    raw = JSON.parse(String(formData.get("params") ?? "{}"));
  } catch {
    raw = {};
  }
  const f = buildAudienceFilters(raw);
  const filters = audienceParams(f);
  const back = `/admin/audiences/new?${audienceQuery(f)}${id ? `&id=${id}` : ""}&name=${encodeURIComponent(name)}`;

  const supabase = createServiceSupabase() as any; // saved_audiences (083) is not in the generated types yet
  let savedId = id;
  if (id) {
    const { error } = await supabase
      .from("saved_audiences")
      .update({ name, description, filters, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) redirect(`${back}&result=${isMissingSchemaError(error) ? "pending" : "error"}`);
  } else {
    const { data, error } = await supabase
      .from("saved_audiences")
      .insert({ name, description, filters, created_by: actor.id })
      .select("id")
      .single();
    if (error || !data) redirect(`${back}&result=${error && isMissingSchemaError(error) ? "pending" : "error"}`);
    savedId = (data as { id: string }).id;
  }

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: id ? "audiences.update" : "audiences.create",
    entity: "saved_audiences",
    entityId: savedId ?? undefined,
    after: { name, filters },
  });

  revalidatePath("/admin/audiences");
  redirect(`/admin/audiences/${savedId}?result=saved${download ? "&dl=1" : ""}`);
}

export async function deleteAudience(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/audiences");

  const supabase = createServiceSupabase() as any; // saved_audiences (083) is not in the generated types yet
  const { data: before } = await supabase.from("saved_audiences").select("id, name, filters").eq("id", id).maybeSingle();
  if (!before) redirect("/admin/audiences");
  const { error } = await supabase.from("saved_audiences").delete().eq("id", id);
  if (error) redirect(`/admin/audiences/${id}?result=error`);

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "audiences.delete",
    entity: "saved_audiences",
    entityId: id,
    before: before as Record<string, unknown>,
  });
  revalidatePath("/admin/audiences");
  redirect("/admin/audiences?result=deleted");
}
