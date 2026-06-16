// ============================================================
// Payouts — created when a deal is fully verified.
//
// Payment terms: a payout is scheduled 30 days after verification. Actual
// PayPal execution is STUBBED (no credentials, no money). Amounts come from
// the deal's free-text payout label; amount_cents stays null until a manager
// sets a real figure, so we never invent dollar values.
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";

const PAYOUT_DELAY_DAYS = 30;

export type Payout = {
  id: string;
  optin_id: string;
  status: string;
  amount_cents: number | null;
  amount_label: string | null;
  currency: string;
  scheduled_for: string;
  paid_at: string | null;
  paypal_email: string | null;
  brandName: string | null;
  brandLogo: string | null;
  campaignTitle: string | null;
};

// Create a pending payout for a fully-verified opt-in. Idempotent (one payout
// per deal). Snapshots the athlete's PayPal email if they've linked one.
export async function createPendingPayout(optinId: string): Promise<void> {
  const service = createServiceSupabase();

  const { data: optin, error } = await service
    .from("athlete_campaign_optins")
    .select(
      "id,athlete_id,optin_campaign_id,campaign:optin_campaigns(payout),athlete:profiles!athlete_id(paypal_email)"
    )
    .eq("id", optinId)
    .maybeSingle();

  if (error || !optin) {
    console.error("createPendingPayout: opt-in not found", error?.message);
    return;
  }

  const campaign = Array.isArray((optin as any).campaign) ? (optin as any).campaign[0] : (optin as any).campaign;
  const athlete = Array.isArray((optin as any).athlete) ? (optin as any).athlete[0] : (optin as any).athlete;

  const scheduledFor = new Date(Date.now() + PAYOUT_DELAY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // upsert-ignore on the unique optin_id so re-verification is safe.
  const { error: insErr } = await service.from("payouts").upsert(
    {
      athlete_id: optin.athlete_id,
      optin_id: optin.id,
      optin_campaign_id: optin.optin_campaign_id,
      amount_label: campaign?.payout ?? null,
      paypal_email: athlete?.paypal_email ?? null,
      status: "pending",
      scheduled_for: scheduledFor,
    },
    { onConflict: "optin_id", ignoreDuplicates: true }
  );

  if (insErr) console.error("createPendingPayout insert error:", insErr.message);

  // NOTE(stub): real PayPal payout execution would be triggered on/after
  // scheduled_for by a cron/edge function calling the PayPal Payouts API with
  // server-side credentials. Intentionally not implemented — no live money.
}

const PAYOUT_SELECT =
  "id,optin_id,status,amount_cents,amount_label,currency,scheduled_for,paid_at,paypal_email,campaign:optin_campaigns(title,brand:brands(name,logo_url,logo_white_url))";

function shape(row: any): Payout {
  const campaign = Array.isArray(row.campaign) ? row.campaign[0] : row.campaign;
  const brand = campaign ? (Array.isArray(campaign.brand) ? campaign.brand[0] : campaign.brand) : null;
  return {
    id: row.id,
    optin_id: row.optin_id,
    status: row.status,
    amount_cents: row.amount_cents ?? null,
    amount_label: row.amount_label ?? null,
    currency: row.currency || "USD",
    scheduled_for: row.scheduled_for,
    paid_at: row.paid_at ?? null,
    paypal_email: row.paypal_email ?? null,
    brandName: brand?.name ?? null,
    brandLogo: brand?.logo_url ?? brand?.logo_white_url ?? null,
    campaignTitle: campaign?.title ?? null,
  };
}

export type Earnings = {
  payouts: Payout[];
  paidCount: number;
  pendingCount: number;
  paidCents: number; // sum of known paid amounts
  pendingCents: number; // sum of known pending amounts
};

export async function getEarnings(athleteId: string): Promise<Earnings> {
  const service = createServiceSupabase();
  const { data, error } = await service
    .from("payouts")
    .select(PAYOUT_SELECT)
    .eq("athlete_id", athleteId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getEarnings error:", error.message);
    return { payouts: [], paidCount: 0, pendingCount: 0, paidCents: 0, pendingCents: 0 };
  }

  const payouts = (data ?? []).map(shape);
  let paidCount = 0,
    pendingCount = 0,
    paidCents = 0,
    pendingCents = 0;
  for (const p of payouts) {
    if (p.status === "paid") {
      paidCount++;
      paidCents += p.amount_cents ?? 0;
    } else {
      pendingCount++;
      pendingCents += p.amount_cents ?? 0;
    }
  }
  return { payouts, paidCount, pendingCount, paidCents, pendingCents };
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
}
