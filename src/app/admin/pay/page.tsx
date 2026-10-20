// ============================================================
// /admin/pay — Payments overview. Exec-only (layout).
//
// Prototype: "What's owed, what's due and what went out." — a row of
// tiles, then "Next payouts" and "Invoices due soon", plus the
// "Waiting on you" list and the most recent payouts.
//
// Every number is a query result. The payouts ledger (migration 004)
// is live; invoices / bonuses / affiliate balances come from
// migration 083 tables that are not applied yet, so those tiles show
// "—" with the reason underneath instead of a made-up figure.
//
// The old queue that lived at this URL moved to /admin/pay/athletes;
// links that still carry its ?status= filter are redirected there.
// ============================================================

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatMoney } from "@/lib/admin/db";
import { PageHeader } from "@/components/admin/ui";
import { Card, fmtShortDate } from "@/components/admin/campaign/bits";
import { AthleteCell, Btn, CampaignCell, MethodPill, Pending083, Tiles, type TileSpec } from "@/components/admin/pay/bits";
import { PAYOUT_SELECT, loadInvoices, loadPayOverview, payoutName, shapePayout, type PayoutRow } from "@/lib/admin/pay/queries";

export const dynamic = "force-dynamic";

const PENDING_083 = "Arrives with migration 083";

function dollars(n: number | null): string {
  return n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function PaymentsOverviewPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff"); // exec enforced by layout

  // Old queue links: /admin/pay?status=pending → the athletes list.
  if (searchParams.status || searchParams.page) {
    const sp = new URLSearchParams();
    const tab = searchParams.status === "paid" ? "paid" : searchParams.status === "pending" ? "approve" : "all";
    if (tab !== "approve") sp.set("tab", tab);
    if (searchParams.page) sp.set("page", searchParams.page);
    const s = sp.toString();
    redirect(s ? `/admin/pay/athletes?${s}` : "/admin/pay/athletes");
  }

  const supabase = createServiceSupabase();
  const nowIso = new Date().toISOString();

  const [ov, nextRes, recentRes, dueInvoices] = await Promise.all([
    loadPayOverview(supabase),
    supabase
      .from("payouts")
      .select(PAYOUT_SELECT)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true, nullsFirst: true })
      .limit(5),
    supabase.from("payouts").select(PAYOUT_SELECT).eq("status", "paid").order("paid_at", { ascending: false }).limit(5),
    loadInvoices(supabase, "asap"),
  ]);

  const next: PayoutRow[] = (nextRes.data ?? []).map(shapePayout);
  const recent: PayoutRow[] = (recentRes.data ?? []).map(shapePayout);
  const dueSoon = dueInvoices.rows.slice(0, 5);
  const amountOf = (r: PayoutRow) => (r.amount_cents != null ? formatMoney(r.amount_cents) : (r.amount_label ?? "—"));

  const tiles: TileSpec[] = [
    {
      n: ov.pendingPayouts == null ? "—" : ov.pendingPayouts.toLocaleString(),
      label: "Payout requests pending",
      href: "/admin/pay/athletes",
      flag: (ov.pendingPayouts ?? 0) > 0,
    },
    {
      n: ov.invoices.dueNow == null ? "—" : ov.invoices.dueNow.toLocaleString(),
      label: "Invoices due now",
      sub: ov.invoices.pending ? PENDING_083 : undefined,
      href: "/admin/pay/invoices",
      flag: (ov.invoices.dueNow ?? 0) > 0,
    },
    {
      n: ov.invoices.scheduled == null ? "—" : ov.invoices.scheduled.toLocaleString(),
      label: "Invoices scheduled",
      sub: ov.invoices.pending ? PENDING_083 : undefined,
      href: "/admin/pay/invoices?tab=scheduled",
    },
    {
      n: dollars(ov.invoices.openTotal),
      label: "Open invoice total",
      sub: ov.invoices.pending ? PENDING_083 : undefined,
      href: "/admin/pay/invoices",
    },
    {
      n:
        ov.bonuses.unpaid == null && ov.pendingBonusPayouts == null
          ? "—"
          : ((ov.bonuses.unpaid ?? 0) + (ov.pendingBonusPayouts ?? 0)).toLocaleString(),
      label: "Unpaid bonuses",
      sub: ov.bonuses.pending ? "Bonus-labeled payouts only until migration 083" : undefined,
      href: "/admin/pay/bonus-affiliate",
    },
    {
      n: dollars(ov.affiliate.owed),
      label: "Affiliate balance owed",
      sub: ov.affiliate.pending ? PENDING_083 : undefined,
      href: "/admin/pay/bonus-affiliate?tab=affiliate",
    },
    {
      n: ov.paid30Cents == null ? "—" : formatMoney(ov.paid30Cents),
      label: "Paid in last 30 days",
      sub:
        ov.paid30Count == null
          ? undefined
          : `${ov.paid30Count.toLocaleString()} payout${ov.paid30Count === 1 ? "" : "s"}${ov.paid30Unpriced ? ` · ${ov.paid30Unpriced} without a dollar figure` : ""}`,
      href: "/admin/pay/history",
    },
  ];

  const waiting: { label: string; detail: string; value: string; href: string }[] = [
    {
      label: "Payouts to approve",
      detail: "Pay athletes (app)",
      value: ov.pendingPayouts == null ? "—" : ov.pendingPayouts.toLocaleString(),
      href: "/admin/pay/athletes",
    },
    {
      label: "Invoices due now",
      detail: ov.invoices.pending ? PENDING_083 : "Invoices",
      value: ov.invoices.dueNow == null ? "—" : ov.invoices.dueNow.toLocaleString(),
      href: "/admin/pay/invoices",
    },
    {
      label: "Bonuses to pay",
      detail: ov.bonuses.pending ? "Bonus-labeled payouts" : "Bonuses & affiliate",
      value:
        ov.bonuses.unpaid == null && ov.pendingBonusPayouts == null
          ? "—"
          : ((ov.bonuses.unpaid ?? 0) + (ov.pendingBonusPayouts ?? 0)).toLocaleString(),
      href: "/admin/pay/bonus-affiliate",
    },
    {
      label: "Affiliate balances owed",
      detail: ov.affiliate.pending ? PENDING_083 : "Affiliate balances",
      value: dollars(ov.affiliate.owed),
      href: "/admin/pay/bonus-affiliate?tab=affiliate",
    },
  ];

  const payoutList = (rows: PayoutRow[], when: "scheduled" | "paid", empty: string) =>
    rows.length === 0 ? (
      <div className="px-4 py-8 text-center text-[13px] text-stone-500">{empty}</div>
    ) : (
      <ul className="divide-y divide-stone-100">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
            <div className="min-w-0 flex-1">
              <AthleteCell name={payoutName(r)} handle={r.profiles?.ig_handle} pic={r.profiles?.avatar_url} href={`/admin/pay/${r.id}`} />
            </div>
            <div className="hidden min-w-0 flex-1 sm:block">
              <CampaignCell title={r.campaign?.title ?? null} brandName={r.campaign?.brandName ?? null} brandLogo={r.campaign?.brandLogo ?? null} />
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[13px] font-semibold tabular-nums text-stone-900">{amountOf(r)}</div>
              <div className="flex items-center justify-end gap-1.5 text-[11px] text-stone-500">
                <MethodPill method={r.provider} />
                <span>{when === "paid" ? `paid ${fmtShortDate(r.paid_at)}` : `due ${fmtShortDate(r.scheduled_for)}`}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <PageHeader title="Payments overview" subtitle="What's owed, what's due and what went out." />

      <Tiles items={tiles} />

      <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <Card title="Waiting on you" pad={false}>
          <div>
            {waiting.map((w) => (
              <a
                key={w.label}
                href={w.href}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-stone-100 px-4 py-2.5 first:border-t-0 hover:bg-stone-50 md:px-5"
              >
                <span className="text-[13px] font-medium text-stone-900">{w.label}</span>
                <span className="row-span-2 text-xl font-semibold tabular-nums text-stone-900">{w.value}</span>
                <span className="text-[12px] text-stone-500">{w.detail}</span>
              </a>
            ))}
          </div>
        </Card>

        <Card title="Next payouts" sub="Pending, soonest pay date first" actions={<Btn href="/admin/pay/athletes">Open</Btn>} pad={false}>
          {payoutList(next, "scheduled", "No pending payouts in the Hub ledger.")}
        </Card>

        <Card title="Invoices due soon" actions={<Btn href="/admin/pay/invoices">Open</Btn>} pad={false}>
          {dueInvoices.pending ? (
            <Pending083 feature="Invoices" />
          ) : dueInvoices.error ? (
            <div className="px-4 py-6 text-[13px] text-status-bad">{dueInvoices.error}</div>
          ) : dueSoon.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-stone-500">No invoices are due right now.</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {dueSoon.map((inv) => {
                const overdue = inv.dueAt ? inv.dueAt.getTime() < Date.now() - 24 * 60 * 60 * 1000 : false;
                return (
                  <li key={inv.invoice_id} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-stone-900">{inv.name ?? "—"}</div>
                      <div className="truncate text-[12px] text-stone-500">
                        {inv.payee_type ? inv.payee_type[0].toUpperCase() + inv.payee_type.slice(1) : "Payee"}
                        {inv.campaignName ? ` · ${inv.campaignName}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[13px] font-semibold tabular-nums text-stone-900">{dollars(inv.amount)}</div>
                      <div className={"text-[11px] " + (overdue ? "font-medium text-status-bad" : "text-stone-500")}>
                        {overdue ? "Overdue" : "Due"} {fmtShortDate(inv.dueAt?.toISOString())}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent payouts" sub="Marked paid most recently" actions={<Btn href="/admin/pay/history">History</Btn>} pad={false}>
          {payoutList(recent, "paid", "Nothing has been marked paid in the Hub ledger yet.")}
        </Card>
      </div>

      <p className="pt-4 text-[12px] text-stone-500">
        CF&apos;s historical payments, affiliate ledgers and bonus list stay in the CF database until they are imported — the Hub shows only its own
        rows here. Checked at {new Date(nowIso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.
      </p>
    </div>
  );
}
