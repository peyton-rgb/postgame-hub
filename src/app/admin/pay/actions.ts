"use server";

// ============================================================
// Pay suite write paths — the most sensitive actions in the admin.
// Every one: exec-gated, confirmed POST (dialog upstream), scoped
// UPDATE with SELECT-first, audit-log insert attached.
//
// CF's GET-link money actions (pay_success.cfm, pay_denied.cfm,
// pay_delete.cfm, campaign_pay_markpaid.cfm…) do NOT survive here.
// Note: "delete" is a status change to 'removed', not a row DELETE —
// money rows never vanish from the ledger.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

async function transitionPayout(
  formData: FormData,
  nextStatus: "paid" | "denied" | "removed",
  action: string
): Promise<void> {
  const actor = await getAdminActor("exec");
  if (!actor) redirect("/admin/pay?result=exec-only");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/pay");

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("payouts")
    .select("id, status, amount_cents, amount_label, athlete_id, paid_at")
    .eq("id", id)
    .single();
  if (beforeError || !before) redirect("/admin/pay?result=not-found");

  const update: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === "paid") update.paid_at = new Date().toISOString();

  const { error } = await supabase.from("payouts").update(update).eq("id", id);
  if (!error) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      entity: "payouts",
      entityId: id,
      before: { status: before.status, paid_at: before.paid_at },
      after: update,
    });
  }
  revalidatePath("/admin/pay");
  revalidatePath(`/admin/pay/${id}`);
  redirect(`/admin/pay?result=${error ? "error" : "saved"}`);
}

export async function markPayoutPaid(formData: FormData): Promise<void> {
  await transitionPayout(formData, "paid", "payout.mark_paid");
}

export async function denyPayout(formData: FormData): Promise<void> {
  await transitionPayout(formData, "denied", "payout.deny");
}

export async function removePayout(formData: FormData): Promise<void> {
  await transitionPayout(formData, "removed", "payout.remove");
}

export async function savePayout(formData: FormData): Promise<void> {
  const actor = await getAdminActor("exec");
  if (!actor) redirect("/admin/pay?result=exec-only");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/pay");

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("payouts")
    .select("id, amount_cents, paypal_email, provider, status")
    .eq("id", id)
    .single();
  if (beforeError || !before) redirect("/admin/pay?result=not-found");

  const update: Record<string, unknown> = {};

  const amountRaw = String(formData.get("amount") ?? "").replace(/[$,\s]/g, "");
  if (amountRaw !== "") {
    const dollars = Number(amountRaw);
    if (!Number.isFinite(dollars) || dollars < 0 || dollars > 1_000_000) {
      redirect(`/admin/pay/${id}?result=bad-amount`);
    }
    update.amount_cents = Math.round(dollars * 100);
  }
  const email = String(formData.get("paypal_email") ?? "").trim();
  if (email !== "" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) update.paypal_email = email;
  const provider = String(formData.get("provider") ?? "").trim();
  if (["paypal", "venmo", "zelle", "ach", "wire"].includes(provider)) update.provider = provider;

  let failed = false;
  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from("payouts").update(update).eq("id", id);
    failed = Boolean(error);
    if (!failed) {
      await logAdminAction({
        actorId: actor.id,
        actorEmail: actor.email,
        action: "payout.update",
        entity: "payouts",
        entityId: id,
        before: {
          amount_cents: before.amount_cents,
          paypal_email: before.paypal_email,
          provider: before.provider,
        },
        after: update,
      });
    }
  }
  revalidatePath(`/admin/pay/${id}`);
  revalidatePath("/admin/pay");
  redirect(`/admin/pay/${id}?result=${failed ? "error" : "saved"}`);
}
