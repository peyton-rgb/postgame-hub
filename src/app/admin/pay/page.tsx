// ============================================================
// /admin/pay — Payments overview. Exec-only (layout).
//
// Prototype S.pay ("To pay"): everyone Postgame owes money to, in one
// list — tiles (athlete payouts, invoices due now / scheduled,
// bonuses, affiliate balances, total owed), then one card with an
// All / Payouts / Invoices / Bonuses / Affiliate switch and a search.
//
// Every number is a query result (src/lib/admin/pay/ledger.ts).
// Pending payouts come from the live `payouts` ledger; invoices,
// bonuses and affiliate balances are migration 083 tables (unapplied),
// so they show "—" with the reason instead of a made-up figure.
//
// Row actions are the existing confirmed-POST writes (payout approve,
// invoice / bonus mark paid) with return_to=/admin/pay so the user
// lands back here. Affiliate balances have no pay action yet — they
// open the affiliate tab.
//
// Old queue links (/admin/pay?status=…) still redirect to the
// athletes list.
// ============================================================

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader } from "@/components/admin/ui";
import { Card } from "@/components/admin/campaign/bits";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import {
  AthleteCell,
  Btn,
  MobileRow,
  PAY_RESULT_NOTES,
  PayCard,
  PayTable,
  ResultNote,
  SegLinks,
  SourceNotes,
  Tiles,
  TypePill,
  dollarsFmt,
  type TileSpec,
} from "@/components/admin/pay/bits";
import { filterLedger, loadOwed, type LedgerItem } from "@/lib/admin/pay/ledger";
import { markBonusPaid, markInvoicePaid, markPayoutPaid } from "./actions";

export const dynamic = "force-dynamic";

const TYPES = [
  { key: "all", label: "All" },
  { key: "payout", label: "Payouts" },
  { key: "invoice", label: "Invoices" },
  { key: "bonus", label: "Bonuses" },
  { key: "affiliate", label: "Affiliate" },
];

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

  const type = TYPES.some((t) => t.key === searchParams.type) ? searchParams.type! : "all";
  const q = (searchParams.q ?? "").slice(0, 80);
  const note = searchParams.result ? PAY_RESULT_NOTES[searchParams.result] : undefined;
  const view = getListView("pay", searchParams);

  const owed = await loadOwed(createServiceSupabase());
  const rows = filterLedger(owed.items, type, q);
  const pend = owed.sources;
  const p083 = "Arrives with migration 083";

  const tiles: TileSpec[] = [
    { n: owed.counts.payouts == null ? "—" : owed.counts.payouts.toLocaleString(), label: "Athlete payouts", href: "/admin/pay/athletes", flag: (owed.counts.payouts ?? 0) > 0 },
    { n: owed.counts.invoicesDue == null ? "—" : owed.counts.invoicesDue.toLocaleString(), label: "Invoices due now", sub: pend.Invoice.pending ? p083 : undefined, href: "/admin/pay/invoices", flag: (owed.counts.invoicesDue ?? 0) > 0 },
    { n: owed.counts.invoicesScheduled == null ? "—" : owed.counts.invoicesScheduled.toLocaleString(), label: "Invoices scheduled", sub: pend.Invoice.pending ? p083 : undefined, href: "/admin/pay/invoices?tab=scheduled" },
    { n: owed.counts.bonuses == null ? "—" : owed.counts.bonuses.toLocaleString(), label: "Bonuses", sub: pend.Bonus.pending ? "Bonus-labeled payouts only until 083" : undefined, href: "/admin/pay/bonus-affiliate" },
    { n: dollarsFmt(owed.affiliateOwed), label: "Affiliate balances", sub: pend.Affiliate.pending ? p083 : undefined, href: "/admin/pay/bonus-affiliate?tab=affiliate" },
    {
      n: dollarsFmt(owed.totalOwed),
      label: "Total owed",
      sub: [owed.unpriced ? `${owed.unpriced} without a dollar figure` : "", pend.Invoice.pending ? "Hub payouts only" : ""].filter(Boolean).join(" · ") || undefined,
    },
  ];

  const href = (t: string) => {
    const sp = new URLSearchParams();
    if (t !== "all") sp.set("type", t);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `/admin/pay?${s}` : "/admin/pay";
  };

  const ret = (
    <>
      <input type="hidden" name="return_to" value="/admin/pay" />
      {type !== "all" && <input type="hidden" name="return_type" value={type} />}
      {q && <input type="hidden" name="return_q" value={q} />}
    </>
  );

  const amountOf = (i: LedgerItem) => (i.amount != null ? dollarsFmt(i.amount, i.amount % 1 !== 0) : (i.amountLabel ?? "—"));

  const action = (i: LedgerItem) => {
    if (i.payoutId) {
      return (
        <form action={markPayoutPaid}>
          <input type="hidden" name="id" value={i.payoutId} />
          {ret}
          <ConfirmSubmit
            summary={`Mark the ${amountOf(i)} ${i.type.toLowerCase()} to ${i.who} as PAID? This stamps paid_at now and is written to the audit log. It does not move money — send it by hand first.`}
            confirmLabel="Mark paid"
          >
            {i.type === "Bonus" ? "Pay bonus" : "Mark paid"}
          </ConfirmSubmit>
        </form>
      );
    }
    if (i.invoiceId != null) {
      return (
        <form action={markInvoicePaid}>
          <input type="hidden" name="invoice_id" value={i.invoiceId} />
          {ret}
          <ConfirmSubmit summary={`Mark the ${amountOf(i)} invoice from ${i.who} as paid? Only do this once the money has gone out. Logged to the audit trail.`} confirmLabel="Mark paid">
            Mark paid
          </ConfirmSubmit>
        </form>
      );
    }
    if (i.bonusId != null) {
      return (
        <form action={markBonusPaid}>
          <input type="hidden" name="payment_bonus_id" value={i.bonusId} />
          {ret}
          <ConfirmSubmit summary={`Mark the ${amountOf(i)} bonus to ${i.who} as paid? Only do this once the money has gone out. Logged to the audit trail.`} confirmLabel="Mark paid">
            Pay bonus
          </ConfirmSubmit>
        </form>
      );
    }
    return <Btn href="/admin/pay/bonus-affiliate?tab=affiliate">Open balance</Btn>;
  };

  return (
    <div>
      <PageHeader
        title="Payments overview"
        subtitle="Everyone Postgame owes money to, in one list."
        actions={<Btn href="/admin/pay/invoices?tab=submit">+ Submit invoice</Btn>}
      />
      {note && <ResultNote tone={note.tone}>{note.text}</ResultNote>}

      <Tiles items={tiles} />

      <Card pad={false} className="mt-3.5">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 px-3 py-2.5 md:px-4">
          <SegLinks active={type} items={TYPES.map((t) => ({ key: t.key, label: t.label, href: href(t.key) }))} />
          <form action="/admin/pay" method="get" className="flex min-w-0 flex-1 items-center gap-2 md:ml-auto md:max-w-xs md:flex-none">
            {type !== "all" && <input type="hidden" name="type" value={type} />}
            {searchParams.view && <input type="hidden" name="view" value={view} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name or campaign"
              aria-label="Search name or campaign"
              className="w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-900"
            />
          </form>
          <ViewToggle listKey="pay" view={view} />
        </div>

        <PayTable<LedgerItem>
          rows={rows}
          rowKey={(i) => i.key}
          view={view}
          card={(i) => (
            <PayCard
              top={<AthleteCell name={i.who} pic={i.pic} href={i.payoutId ? `/admin/pay/${i.payoutId}` : undefined} />}
              figure={amountOf(i)}
              strip={
                <>
                  <TypePill type={i.type} />
                  <span className={i.late ? "font-medium text-status-bad" : ""}>{i.when}</span>
                </>
              }
              details={[{ label: "For", value: i.what || "—" }]}
              actions={action(i)}
            />
          )}
          emptyLabel={q || type !== "all" ? "Nothing owed matches that." : "Nothing is owed right now."}
          columns={[
            { key: "type", header: "Type", render: (i) => <TypePill type={i.type} /> },
            { key: "who", header: "Who", render: (i) => <AthleteCell name={i.who} pic={i.pic} href={i.payoutId ? `/admin/pay/${i.payoutId}` : undefined} /> },
            { key: "for", header: "For", render: (i) => <span className="text-stone-500">{i.what}</span> },
            {
              key: "when",
              header: "When",
              secondary: true,
              render: (i) =>
                i.late ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-status-bad">{i.when}</span>
                ) : (
                  <span className="text-stone-600">{i.when}</span>
                ),
            },
            { key: "amount", header: "Amount", align: "right", render: (i) => <span className="font-semibold text-stone-900">{amountOf(i)}</span> },
            { key: "act", header: "", align: "right", render: (i) => <span className="inline-flex justify-end">{action(i)}</span> },
          ]}
          mobile={(i) => (
            <MobileRow
              top={<AthleteCell name={i.who} pic={i.pic} href={i.payoutId ? `/admin/pay/${i.payoutId}` : undefined} />}
              figure={amountOf(i)}
              strip={
                <>
                  <TypePill type={i.type} />
                  <span className={i.late ? "font-medium text-status-bad" : ""}>{i.when}</span>
                  <span className="truncate">{i.what}</span>
                </>
              }
              actions={action(i)}
            />
          )}
        />
        <SourceNotes sources={owed.sources} />
      </Card>

      <p className="pt-3 text-[12px] text-stone-500">
        Marking something paid only records it — the money still goes out by hand. Everything that has gone out is in{" "}
        <Link href="/admin/pay/history" className="text-[#D73F09] hover:underline">
          History &amp; 1099
        </Link>
        .
      </p>
    </div>
  );
}
