"use server";

// ============================================================
// Invites — mark a text / DM as sent, private account, bad
// Instagram, or back to not sent (athlete_invites, migration 091).
// Staff-gated, audit-logged, fails honest until 091 is applied.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

const STATUSES = ["sent", "private", "bad_ig", "not_sent"] as const;

export async function markInvite(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = String(formData.get("back") ?? "/admin/invites");
  const safeBack = back.startsWith("/admin/invites") ? back : "/admin/invites";
  const sep = safeBack.includes("?") ? "&" : "?";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(STATUSES as readonly string[]).includes(status)) redirect(safeBack);

  const db = createServiceSupabase() as any; // athlete_invites (091) is not in the generated types yet
  const { data: before, error: readErr } = await db.from("athlete_invites").select("id, status, sent_at, sent_by").eq("id", id).maybeSingle();
  if (readErr) redirect(`${safeBack}${sep}result=${isMissingSchemaError(readErr) ? "pending" : "error"}`);
  if (!before) redirect(safeBack);

  const after =
    status === "sent"
      ? { status, sent_at: new Date().toISOString(), sent_by: actor.id }
      : status === "not_sent"
        ? { status, sent_at: null, sent_by: null }
        : { status };
  const { error } = await db.from("athlete_invites").update(after).eq("id", id);
  if (error) redirect(`${safeBack}${sep}result=error`);

  await logAdminAction({ actorId: actor.id, actorEmail: actor.email, action: "invites.mark_" + status, entity: "athlete_invites", entityId: id, before, after });
  revalidatePath("/admin/invites");
  redirect(`${safeBack}${sep}result=${status}`);
}
