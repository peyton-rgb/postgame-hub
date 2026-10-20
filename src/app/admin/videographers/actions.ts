"use server";

// ============================================================
// /admin/videographers write path — status changes on
// videographer_profiles. Confirmed POST, staff-gated, audit-logged,
// scoped by id. SELECT before UPDATE, SELECT again to verify.
//
//   signed_up   account exists, no storage access yet
//   can_upload  Postgame granted LucidLink access — the desktop app
//               shows their assignments and accepts uploads
//   inactive    switched off
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

import { VIDEOGRAPHER_STATUSES, type VideographerStatus } from "./statuses";

function back(result: string, params: Record<string, string | undefined>): never {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  q.set("result", result);
  redirect(`/admin/videographers?${q.toString()}`);
}

export async function setVideographerStatus(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const id = String(formData.get("id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as VideographerStatus;
  // Carry the list's filters back so the person lands where they were.
  const keep = {
    status: String(formData.get("return_status") ?? "") || undefined,
    q: String(formData.get("return_q") ?? "") || undefined,
    page: String(formData.get("return_page") ?? "") || undefined,
  };

  if (!id || !VIDEOGRAPHER_STATUSES.includes(status)) back("error", keep);

  const supabase = createServiceSupabase();

  // 1 · SELECT the one row we are about to change
  const before = await supabase
    .from("videographer_profiles")
    .select("id, full_name, email, status")
    .eq("id", id)
    .maybeSingle();

  if (before.error) {
    if (isMissingSchemaError(before.error)) back("pending085", keep);
    back("error", keep);
  }
  if (!before.data) back("notfound", keep);
  if (before.data.status === status) back("unchanged", keep);

  // 2 · UPDATE, scoped by id
  const updated = await supabase
    .from("videographer_profiles")
    .update({ status })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();

  // 3 · verify
  if (updated.error || updated.data?.status !== status) back("error", keep);

  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "videographer.status",
    entity: "videographer_profiles",
    entityId: id,
    before: { status: before.data.status },
    after: { status },
  });

  revalidatePath("/admin/videographers");
  revalidatePath("/admin/users");
  back("saved", keep);
}
