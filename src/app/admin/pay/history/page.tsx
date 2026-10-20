// ============================================================
// /admin/pay/history — History & 1099. Exec-only (layout).
//
// Prototype S["pay-history"] / S["pay-1099"]: "Payment history", one
// card with two bookmarkable tabs.
//   (default)  Paid — everything that has gone out: paid payouts (live)
//              plus paid invoices, bonuses and affiliate payouts
//              (migration 083, feature-detected). ?type= ?range= ?q=
//   ?tab=1099  1099 report — paid totals per athlete for ?year=,
//              $600 threshold flagged. Moved from /admin/pay/1099
//              (which redirects here; its CSV route stays put).
//
// SENSITIVE: tax numbers are never stored in the Hub and never render.
// The tax-number column uses the Masked helper only.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatMoney } from "@/lib/admin/db";
import { PageHeader, Masked } from "@/components/admin/ui";
import { Card, Pill } from "@/components/admin/campaign/bits";
import {
  AthleteCell,
  Btn,
  CardTabs,
  MobileRow,
  PayTable,
  SourceNotes,
  Toolbar,
  TypePill,
  dollarsFmt,
} from "@/components/admin/pay/bits";
import { HISTORY_RANGES, LEDGER_TYPES, filterLedger, loadHistory, type HistoryRange, type LedgerItem } from "@/lib/admin/pay/ledger";

export const dynamic = "force-dynamic";

const THRESHOLD_CENTS = 60000;
const BASE = "/admin/pay/history";

interface Row1099 {
  athleteId: string;
  name: string;
  email: string | null;
  pic: string | null;
  w9Status: string | null;
  w9Year: number | null;
  totalCents: number;
  payments: number;
}

export default async function PaymentHistoryPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();

  const tab = searchParams.tab === "1099" ? "1099" : "paid";
  const now = new Date();
  const year = /^\d{4}$/.test(searchParams.year ?? "") ? parseInt(searchParams.year!, 10) : now.getFullYear();

  const tabs = (
    <CardTabs
      active={tab}
      tabs={[
        { key: "paid", label: "Paid", href: BASE },
        { key: "1099", label: "1099 report", href: `${BASE}?tab=1099` },
      ]}
    />
  );

  // ---------------- 1099 ----------------
  if (tab === "1099") {
    const { data: paid, error } = await supabase
      .from("payouts")
      .select("athlete_id, amount_cents, paid_at, profiles!athlete_id(full_name, email, avatar_url, w9_status, w9_year)")
      .eq("status", "paid")
      .gte("paid_at", `${year}-01-01`)
      .lt("paid_at", `${year + 1}-01-01`);

    const byAthlete = new Map<string, Row1099>();
    for (const p of (paid ?? []) as any[]) {
      if (!p.athlete_id) continue;
      const prof = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const cur = byAthlete.get(p.athlete_id) ?? {
        athleteId: p.athlete_id,
        name: prof?.full_name ?? prof?.email ?? "Unknown",
        email: prof?.email ?? null,
        pic: prof?.avatar_url ?? null,
        w9Status: prof?.w9_status ?? null,
        w9Year: prof?.w9_year ?? null,
        totalCents: 0,
        payments: 0,
      };
      cur.totalCents += p.amount_cents ?? 0;
      cur.payments += 1;
      byAthlete.set(p.athlete_id, cur);
    }
    const rows = Array.from(byAthlete.values()).sort((a, b) => b.totalCents - a.totalCents);
    const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
    const w9 = (r: Row1099) =>
      r.w9Status === "approved" ? <Pill tone="ok">On file{r.w9Year ? ` (${r.w9Year})` : ""}</Pill> : <Pill tone="warn">{r.w9Status ? r.w9Status[0].toUpperCase() + r.w9Status.slice(1) : "Missing"}</Pill>;

    return (
      <div>
        <PageHeader
          title="Payment history"
          subtitle="Everything that's gone out, and the yearly 1099 list."
          actions={
            <>
              <form action={BASE} method="get" className="flex items-center gap-1.5">
                <input type="hidden" name="tab" value="1099" />
                <select name="year" defaultValue={String(year)} aria-label="Year" className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-900">
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[12px] font-medium text-stone-700 hover:border-stone-400">
                  Show
                </button>
              </form>
              <Btn href={`/admin/pay/1099/export?year=${year}`} external>
                Export CSV
              </Btn>
            </>
          }
        />
        <Card pad={false}>
          {tabs}
          <div className="border-b border-stone-200 px-4 py-2.5 text-[12px] text-stone-500 md:px-5">
            Payees paid $600 or more in {year}, for tax forms. Totals come from the Hub payout ledger.
          </div>
          {error ? (
            <div className="px-4 py-6 text-[13px] text-status-bad">{error.message}</div>
          ) : (
            <PayTable<Row1099>
              rows={rows}
              rowKey={(r) => r.athleteId}
              emptyLabel={`No paid payouts recorded in ${year}. CF's historical 1099 data stays in the CF database.`}
              columns={[
                { key: "who", header: "Payee", render: (r) => <AthleteCell name={r.name} pic={r.pic} /> },
                { key: "type", header: "Type", secondary: true, render: () => <span className="text-stone-600">Athlete</span> },
                { key: "count", header: "Payments", align: "right", render: (r) => r.payments },
                {
                  key: "total",
                  header: "Total paid",
                  align: "right",
                  render: (r) => (
                    <span className={r.totalCents >= THRESHOLD_CENTS ? "font-semibold text-stone-900" : "text-stone-700"}>
                      {formatMoney(r.totalCents)}
                      {r.totalCents >= THRESHOLD_CENTS && <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-[#B33407]">1099</span>}
                    </span>
                  ),
                },
                { key: "w9", header: "W-9", render: w9 },
                {
                  key: "tin",
                  header: "Tax number",
                  secondary: true,
                  render: () => (
                    <span title="Tax numbers are not stored in the Hub database.">
                      <Masked />
                    </span>
                  ),
                },
              ]}
              mobile={(r) => (
                <MobileRow
                  top={<AthleteCell name={r.name} pic={r.pic} />}
                  figure={formatMoney(r.totalCents)}
                  strip={
                    <>
                      {w9(r)}
                      <span>
                        {r.payments} payment{r.payments === 1 ? "" : "s"}
                      </span>
                      {r.totalCents >= THRESHOLD_CENTS && <span className="font-medium text-[#B33407]">1099</span>}
                    </>
                  }
                />
              )}
            />
          )}
          <div className="border-t border-stone-200 px-4 py-2.5 text-[12px] text-stone-500 md:px-5">
            Tax numbers are never stored in the Hub and never shown — the column is masked on purpose. Invoices and videographer totals join this list with migration 083.
          </div>
        </Card>
      </div>
    );
  }

  // ---------------- Paid ----------------
  const range: HistoryRange = HISTORY_RANGES.some((r) => r.key === searchParams.range) ? (searchParams.range as HistoryRange) : "30";
  const type = LEDGER_TYPES.some((t) => t.toLowerCase() === searchParams.type) ? searchParams.type! : "all";
  const q = (searchParams.q ?? "").slice(0, 80);

  const hist = await loadHistory(supabase, range);
  const rows = filterLedger(hist.items, type, q);
  const total = rows.reduce((t, i) => t + (i.amount ?? 0), 0);
  const amountOf = (i: LedgerItem) => (i.amount != null ? dollarsFmt(i.amount, i.amount % 1 !== 0) : (i.amountLabel ?? "—"));

  return (
    <div>
      <PageHeader
        title="Payment history"
        subtitle="Everything that's gone out, and the yearly 1099 list."
        actions={
          <Btn href="/admin/pay/export?scope=all" external>
            Export CSV
          </Btn>
        }
      />
      <Card pad={false}>
        {tabs}
        <Toolbar
          action={BASE}
          search={{ name: "q", value: q, placeholder: "Search name or campaign" }}
          selects={[
            { name: "type", value: type, ariaLabel: "Type", options: [{ value: "all", label: "All types" }, ...LEDGER_TYPES.map((t) => ({ value: t.toLowerCase(), label: t + "s" }))] },
            { name: "range", value: range, ariaLabel: "Date range", options: HISTORY_RANGES.map((r) => ({ value: r.key, label: r.label })) },
          ]}
          right={<span className="text-[12px] text-stone-500 tabular-nums">{rows.length.toLocaleString()} paid · {dollarsFmt(total)}</span>}
        />
        <PayTable<LedgerItem>
          rows={rows}
          rowKey={(i) => i.key}
          emptyLabel={q || type !== "all" ? "Nothing paid matches that." : "Nothing has been marked paid in this period."}
          columns={[
            { key: "type", header: "Type", render: (i) => <TypePill type={i.type} /> },
            { key: "who", header: "Paid to", render: (i) => <AthleteCell name={i.who} pic={i.pic} href={i.payoutId ? `/admin/pay/${i.payoutId}` : undefined} /> },
            { key: "for", header: "For", render: (i) => <span className="text-stone-500">{i.what}</span> },
            { key: "paid", header: "Paid", secondary: true, render: (i) => <span className="text-stone-600">{i.when}</span> },
            { key: "amount", header: "Amount", align: "right", render: (i) => <span className="text-stone-900">{amountOf(i)}</span> },
          ]}
          mobile={(i) => (
            <MobileRow
              top={<AthleteCell name={i.who} pic={i.pic} href={i.payoutId ? `/admin/pay/${i.payoutId}` : undefined} />}
              figure={amountOf(i)}
              strip={
                <>
                  <TypePill type={i.type} />
                  <span>{i.when}</span>
                  <span className="truncate">{i.what}</span>
                </>
              }
            />
          )}
        />
        <SourceNotes sources={hist.sources} />
      </Card>
      <p className="pt-3 text-[12px] text-stone-500">
        CF&apos;s historical payments stay in the CF database until they are imported. Payout requests still waiting are on the{" "}
        <Link href="/admin/pay" className="text-[#D73F09] hover:underline">
          overview
        </Link>
        .
      </p>
    </div>
  );
}
