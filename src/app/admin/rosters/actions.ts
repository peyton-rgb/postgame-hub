"use server";

// ============================================================
// Rosters — write paths (migration 091 tables). Staff-gated,
// audit-logged, fail honest (result=pending) until 091 is applied.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

export async function resolveRosterIssue(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "ignored" ? "ignored" : "resolved";
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/rosters");

  const db = createServiceSupabase() as any;
  const { data: before, error: readErr } = await db.from("roster_issues").select("*").eq("id", id).maybeSingle();
  if (readErr) redirect(`/admin/rosters?result=${isMissingSchemaError(readErr) ? "pending" : "error"}`);
  if (!before) redirect("/admin/rosters");
  const { error } = await db
    .from("roster_issues")
    .update({ status, resolved_at: new Date().toISOString(), resolved_by: actor.id })
    .eq("id", id);
  if (error) redirect("/admin/rosters?result=error");

  await logAdminAction({ actorId: actor.id, actorEmail: actor.email, action: "rosters.issue_" + status, entity: "roster_issues", entityId: id, before, after: { status } });
  revalidatePath("/admin/rosters");
  redirect("/admin/rosters?result=" + status);
}

const bool = (fd: FormData, k: string) => fd.get(k) === "on";

export async function saveRosterSettings(formData: FormData): Promise<void> {
  const actor = await getAdminActor("staff");
  if (!actor) redirect("/login");

  const cadence = String(formData.get("cadence") ?? "weekly");
  const onMissing = String(formData.get("on_missing") ?? "archive");
  const hold = parseInt(String(formData.get("hold_back_below_pct") ?? "50"), 10);
  const months = formData.getAll("sweep_months").map(String).filter((m) => ["august", "october", "january"].includes(m));
  const row = {
    id: 1,
    cadence: ["weekly", "biweekly", "monthly"].includes(cadence) ? cadence : "weekly",
    run_at: String(formData.get("run_at") ?? "04:00 America/New_York").slice(0, 60),
    sweep_months: months,
    transfer_by_instagram: bool(formData, "transfer_by_instagram"),
    save_instagram_id: bool(formData, "save_instagram_id"),
    may_add: bool(formData, "may_add"),
    may_fill_handles: bool(formData, "may_fill_handles"),
    may_update_details: bool(formData, "may_update_details"),
    on_missing: onMissing === "flag" ? "flag" : "archive",
    hold_back_below_pct: [0, 50, 70].includes(hold) ? hold : 50,
    slack_summary: bool(formData, "slack_summary"),
    workspace_tasks: bool(formData, "workspace_tasks"),
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };

  const db = createServiceSupabase() as any;
  const { data: before, error: readErr } = await db.from("roster_settings").select("*").eq("id", 1).maybeSingle();
  if (readErr) redirect(`/admin/rosters/settings?result=${isMissingSchemaError(readErr) ? "pending" : "error"}`);
  const { error } = await db.from("roster_settings").upsert(row, { onConflict: "id" });
  if (error) redirect("/admin/rosters/settings?result=error");

  await logAdminAction({ actorId: actor.id, actorEmail: actor.email, action: "rosters.settings", entity: "roster_settings", entityId: "1", before, after: row });
  revalidatePath("/admin/rosters/settings");
  redirect("/admin/rosters/settings?result=saved");
}
