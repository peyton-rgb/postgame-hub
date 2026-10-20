// ============================================================
// Pay suite — the two cross-source lists from the prototype's
// simplified Payments section:
//
//   loadOwed()    — "To pay": everyone Postgame owes money to, in one
//                   list (pending payouts, open invoices, unpaid
//                   bonuses, affiliate balances).
//   loadHistory() — "Payment history": everything that has gone out.
//
// Read-only. `payouts` is live; invoices / payment_bonus /
// affiliate_* are migration 083 (unapplied) and are read through the
// feature-detecting loaders in ./queries, so each source reports
// `pending` instead of failing. Amounts are dollars (number) here;
// payouts carry cents in the ledger and are converted.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { safeQuery } from "@/lib/admin/db";
import {
  PAYOUT_SELECT,
  loadAffiliateBalances,
  loadAffiliatePayments,
  loadBonusRows,
  loadInvoices,
  payoutName,
  shapePayout,
  type PayoutRow,
} from "./queries";

type Db = SupabaseClient<any, "public", any>;

export type LedgerType = "Payout" | "Invoice" | "Bonus" | "Affiliate";
export const LEDGER_TYPES: LedgerType[] = ["Payout", "Invoice", "Bonus", "Affiliate"];

export interface LedgerItem {
  key: string;
  type: LedgerType;
  who: string;
  pic: string | null;
  /** what the money is for — campaign · brand, deal label, program */
  what: string;
  /** "Requested Oct 15", "Due today", "Overdue 3 days", "Balance owed" */
  when: string;
  late: boolean;
  /** dollars; null when the row has no dollar figure */
  amount: number | null;
  /** shown instead of the amount when there's no dollar figure */
  amountLabel: string | null;
  /** sort key (ms) — oldest first for owed, newest first for history */
  at: number;
  /** raw ids so the page can attach the right action */
  payoutId?: string;
  invoiceId?: number;
  bonusId?: number;
}

export interface SourceState {
  pending: boolean;
  error: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function relDay(d: Date, now: Date): string {
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((a - b) / DAY);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  return shortDate(d);
}

function ts(v: string | null | undefined): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function campaignWhat(title: string | null | undefined, brand: string | null | undefined): string {
  return [title, brand].filter(Boolean).join(" · ") || "—";
}

function payoutItem(r: PayoutRow, now: Date, mode: "owed" | "history"): LedgerItem {
  const isBonus = /bonus/i.test(r.amount_label ?? "");
  let when: string;
  let at: number;
  if (mode === "history") {
    at = ts(r.paid_at);
    when = r.paid_at ? shortDate(new Date(r.paid_at)) : "—";
  } else if (r.scheduled_for && ts(r.scheduled_for) > now.getTime()) {
    at = ts(r.scheduled_for);
    when = `Scheduled ${shortDate(new Date(r.scheduled_for))}`;
  } else {
    at = ts(r.created_at);
    when = r.created_at ? `Requested ${relDay(new Date(r.created_at), now)}` : "Requested";
  }
  return {
    key: `p-${r.id}`,
    type: isBonus ? "Bonus" : "Payout",
    who: payoutName(r),
    pic: r.profiles?.avatar_url ?? null,
    what: campaignWhat(r.campaign?.title, r.campaign?.brandName) + (isBonus && r.amount_label ? ` · ${r.amount_label}` : ""),
    when,
    late: false,
    amount: r.amount_cents != null ? r.amount_cents / 100 : null,
    amountLabel: r.amount_cents == null ? r.amount_label : null,
    at,
    payoutId: r.id,
  };
}

// ------------------------------------------------------------
// To pay
// ------------------------------------------------------------

export interface OwedResult {
  items: LedgerItem[];
  sources: Record<LedgerType, SourceState>;
  counts: { payouts: number | null; invoicesDue: number | null; invoicesScheduled: number | null; bonuses: number | null };
  affiliateOwed: number | null;
  /** sum of every priced owed item, dollars */
  totalOwed: number;
  /** pending payouts with no dollar figure — left out of totalOwed */
  unpriced: number;
}

export async function loadOwed(db: Db): Promise<OwedResult> {
  const now = new Date();
  const [payRes, asap, scheduled, bonuses, balances] = await Promise.all([
    db.from("payouts").select(PAYOUT_SELECT).eq("status", "pending").order("created_at", { ascending: true }).limit(500),
    loadInvoices(db, "asap"),
    loadInvoices(db, "scheduled"),
    loadBonusRows(db, "unpaid"),
    loadAffiliateBalances(db),
  ]);

  const items: LedgerItem[] = [];

  const payouts = payRes.error ? [] : (payRes.data ?? []).map(shapePayout);
  for (const r of payouts) items.push(payoutItem(r, now, "owed"));

  for (const inv of [...asap.rows, ...scheduled.rows]) {
    const due = inv.dueAt;
    let when = "Due —";
    let late = false;
    if (due) {
      const days = Math.floor((now.getTime() - due.getTime()) / DAY);
      if (days >= 1) {
        late = true;
        when = `Overdue ${days} day${days === 1 ? "" : "s"}`;
      } else {
        when = `Due ${relDay(due, now)}`;
      }
    }
    items.push({
      key: `i-${inv.invoice_id}`,
      type: "Invoice",
      who: inv.name ?? "—",
      pic: null,
      what: campaignWhat(inv.campaignName, inv.brandName) === "—" ? (inv.payee_type ?? "—") : campaignWhat(inv.campaignName, inv.brandName),
      when,
      late,
      amount: inv.amount != null ? Number(inv.amount) : null,
      amountLabel: null,
      at: due?.getTime() ?? 0,
      invoiceId: inv.invoice_id,
    });
  }

  for (const b of bonuses.rows) {
    items.push({
      key: `b-${b.payment_bonus_id}`,
      type: "Bonus",
      who: b.personName ?? (b.instagram_username ? `@${b.instagram_username.replace(/^@/, "")}` : "—"),
      pic: b.personPic,
      what: campaignWhat(b.campaignName, b.brandName),
      when: b.date_stamp || b.created_at ? `Added ${shortDate(new Date((b.date_stamp ?? b.created_at)!))}` : "Unpaid",
      late: false,
      amount: b.amount != null ? Number(b.amount) : null,
      amountLabel: null,
      at: ts(b.date_stamp ?? b.created_at),
      bonusId: b.payment_bonus_id,
    });
  }

  let affiliateOwed: number | null = null;
  if (!balances.pending && !balances.error) {
    affiliateOwed = 0;
    for (const a of balances.rows) {
      const owed = a.earned - a.paid;
      if (owed <= 0) continue;
      affiliateOwed += owed;
      items.push({
        key: `a-${a.key}`,
        type: "Affiliate",
        who: a.personName ?? (a.instagram_username ? `@${a.instagram_username.replace(/^@/, "")}` : "—"),
        pic: a.personPic,
        what: a.programs.length ? `${a.programs.join(", ")} affiliate balance` : "Affiliate balance",
        when: "Balance owed",
        late: false,
        amount: owed,
        amountLabel: null,
        at: 0,
      });
    }
  }

  // Overdue first, then by date (soonest / oldest first).
  items.sort((a, b) => Number(b.late) - Number(a.late) || a.at - b.at);

  const payoutCount = payRes.error ? null : payouts.filter((p) => !/bonus/i.test(p.amount_label ?? "")).length;
  const bonusPayouts = payRes.error ? 0 : payouts.length - (payoutCount ?? 0);

  return {
    items,
    sources: {
      Payout: { pending: false, error: payRes.error?.message ?? null },
      Invoice: { pending: asap.pending, error: asap.error },
      Bonus: { pending: bonuses.pending, error: bonuses.error },
      Affiliate: { pending: balances.pending, error: balances.error },
    },
    counts: {
      payouts: payoutCount,
      invoicesDue: asap.pending || asap.error ? null : asap.rows.length,
      invoicesScheduled: scheduled.pending || scheduled.error ? null : scheduled.rows.length,
      bonuses: bonuses.pending || bonuses.error ? (payRes.error ? null : bonusPayouts) : bonuses.rows.length + bonusPayouts,
    },
    affiliateOwed,
    totalOwed: items.reduce((t, i) => t + (i.amount ?? 0), 0),
    unpriced: items.filter((i) => i.amount == null).length,
  };
}

// ------------------------------------------------------------
// Payment history
// ------------------------------------------------------------

export type HistoryRange = "30" | "90" | "365" | "all";
export const HISTORY_RANGES: { key: HistoryRange; label: string }[] = [
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "365", label: "Last 12 months" },
  { key: "all", label: "All time" },
];

export interface HistoryResult {
  items: LedgerItem[];
  sources: Record<LedgerType, SourceState>;
}

export async function loadHistory(db: Db, range: HistoryRange): Promise<HistoryResult> {
  const now = new Date();
  const since = range === "all" ? null : new Date(now.getTime() - Number(range) * DAY).toISOString();

  let payQ = db.from("payouts").select(PAYOUT_SELECT).eq("status", "paid").order("paid_at", { ascending: false }).limit(1000);
  if (since) payQ = payQ.gte("paid_at", since);

  const [payRes, invoices, bonuses, affiliate] = await Promise.all([
    payQ,
    loadInvoices(db, "paid"),
    loadBonusRows(db, "paid"),
    loadAffiliatePayments(db),
  ]);

  const cutoff = since ? ts(since) : 0;
  const inRange = (t: number) => !since || t >= cutoff;
  const items: LedgerItem[] = [];

  for (const r of (payRes.error ? [] : (payRes.data ?? [])).map(shapePayout)) items.push(payoutItem(r, now, "history"));

  for (const inv of invoices.rows) {
    const at = ts(inv.date_paid);
    if (!inRange(at)) continue;
    items.push({
      key: `i-${inv.invoice_id}`,
      type: "Invoice",
      who: inv.name ?? "—",
      pic: null,
      what: campaignWhat(inv.campaignName, inv.brandName),
      when: inv.date_paid ? shortDate(new Date(inv.date_paid)) : "—",
      late: false,
      amount: inv.amount != null ? Number(inv.amount) : null,
      amountLabel: null,
      at,
      invoiceId: inv.invoice_id,
    });
  }

  for (const b of bonuses.rows) {
    const at = ts(b.date_paid);
    if (!inRange(at)) continue;
    items.push({
      key: `b-${b.payment_bonus_id}`,
      type: "Bonus",
      who: b.personName ?? (b.instagram_username ? `@${b.instagram_username.replace(/^@/, "")}` : "—"),
      pic: b.personPic,
      what: campaignWhat(b.campaignName, b.brandName),
      when: b.date_paid ? shortDate(new Date(b.date_paid)) : "—",
      late: false,
      amount: b.amount != null ? Number(b.amount) : null,
      amountLabel: null,
      at,
      bonusId: b.payment_bonus_id,
    });
  }

  for (const a of affiliate.rows) {
    const at = ts(a.payment_date);
    if (!inRange(at)) continue;
    items.push({
      key: `a-${a.affiliate_payment_id}`,
      type: "Affiliate",
      who: a.personName ?? "—",
      pic: a.personPic,
      what: a.program ? `${a.program} affiliate` : campaignWhat(a.campaignName, a.brandName),
      when: a.payment_date ? shortDate(new Date(a.payment_date)) : "—",
      late: false,
      amount: a.payment != null ? Number(a.payment) : null,
      amountLabel: null,
      at,
    });
  }

  items.sort((a, b) => b.at - a.at);
  return {
    items,
    sources: {
      Payout: { pending: false, error: payRes.error?.message ?? null },
      Invoice: { pending: invoices.pending, error: invoices.error },
      Bonus: { pending: bonuses.pending, error: bonuses.error },
      Affiliate: { pending: affiliate.pending, error: affiliate.error },
    },
  };
}

/** Case-insensitive search across who / what. */
export function filterLedger(items: LedgerItem[], type: string, q: string): LedgerItem[] {
  const needle = q.trim().toLowerCase();
  return items.filter(
    (i) =>
      (type === "all" || i.type.toLowerCase() === type) &&
      (!needle || i.who.toLowerCase().includes(needle) || i.what.toLowerCase().includes(needle))
  );
}

/** Campaign choices for the invoice form — the blended `campaigns` table (083). */
export async function loadCampaignChoices(db: Db): Promise<{ pending: boolean; rows: { id: number; label: string }[] }> {
  const res = await safeQuery<any[]>(
    () => db.from("campaigns").select("campaign_id, campaign_name, brands!brand_id(name)").order("campaign_name").limit(1000) as any
  );
  if (!res.data) return { pending: true, rows: [] };
  return {
    pending: false,
    rows: res.data
      .filter((c) => c.campaign_id != null)
      .map((c) => {
        const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
        return { id: Number(c.campaign_id), label: [brand?.name, c.campaign_name].filter(Boolean).join(" – ") || `#${c.campaign_id}` };
      }),
  };
}
