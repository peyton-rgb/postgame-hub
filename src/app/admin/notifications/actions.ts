"use server";

// ============================================================
// Mass notification — DRY-RUN ONLY tonight, by design.
//
// The send path is a confirmed POST behind a review gate that shows
// the exact recipient count. Per the overnight brief, the sending
// path is stubbed to a dry-run logger: it computes the real
// recipient list size, writes an audit-log entry marked dry_run,
// logs to the server console, and inserts/sends NOTHING. Flipping
// dryRun to false is a deliberate morning decision.
// ============================================================

import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

const DRY_RUN = true; // overnight guardrail — real sends never fire from this build

export async function sendMassNotification(formData: FormData): Promise<void> {
  const actor = await getAdminActor("admin"); // mass-send is admin+, not all staff
  if (!actor) redirect("/admin/notifications/send?result=admin-only");

  const message = String(formData.get("message") ?? "").trim();
  const linkUrl = String(formData.get("link_url") ?? "").trim();
  const audience = String(formData.get("audience") ?? "athletes");
  if (!message) redirect("/admin/notifications/send?result=needs-message");
  if (linkUrl) {
    try {
      const u = new URL(linkUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:")
        redirect("/admin/notifications/send?result=bad-link");
    } catch {
      redirect("/admin/notifications/send?result=bad-link");
    }
  }

  const supabase = createServiceSupabase();
  let recipients = 0;
  if (audience === "staff") {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .neq("role", "athlete");
    recipients = count ?? 0;
  } else {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "athlete");
    recipients = count ?? 0;
  }

  if (DRY_RUN) {
    console.log(
      `[mass-notification DRY RUN] actor=${actor.email} audience=${audience} recipients=${recipients} message="${message.slice(0, 80)}"`
    );
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "notification.mass_send_dry_run",
      entity: "notifications",
      after: { audience, recipients, message, link_url: linkUrl || null, dry_run: true },
    });
    redirect(`/admin/notifications/send?result=dry-run&count=${recipients}`);
  }

  // Real path (disabled tonight): insert one notifications row per
  // recipient profile, batched. Left unimplemented on purpose —
  // enabling sends is a reviewed decision, not a flag flip alone.
  redirect("/admin/notifications/send?result=disabled");
}
