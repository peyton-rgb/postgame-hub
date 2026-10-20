// ============================================================
// Pay suite reads — one place for every query the five payment
// screens share. All reads, no writes (writes live in
// src/app/admin/pay/actions.ts).
//
// Two kinds of source:
//   • `payouts` — the Hub's real athlete payout ledger (migration 004,
//     applied). One row per verified deal. Always present.
//   • `invoices`, `payment_bonus`, `affiliate_earnings`,
//     `affiliate_payments` — blended admin tables from migration 083,
//     UNAPPLIED on this branch. Every read of them goes through
//     safeQuery so a missing table degrades to { pending: true } and
//     the screen shows an honest "arrives with migration 083" note
//     instead of crashing or inventing rows.
//
// Brand marks come from the brands row's logo columns only (never
// typed text) — picked for the light admin background by brandLogo().
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { safeQuery } from "@/lib/admin/db";
import { isMissingSchemaError } from "@/lib/admin/auth";
import { BRAND_COLUMNS, brandLogo } from "@/lib/admin/campaigns/queries";
import type { BrandLite } from "@/lib/admin/campaigns/types";

type Db = SupabaseClient<any, "public", any>;

// ------------------------------------------------------------
// Payouts (athlete app)
// ------------------------------------------------------------

export interface PayoutProfile {
  full_name: string | null;
  email: string | null;
  ig_handle: string | null;
  avatar_url: string | null;
}

export interface PayoutRow {
  id: string;
  athlete_id: string | null;
  optin_campaign_id: string | null;
  amount_cents: number | null;
  amount_label: string | null;
  status: string | null;
  provider: string | null;
  paypal_email: string | null;
  scheduled_for: string | null;
  paid_at: string | null;
  created_at: string | null;
  profiles: PayoutProfile | null;
  campaign: { title: string | null; brandName: string | null; brandLogo: string | null } | null;
}

export const PAYOUT_SELECT =
  "id, athlete_id, optin_campaign_id, amount_cents, amount_label, status, provider, paypal_email, scheduled_for, paid_at, created_at, " +
  "profiles!athlete_id(full_name, email, ig_handle, avatar_url), " +
  `optin_campaigns!optin_campaign_id(title, brands!brand_id(${BRAND_COLUMNS}))`;

/** Flatten the embedded profile / campaign / brand into one row shape. */
export function shapePayout(raw: any): PayoutRow {
  const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
  const campaign = Array.isArray(raw.optin_campaigns) ? raw.optin_campaigns[0] : raw.optin_campaigns;
  const brand: BrandLite | null = campaign
    ? Array.isArray(campaign.brands)
      ? campaign.brands[0] ?? null
      : campaign.brands ?? null
    : null;
  return {
    id: raw.id,
    athlete_id: raw.athlete_id ?? null,
    optin_campaign_id: raw.optin_campaign_id ?? null,
    amount_cents: raw.amount_cents ?? null,
    amount_label: raw.amount_label ?? null,
    status: raw.status ?? null,
    provider: raw.provider ?? null,
    paypal_email: raw.paypal_email ?? null,
    scheduled_for: raw.scheduled_for ?? null,
    paid_at: raw.paid_at ?? null,
    created_at: raw.created_at ?? null,
    profiles: profile
      ? {
          full_name: profile.full_name ?? null,
          email: profile.email ?? null,
          ig_handle: profile.ig_handle ?? null,
          avatar_url: profile.avatar_url ?? null,
        }
      : null,
    campaign: campaign
      ? {
          title: campaign.title ?? null,
          brandName: brand?.name ?? null,
          brandLogo: brandLogo(brand, "light"),
        }
      : null,
  };
}

export function payoutName(r: PayoutRow): string {
  return r.profiles?.full_name ?? r.profiles?.email ?? "Unknown athlete";
}

/** Bank rails vs app wallets — the old ACH / Wire / Zelle screen's split. */
export const BANK_RAILS = ["ach", "wire", "zelle"] as const;
export const WALLET_RAILS = ["paypal", "venmo"] as const;

export type PayoutTab = "approve" | "scheduled" | "paid" | "all";
export const PAYOUT_TABS: { key: PayoutTab; label: string }[] = [
  { key: "approve", label: "To approve" },
  { key: "scheduled", label: "Scheduled" },
  { key: "paid", label: "Paid" },
  { key: "all", label: "All" },
];

export type MethodFilter = "all" | "paypal" | "venmo" | "zelle" | "ach" | "wire" | "bank";
export const METHOD_FILTERS: { key: MethodFilter; label: string }[] = [
  { key: "all", label: "All methods" },
  { key: "paypal", label: "PayPal" },
  { key: "venmo", label: "Venmo" },
  { key: "zelle", label: "Zelle" },
  { key: "ach", label: "ACH" },
  { key: "wire", label: "Wire" },
  { key: "bank", label: "ACH / Wire / Zelle" },
];

/**
 * Tab semantics, all from real columns:
 *   To approve — status 'pending' and scheduled_for has arrived (or is unset)
 *   Scheduled  — status 'pending' and scheduled_for is still in the future
 *   Paid       — status 'paid'
 *   All        — everything, including denied / removed / failed
 */
export function applyPayoutTab(query: any, tab: PayoutTab, nowIso: string) {
  if (tab === "approve") return query.eq("status", "pending").or(`scheduled_for.lte.${nowIso},scheduled_for.is.null`);
  if (tab === "scheduled") return query.eq("status", "pending").gt("scheduled_for", nowIso);
  if (tab === "paid") return query.eq("status", "paid");
  return query;
}

export function applyMethod(query: any, method: MethodFilter) {
  if (method === "all") return query;
  if (method === "bank") return query.in("provider", [...BANK_RAILS]);
  return query.eq("provider", method);
}

/** Per-tab counts for the tab pills (head requests, no rows). */
export async function payoutTabCounts(
  db: Db,
  nowIso: string,
  method: MethodFilter
): Promise<Record<PayoutTab, number | null>> {
  const run = async (tab: PayoutTab) => {
    const { count, error } = await applyMethod(
      applyPayoutTab(db.from("payouts").select("id", { count: "exact", head: true }), tab, nowIso),
      method
    );
    return error ? null : (count ?? 0);
  };
  const [approve, scheduled, paid, all] = await Promise.all([run("approve"), run("scheduled"), run("paid"), run("all")]);
  return { approve, scheduled, paid, all };
}

// ------------------------------------------------------------
// Overview numbers — every value is a query result or null.
// ------------------------------------------------------------

export interface PayOverview {
  pendingPayouts: number | null;
  /** Sum of paid amount_cents in the last 30 days; `paidCount` rows, of which `unpricedCount` had no amount set. */
  paid30Cents: number | null;
  paid30Count: number | null;
  paid30Unpriced: number | null;
  /** payouts whose deal label mentions a bonus, still pending */
  pendingBonusPayouts: number | null;
  invoices: InvoiceSummary;
  bonuses: BonusSummary;
  affiliate: AffiliateSummary;
}

export async function loadPayOverview(db: Db): Promise<PayOverview> {
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [pending, paid30, bonusPending, invoices, bonuses, affiliate] = await Promise.all([
    db.from("payouts").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("payouts").select("amount_cents").eq("status", "paid").gte("paid_at", since),
    db.from("payouts").select("id", { count: "exact", head: true }).eq("status", "pending").ilike("amount_label", "%bonus%"),
    loadInvoiceSummary(db),
    loadBonusSummary(db),
    loadAffiliateSummary(db),
  ]);

  let paid30Cents: number | null = null;
  let paid30Count: number | null = null;
  let paid30Unpriced: number | null = null;
  if (!paid30.error) {
    const rows = (paid30.data ?? []) as { amount_cents: number | null }[];
    paid30Count = rows.length;
    paid30Unpriced = rows.filter((r) => r.amount_cents == null).length;
    paid30Cents = rows.reduce((t, r) => t + (r.amount_cents ?? 0), 0);
  }

  return {
    pendingPayouts: pending.error ? null : (pending.count ?? 0),
    paid30Cents,
    paid30Count,
    paid30Unpriced,
    pendingBonusPayouts: bonusPending.error ? null : (bonusPending.count ?? 0),
    invoices,
    bonuses,
    affiliate,
  };
}

// ------------------------------------------------------------
// Invoices (migration 083, feature-detected)
// ------------------------------------------------------------

export interface InvoiceRow {
  invoice_id: number;
  name: string | null;
  payee_type: string | null;
  email: string | null;
  ig: string | null;
  amount: number | null;
  campaign_id: number | null;
  payment_method: string | null;
  payment_handle: string | null;
  payment_due_days: number | null;
  confirmation_number: string | null;
  notes: string | null;
  date_stamp: string | null;
  date_paid: string | null;
  created_at: string | null;
  /** derived */
  dueAt: Date | null;
  campaignName: string | null;
  brandName: string | null;
  brandLogo: string | null;
}

export const INVOICE_SELECT =
  "invoice_id, name, payee_type, email, ig, amount, campaign_id, payment_method, payment_handle, payment_due_days, confirmation_number, notes, date_stamp, date_paid, created_at";

/** Due = the day it was logged + its net terms (0 days = pay ASAP). */
export function invoiceDueAt(r: { date_stamp: string | null; created_at: string | null; payment_due_days: number | null }): Date | null {
  const base = r.date_stamp ?? r.created_at;
  if (!base) return null;
  const d = new Date(base);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + Math.max(0, Math.round(Number(r.payment_due_days ?? 0))));
  return d;
}

export type InvoiceTab = "asap" | "scheduled" | "paid" | "submit";

export interface InvoiceList {
  pending: boolean;
  error: string | null;
  rows: InvoiceRow[];
}

/**
 * Loads every open invoice (or paid ones) and attaches campaign + brand.
 * Due-date bucketing happens in memory because the due date is derived
 * (date_stamp + payment_due_days) rather than stored.
 */
export async function loadInvoices(db: Db, tab: Exclude<InvoiceTab, "submit">): Promise<InvoiceList> {
  let q = db.from("invoices").select(INVOICE_SELECT).limit(500);
  q = tab === "paid" ? q.not("date_paid", "is", null).order("date_paid", { ascending: false }) : q.is("date_paid", null).order("created_at", { ascending: false });
  const res = await safeQuery<any[]>(() => q as any);
  if (res.pending || res.error) return { pending: res.pending, error: res.error, rows: [] };

  const now = new Date();
  let rows = (res.data ?? []).map((r) => ({ ...r, dueAt: invoiceDueAt(r), campaignName: null, brandName: null, brandLogo: null })) as InvoiceRow[];
  if (tab === "asap") rows = rows.filter((r) => !r.dueAt || r.dueAt.getTime() <= now.getTime());
  if (tab === "scheduled") rows = rows.filter((r) => r.dueAt && r.dueAt.getTime() > now.getTime());
  if (tab !== "paid") rows.sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));

  await attachCampaigns(db, rows);
  return { pending: false, error: null, rows };
}

/** Campaign name + brand mark for rows carrying a blended `campaigns.campaign_id`. */
export async function attachCampaigns<T extends { campaign_id: number | null; campaignName: string | null; brandName: string | null; brandLogo: string | null }>(
  db: Db,
  rows: T[]
): Promise<void> {
  const ids = Array.from(new Set(rows.map((r) => r.campaign_id).filter((v): v is number => v != null)));
  if (ids.length === 0) return;
  const camp = await safeQuery<any[]>(
    () => db.from("campaigns").select(`campaign_id, campaign_name, brands!brand_id(${BRAND_COLUMNS})`).in("campaign_id", ids) as any
  );
  if (!camp.data) return;
  const byId = new Map<number, { name: string | null; brand: BrandLite | null }>();
  for (const c of camp.data) {
    const brand = Array.isArray(c.brands) ? c.brands[0] ?? null : c.brands ?? null;
    byId.set(c.campaign_id, { name: c.campaign_name ?? null, brand });
  }
  for (const r of rows) {
    const hit = r.campaign_id != null ? byId.get(r.campaign_id) : undefined;
    if (!hit) continue;
    r.campaignName = hit.name;
    r.brandName = hit.brand?.name ?? null;
    r.brandLogo = brandLogo(hit.brand, "light");
  }
}

export interface InvoiceSummary {
  pending: boolean;
  dueNow: number | null;
  scheduled: number | null;
  openTotal: number | null;
}

export async function loadInvoiceSummary(db: Db): Promise<InvoiceSummary> {
  const res = await safeQuery<{ amount: number | null; date_stamp: string | null; created_at: string | null; payment_due_days: number | null }[]>(
    () => db.from("invoices").select("amount, date_stamp, created_at, payment_due_days").is("date_paid", null).limit(2000) as any
  );
  if (res.pending || res.error) return { pending: res.pending, dueNow: null, scheduled: null, openTotal: null };
  const now = Date.now();
  let dueNow = 0;
  let scheduled = 0;
  let openTotal = 0;
  for (const r of res.data ?? []) {
    const due = invoiceDueAt(r);
    if (!due || due.getTime() <= now) dueNow += 1;
    else scheduled += 1;
    openTotal += Number(r.amount ?? 0);
  }
  return { pending: false, dueNow, scheduled, openTotal };
}

// ------------------------------------------------------------
// Bonuses (migration 083 payment_bonus, feature-detected) — plus the
// payouts rows whose deal label says "bonus", which is what the Hub
// has today and what the old /admin/pay/bonus screen showed.
// ------------------------------------------------------------

export interface BonusRow {
  payment_bonus_id: number;
  person_id: string | null;
  instagram_username: string | null;
  amount: number | null;
  campaign_id: number | null;
  date_paid: string | null;
  date_stamp: string | null;
  created_at: string | null;
  personName: string | null;
  personPic: string | null;
  campaignName: string | null;
  brandName: string | null;
  brandLogo: string | null;
}

export interface BonusSummary {
  pending: boolean;
  unpaid: number | null;
}

export async function loadBonusSummary(db: Db): Promise<BonusSummary> {
  const { count, error } = await db
    .from("payment_bonus")
    .select("payment_bonus_id", { count: "exact", head: true })
    .is("date_paid", null);
  if (error) return { pending: isMissingSchemaError(error), unpaid: null };
  return { pending: false, unpaid: count ?? 0 };
}

export async function loadBonusRows(db: Db, show: "unpaid" | "paid" | "all"): Promise<{ pending: boolean; error: string | null; rows: BonusRow[] }> {
  let q = db.from("payment_bonus").select("payment_bonus_id, person_id, instagram_username, amount, campaign_id, date_paid, date_stamp, created_at").order("created_at", { ascending: false }).limit(300);
  if (show === "unpaid") q = q.is("date_paid", null);
  if (show === "paid") q = q.not("date_paid", "is", null);
  const res = await safeQuery<any[]>(() => q as any);
  if (res.pending || res.error) return { pending: res.pending, error: res.error, rows: [] };
  const rows = (res.data ?? []).map((r) => ({ ...r, personName: null, personPic: null, campaignName: null, brandName: null, brandLogo: null })) as BonusRow[];
  await Promise.all([attachCampaigns(db, rows), attachPeople(db, rows)]);
  return { pending: false, error: null, rows };
}

/** Name + profile picture from `people` for rows carrying a person_id. */
export async function attachPeople<T extends { person_id: string | null; personName: string | null; personPic: string | null }>(db: Db, rows: T[]): Promise<void> {
  const ids = Array.from(new Set(rows.map((r) => r.person_id).filter((v): v is string => !!v)));
  if (ids.length === 0) return;
  const res = await safeQuery<any[]>(() => db.from("people").select("id, first_name, last_name, instagram_handle, profilepicurl").in("id", ids) as any);
  if (!res.data) return;
  const byId = new Map<string, any>(res.data.map((p) => [p.id, p]));
  for (const r of rows) {
    const p = r.person_id ? byId.get(r.person_id) : undefined;
    if (!p) continue;
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    r.personName = name || (p.instagram_handle ? `@${String(p.instagram_handle).replace(/^@/, "")}` : null);
    r.personPic = p.profilepicurl ?? null;
  }
}

// ------------------------------------------------------------
// Affiliate (migration 083 affiliate_earnings / affiliate_payments)
// ------------------------------------------------------------

export interface AffiliateBalance {
  key: string;
  person_id: string | null;
  instagram_username: string | null;
  programs: string[];
  earned: number;
  paid: number;
  personName: string | null;
  personPic: string | null;
}

export interface AffiliateSummary {
  pending: boolean;
  owed: number | null;
}

async function affiliateEarningRows(db: Db) {
  return safeQuery<{ person_id: string | null; instagram_username: string | null; program: string | null; total_earnings: number | null; total_paid: number | null }[]>(
    () => db.from("affiliate_earnings").select("person_id, instagram_username, program, total_earnings, total_paid").limit(5000) as any
  );
}

export async function loadAffiliateSummary(db: Db): Promise<AffiliateSummary> {
  const res = await affiliateEarningRows(db);
  if (res.pending || res.error) return { pending: res.pending, owed: null };
  const owed = (res.data ?? []).reduce((t, r) => t + Math.max(0, Number(r.total_earnings ?? 0) - Number(r.total_paid ?? 0)), 0);
  return { pending: false, owed };
}

export async function loadAffiliateBalances(db: Db): Promise<{ pending: boolean; error: string | null; rows: AffiliateBalance[] }> {
  const res = await affiliateEarningRows(db);
  if (res.pending || res.error) return { pending: res.pending, error: res.error, rows: [] };
  const byKey = new Map<string, AffiliateBalance>();
  for (const r of res.data ?? []) {
    const key = r.person_id ?? (r.instagram_username ? `ig:${r.instagram_username.toLowerCase()}` : null);
    if (!key) continue;
    const cur = byKey.get(key) ?? {
      key,
      person_id: r.person_id ?? null,
      instagram_username: r.instagram_username ?? null,
      programs: [],
      earned: 0,
      paid: 0,
      personName: null,
      personPic: null,
    };
    cur.earned += Number(r.total_earnings ?? 0);
    cur.paid += Number(r.total_paid ?? 0);
    if (r.program && !cur.programs.includes(r.program)) cur.programs.push(r.program);
    byKey.set(key, cur);
  }
  const rows = Array.from(byKey.values()).sort((a, b) => b.earned - b.paid - (a.earned - a.paid));
  await attachPeople(db, rows);
  return { pending: false, error: null, rows };
}

export interface AffiliatePaymentRow {
  affiliate_payment_id: number;
  person_id: string | null;
  program: string | null;
  payment: number | null;
  payment_date: string | null;
  payment_method: string | null;
  requested_date: string | null;
  campaign_id: number | null;
  personName: string | null;
  personPic: string | null;
  campaignName: string | null;
  brandName: string | null;
  brandLogo: string | null;
}

export async function loadAffiliatePayments(db: Db): Promise<{ pending: boolean; error: string | null; rows: AffiliatePaymentRow[] }> {
  const res = await safeQuery<any[]>(
    () =>
      db
        .from("affiliate_payments")
        .select("affiliate_payment_id, person_id, program, payment, payment_date, payment_method, requested_date, campaign_id")
        .order("payment_date", { ascending: false, nullsFirst: false })
        .limit(300) as any
  );
  if (res.pending || res.error) return { pending: res.pending, error: res.error, rows: [] };
  const rows = (res.data ?? []).map((r) => ({ ...r, personName: null, personPic: null, campaignName: null, brandName: null, brandLogo: null })) as AffiliatePaymentRow[];
  await Promise.all([attachCampaigns(db, rows), attachPeople(db, rows)]);
  return { pending: false, error: null, rows };
}
