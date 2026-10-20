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
//
// Payout actions land back on /admin/pay/athletes (the list the
// buttons live on) and carry the tab / filter the user was looking
// at. Invoice actions land on /admin/pay/invoices. The `invoices`
// table is migration 083 (unapplied): its actions detect a missing
// table and report it instead of failing silently.
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminActor, isMissingSchemaError } from "@/lib/admin/auth";
import { logAdminAction } from "@/lib/admin/audit";
import { createServiceSupabase } from "@/lib/supabase-server";

const ATHLETES = "/admin/pay/athletes";
const INVOICES = "/admin/pay/invoices";

/** Rebuild the list URL the user came from (tab / method / q / page) plus a result code. */
function backTo(base: string, formData: FormData, result: string): string {
  // A row action on the To pay overview carries return_to so the user lands back there.
  const returnTo = String(formData.get("return_to") ?? "");
  if (/^\/admin\/pay(\/[a-z0-9-]+)?$/.test(returnTo)) base = returnTo;
  const q = new URLSearchParams();
  for (const key of ["tab", "method", "q", "page", "show", "view", "type"]) {
    const v = String(formData.get(`return_${key}`) ?? "").trim();
    if (v) q.set(key, v);
  }
  q.set("result", result);
  return `${base}?${q.toString()}`;
}

function revalidatePay(id?: string) {
  revalidatePath("/admin/pay");
  revalidatePath(ATHLETES);
  revalidatePath("/admin/pay/history");
  revalidatePath("/admin/pay/bonus-affiliate");
  if (id) revalidatePath(`/admin/pay/${id}`);
}

async function transitionPayout(
  formData: FormData,
  nextStatus: "paid" | "denied" | "removed",
  action: string
): Promise<void> {
  const actor = await getAdminActor("exec");
  if (!actor) redirect(backTo(ATHLETES, formData, "exec-only"));

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(ATHLETES);

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("payouts")
    .select("id, status, amount_cents, amount_label, athlete_id, paid_at")
    .eq("id", id)
    .single();
  if (beforeError || !before) redirect(backTo(ATHLETES, formData, "not-found"));

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
  revalidatePay(id);
  redirect(backTo(ATHLETES, formData, error ? "error" : "saved"));
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
  if (!actor) redirect(`${ATHLETES}?result=exec-only`);

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(ATHLETES);

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("payouts")
    .select("id, amount_cents, paypal_email, provider, status")
    .eq("id", id)
    .single();
  if (beforeError || !before) redirect(`${ATHLETES}?result=not-found`);

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
  revalidatePay(id);
  redirect(`/admin/pay/${id}?result=${failed ? "error" : "saved"}`);
}

// ------------------------------------------------------------
// Invoices (migration 083 `invoices`)
// ------------------------------------------------------------

const PAYEE_TYPES = ["athlete", "agency", "videographer", "other"] as const;
const INVOICE_METHODS = ["ach", "paypal", "venmo", "zelle", "wire", "check"] as const;
const TERMS_DAYS: Record<string, number> = { asap: 0, net30: 30, net45: 45 };

/** Log a new invoice. Bank account, routing and tax numbers are never collected — the table has no columns for them on purpose. */
export async function submitInvoice(formData: FormData): Promise<void> {
  const actor = await getAdminActor("exec");
  if (!actor) redirect(`${INVOICES}?tab=submit&result=exec-only`);

  const payeeType = String(formData.get("payee_type") ?? "").trim();
  const name = String(formData.get("recipient_name") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").replace(/[$,\s]/g, "");
  const dollars = Number(amountRaw);
  const method = String(formData.get("method") ?? "").trim();
  const terms = String(formData.get("terms") ?? "asap").trim();
  const campaignRaw = String(formData.get("campaign_id") ?? "").trim();
  const campaignId = /^\d+$/.test(campaignRaw) ? Number(campaignRaw) : null;

  if (
    !(PAYEE_TYPES as readonly string[]).includes(payeeType) ||
    !name ||
    amountRaw === "" ||
    !Number.isFinite(dollars) ||
    dollars <= 0 ||
    dollars > 1_000_000 ||
    !(INVOICE_METHODS as readonly string[]).includes(method) ||
    !(terms in TERMS_DAYS)
  ) {
    redirect(`${INVOICES}?tab=submit&result=invalid`);
  }

  const supabase = createServiceSupabase();
  const row = {
    payee_type: payeeType,
    name,
    ig: String(formData.get("ig_username") ?? "").trim().replace(/^@/, "") || null,
    email: String(formData.get("recipient_email") ?? "").trim() || null,
    phone: String(formData.get("recipient_phone") ?? "").trim() || null,
    campaign_id: campaignId,
    amount: Math.round(dollars * 100) / 100,
    payment_method: method,
    payment_handle: String(formData.get("handle") ?? "").trim() || null,
    payment_due_days: TERMS_DAYS[terms],
    confirmation_number: String(formData.get("invoice_number") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    date_stamp: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase.from("invoices").insert(row).select("invoice_id").single();
  if (error) {
    redirect(`${INVOICES}?tab=submit&result=${isMissingSchemaError(error) ? "pending083" : "error"}`);
  }
  await logAdminAction({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "invoice.submit",
    entity: "invoices",
    entityId: String(inserted?.invoice_id ?? ""),
    before: null,
    after: row,
  });
  revalidatePath(INVOICES);
  revalidatePath("/admin/pay");
  redirect(`${INVOICES}?tab=${TERMS_DAYS[terms] === 0 ? "asap" : "scheduled"}&result=submitted`);
}

/** Stamp date_paid on one invoice once the money has actually gone out. */
export async function markInvoicePaid(formData: FormData): Promise<void> {
  const actor = await getAdminActor("exec");
  if (!actor) redirect(backTo(INVOICES, formData, "exec-only"));

  const idRaw = String(formData.get("invoice_id") ?? "");
  if (!/^\d+$/.test(idRaw)) redirect(INVOICES);
  const id = Number(idRaw);

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("invoices")
    .select("invoice_id, name, amount, date_paid")
    .eq("invoice_id", id)
    .single();
  if (beforeError) {
    redirect(backTo(INVOICES, formData, isMissingSchemaError(beforeError) ? "pending083" : "not-found"));
  }
  if (!before) redirect(backTo(INVOICES, formData, "not-found"));
  if (before.date_paid) redirect(backTo(INVOICES, formData, "unchanged"));

  const update = { date_paid: new Date().toISOString() };
  const { error } = await supabase.from("invoices").update(update).eq("invoice_id", id).is("date_paid", null);
  if (!error) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "invoice.mark_paid",
      entity: "invoices",
      entityId: String(id),
      before: { date_paid: before.date_paid },
      after: update,
    });
  }
  revalidatePath(INVOICES);
  revalidatePath("/admin/pay");
  revalidatePath("/admin/pay/history");
  redirect(backTo(INVOICES, formData, error ? "error" : "saved"));
}

// ------------------------------------------------------------
// Bonuses (migration 083 `payment_bonus`)
// ------------------------------------------------------------

const BONUSES = "/admin/pay/bonus-affiliate";

/** Stamp date_paid on one bonus once the money has actually gone out. */
export async function markBonusPaid(formData: FormData): Promise<void> {
  const actor = await getAdminActor("exec");
  if (!actor) redirect(backTo(BONUSES, formData, "exec-only"));

  const idRaw = String(formData.get("payment_bonus_id") ?? "");
  if (!/^\d+$/.test(idRaw)) redirect(BONUSES);
  const id = Number(idRaw);

  const supabase = createServiceSupabase();
  const { data: before, error: beforeError } = await supabase
    .from("payment_bonus")
    .select("payment_bonus_id, amount, date_paid")
    .eq("payment_bonus_id", id)
    .single();
  if (beforeError) {
    redirect(backTo(BONUSES, formData, isMissingSchemaError(beforeError) ? "pending083" : "not-found"));
  }
  if (!before) redirect(backTo(BONUSES, formData, "not-found"));
  if (before.date_paid) redirect(backTo(BONUSES, formData, "unchanged"));

  const update = { date_paid: new Date().toISOString() };
  const { error } = await supabase.from("payment_bonus").update(update).eq("payment_bonus_id", id).is("date_paid", null);
  if (!error) {
    await logAdminAction({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "bonus.mark_paid",
      entity: "payment_bonus",
      entityId: String(id),
      before: { date_paid: before.date_paid },
      after: update,
    });
  }
  revalidatePay();
  redirect(backTo(BONUSES, formData, error ? "error" : "saved"));
}
