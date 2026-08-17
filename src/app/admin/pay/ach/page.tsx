// ============================================================
// /admin/pay/ach — ACH / Wire / Zelle queue + history
// (pay_ach.cfm + pay_ach_history.cfm rebuilt). Exec-only (layout).
//
// Source: payouts filtered to provider in (ach, wire, zelle).
// Queue = pending · History = paid/denied/removed. Invoices need
// an invoices table that doesn't exist in the Hub — honest note,
// no fake invoice UI. Actions reuse the ONE confirmed-POST write
// path on the Pay queue.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatDate, formatMoney } from "@/lib/admin/db";
import { PageHeader } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

export default async function AchWireZellePage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();
  const tab = searchParams.tab === "history" ? "history" : "queue";

  let query = supabase
    .from("payouts")
    .select(
      "id, amount_cents, amount_label, status, provider, paid_at, created_at, profiles!athlete_id(full_name, email)"
    )
    .in("provider", ["ach", "wire", "zelle"])
    .order("created_at", { ascending: false })
    .limit(200);
  query = tab === "queue" ? query.eq("status", "pending") : query.neq("status", "pending");
  const { data } = await query;

  const rows = (data ?? []) as unknown as {
    id: string;
    amount_cents: number | null;
    amount_label: string | null;
    status: string | null;
    provider: string | null;
    paid_at: string | null;
    profiles: { full_name: string | null; email: string | null } | null;
  }[];

  return (
    <div>
      <PageHeader
        title="ACH / Wire / Zelle"
        subtitle="Bank-rail payouts from the Hub ledger · CF's 74-row queue + 1,518-row history stay in the CF database (import decision in the morning report)"
      />

      <div className="flex gap-1 pb-4">
        <Link
          href="/admin/pay/ach"
          className={
            "rounded-md px-3 py-1.5 text-[13px] font-medium " +
            (tab === "queue" ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
          }
        >
          Queue
        </Link>
        <Link
          href="/admin/pay/ach?tab=history"
          className={
            "rounded-md px-3 py-1.5 text-[13px] font-medium " +
            (tab === "history" ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
          }
        >
          History
        </Link>
      </div>

      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel={
          tab === "queue"
            ? "No pending ACH/Wire/Zelle payouts in the Hub ledger."
            : "No settled ACH/Wire/Zelle payouts in the Hub ledger."
        }
        columns={[
          {
            key: "athlete",
            header: "Payee",
            render: (r) => (
              <NameLink href={`/admin/pay/${r.id}`}>
                {r.profiles?.full_name ?? r.profiles?.email ?? "Unknown"}
              </NameLink>
            ),
          },
          {
            key: "provider",
            header: "Rail",
            render: (r) => <span className="uppercase text-stone-600">{r.provider}</span>,
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            render: (r) => (r.amount_cents != null ? formatMoney(r.amount_cents) : (r.amount_label ?? "—")),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <span className="capitalize">{r.status ?? "—"}</span>,
          },
          { key: "paid", header: "Paid", render: (r) => formatDate(r.paid_at) },
        ]}
        mobile={{
          title: (r) => r.profiles?.full_name ?? r.profiles?.email ?? "Unknown",
          href: (r) => `/admin/pay/${r.id}`,
          subtitle: (r) => `${(r.provider ?? "").toUpperCase()} · ${r.status ?? ""}`,
          figure: (r) => (r.amount_cents != null ? formatMoney(r.amount_cents) : ""),
        }}
      />

      <p className="pt-4 text-[12px] text-stone-500">
        Invoices: the Hub has no invoices table yet — invoice detail screens land with that
        migration (morning-report decision), not as placeholders here.
      </p>
    </div>
  );
}
