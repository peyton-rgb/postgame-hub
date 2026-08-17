// ============================================================
// /admin/pay/1099 — 1099 Report (pay_1099.cfm rebuilt). Exec-only.
//
// CF rendered raw SSNs in a 998-row list. This screen NEVER renders
// an SSN — and in fact cannot: SSNs were never migrated into the
// Hub database. The SSN column shows the masked placeholder with
// the honest storage status. W-9 state comes from profiles
// (w9_status / w9_year); paid totals from the payouts ledger,
// grouped per athlete for the selected tax year ($600 threshold
// highlighted). Export button produces a CSV of exactly what this
// screen shows — nothing more.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatMoney } from "@/lib/admin/db";
import { PageHeader, Masked } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

const THRESHOLD_CENTS = 60000;

export default async function Report1099Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();

  const now = new Date();
  const year = /^\d{4}$/.test(searchParams.year ?? "")
    ? parseInt(searchParams.year!, 10)
    : now.getFullYear();

  const { data: paid } = await supabase
    .from("payouts")
    .select("athlete_id, amount_cents, paid_at, profiles!athlete_id(full_name, email, w9_status, w9_year)")
    .eq("status", "paid")
    .gte("paid_at", `${year}-01-01`)
    .lt("paid_at", `${year + 1}-01-01`);

  interface Grouped {
    athleteId: string;
    name: string;
    email: string | null;
    w9Status: string | null;
    w9Year: number | null;
    totalCents: number;
    payments: number;
  }
  const byAthlete = new Map<string, Grouped>();
  for (const p of (paid ?? []) as unknown as {
    athlete_id: string | null;
    amount_cents: number | null;
    profiles: { full_name: string | null; email: string | null; w9_status: string | null; w9_year: number | null } | null;
  }[]) {
    if (!p.athlete_id) continue;
    const cur = byAthlete.get(p.athlete_id) ?? {
      athleteId: p.athlete_id,
      name: p.profiles?.full_name ?? p.profiles?.email ?? "Unknown",
      email: p.profiles?.email ?? null,
      w9Status: p.profiles?.w9_status ?? null,
      w9Year: p.profiles?.w9_year ?? null,
      totalCents: 0,
      payments: 0,
    };
    cur.totalCents += p.amount_cents ?? 0;
    cur.payments += 1;
    byAthlete.set(p.athlete_id, cur);
  }
  const rows = Array.from(byAthlete.values()).sort((a, b) => b.totalCents - a.totalCents);

  return (
    <div>
      <PageHeader
        title={`1099 Report · ${year}`}
        subtitle="Paid totals per athlete from the Hub ledger · SSNs are NOT stored in the Hub database and never render here"
        actions={
          <a
            href={`/admin/pay/1099/export?year=${year}`}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
          >
            Export CSV (no PII)
          </a>
        }
      />

      <div className="flex gap-1 pb-4">
        {[year - 1, year, year + 1 <= now.getFullYear() ? year + 1 : null]
          .filter((y): y is number => y != null)
          .map((y) => (
            <Link
              key={y}
              href={`/admin/pay/1099?year=${y}`}
              className={
                "rounded-md px-3 py-1.5 text-[13px] font-medium " +
                (y === year ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
              }
            >
              {y}
            </Link>
          ))}
      </div>

      <AdminTable<(typeof rows)[number]>
        rows={rows}
        rowKey={(r) => r.athleteId}
        rowWarn={(r) => r.totalCents >= THRESHOLD_CENTS && r.w9Status !== "approved"}
        emptyLabel={`No paid payouts recorded in ${year}. CF's historical 1099 data stays in the CF database.`}
        columns={[
          {
            key: "name",
            header: "Athlete",
            render: (r) => <span className="font-medium text-stone-900">{r.name}</span>,
          },
          { key: "email", header: "Email", secondary: true, render: (r) => r.email ?? "—" },
          {
            key: "ssn",
            header: "SSN",
            render: () => (
              <span title="SSNs are not stored in the Hub database. A W-9 vault would be its own exec-gated migration.">
                <Masked />
                <span className="ml-1.5 text-[11px] text-stone-400">not stored</span>
              </span>
            ),
          },
          {
            key: "w9",
            header: "W-9",
            render: (r) => (
              <span className="capitalize text-stone-600">
                {r.w9Status ?? "—"}
                {r.w9Year ? ` (${r.w9Year})` : ""}
              </span>
            ),
          },
          { key: "count", header: "Payments", align: "right", render: (r) => r.payments },
          {
            key: "total",
            header: `Paid in ${year}`,
            align: "right",
            render: (r) => (
              <span className={r.totalCents >= THRESHOLD_CENTS ? "font-semibold" : ""}>
                {formatMoney(r.totalCents)}
                {r.totalCents >= THRESHOLD_CENTS && (
                  <span className="ml-1.5 rounded bg-orange-100 px-1.5 py-0.5 text-[11px] font-medium text-[#B33407]">
                    1099
                  </span>
                )}
              </span>
            ),
          },
        ]}
        mobile={{
          title: (r) => r.name,
          subtitle: (r) => `${r.payments} payments · W-9 ${r.w9Status ?? "—"}`,
          figure: (r) => formatMoney(r.totalCents),
        }}
      />
    </div>
  );
}
