// ============================================================
// /admin/pay/bonus — Bonus Payments (bonus_payments.cfm rebuilt).
// Exec-only (layout).
//
// CF's bonus ledger (553 rows) lives in the CF database. The Hub's
// real equivalent is `payouts` rows whose deal label marks a bonus —
// shown here honestly (filtered ilike '%bonus%'), which today is a
// small set. CF's GET-link "Paid"/"Delete" actions are replaced by
// the confirmed-POST actions on the main Pay queue.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatDate, formatMoney } from "@/lib/admin/db";
import { PageHeader } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

export default async function BonusPaymentsPage() {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();

  const { data } = await supabase
    .from("payouts")
    .select(
      "id, amount_cents, amount_label, status, paid_at, created_at, profiles!athlete_id(full_name, email, ig_handle)"
    )
    .ilike("amount_label", "%bonus%")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as {
    id: string;
    amount_cents: number | null;
    amount_label: string | null;
    status: string | null;
    paid_at: string | null;
    profiles: { full_name: string | null; email: string | null; ig_handle: string | null } | null;
  }[];

  return (
    <div>
      <PageHeader
        title="Bonus Payments"
        subtitle="Hub payout rows whose deal label includes a bonus · CF's 553-row bonus ledger stays in the CF database (import decision in the morning report)"
      />
      <div className="mb-4 text-[13px] text-stone-600">
        Mark-paid / deny / remove actions live on{" "}
        <Link href="/admin/pay" className="text-[#D73F09] hover:underline">
          the Pay queue
        </Link>{" "}
        — one write path for all money movement.
      </div>
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No bonus-labeled payout rows in the Hub yet."
        columns={[
          {
            key: "athlete",
            header: "Athlete",
            render: (r) => (
              <NameLink href={`/admin/pay/${r.id}`}>
                {r.profiles?.full_name ?? r.profiles?.email ?? "Unknown"}
              </NameLink>
            ),
          },
          {
            key: "ig",
            header: "IG",
            render: (r) =>
              r.profiles?.ig_handle ? `@${r.profiles.ig_handle.replace(/^@/, "")}` : "—",
          },
          { key: "label", header: "Deal label", render: (r) => r.amount_label ?? "—" },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            render: (r) => (r.amount_cents != null ? formatMoney(r.amount_cents) : "—"),
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
          subtitle: (r) => r.amount_label ?? "",
          figure: (r) => (r.amount_cents != null ? formatMoney(r.amount_cents) : (r.status ?? "")),
        }}
      />
    </div>
  );
}
