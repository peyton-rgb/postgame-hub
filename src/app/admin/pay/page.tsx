// ============================================================
// /admin/pay — Pay Athletes (pay.cfm rebuilt). Exec-only (layout).
//
// Source: payouts (the Hub's real payout ledger — created when
// deals verify) joined to profiles for the athlete identity.
// CF's 3,000-row unpaginated queue becomes 50/page server-side.
//
// Every money action: confirmed POST with an explicit summary
// ("Mark $X to NAME as paid?"), audit-logged. The CF payment
// history lives in the CF database, not the Hub — this queue shows
// only real Hub payout rows, honestly.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, formatMoney, pageRange } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { markPayoutPaid, denyPayout, removePayout } from "./actions";

export const dynamic = "force-dynamic";

interface PayoutRow {
  id: string;
  athlete_id: string | null;
  amount_cents: number | null;
  amount_label: string | null;
  status: string | null;
  provider: string | null;
  paypal_email: string | null;
  scheduled_for: string | null;
  paid_at: string | null;
  created_at: string | null;
  profiles: { full_name: string | null; email: string | null; ig_handle: string | null } | null;
}

const STATUS_FILTERS = ["pending", "paid", "denied", "removed"] as const;

export default async function PayAthletesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const status = (STATUS_FILTERS as readonly string[]).includes(searchParams.status ?? "")
    ? searchParams.status
    : undefined;

  function apply(query: any) {
    if (status) query = query.eq("status", status);
    return query;
  }

  const { from, to } = pageRange(page);
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    apply(
      supabase
        .from("payouts")
        .select(
          "id, athlete_id, amount_cents, amount_label, status, provider, paypal_email, scheduled_for, paid_at, created_at, profiles!athlete_id(full_name, email, ig_handle)"
        )
    )
      .order("created_at", { ascending: false })
      .range(from, to),
    apply(supabase.from("payouts").select("id", { count: "exact", head: true })),
  ]);

  if (error || countError) {
    return (
      <div>
        <PageHeader title="Pay Athletes" />
        <ErrorNote message={(error ?? countError)?.message ?? "Query failed"} />
      </div>
    );
  }
  const rows = (data ?? []) as unknown as PayoutRow[];

  const nameOf = (r: PayoutRow) => r.profiles?.full_name ?? r.profiles?.email ?? "Unknown athlete";
  const amountOf = (r: PayoutRow) =>
    r.amount_cents != null ? formatMoney(r.amount_cents) : (r.amount_label ?? "—");

  const result = searchParams.result;

  return (
    <div>
      <PageHeader
        title="Pay Athletes"
        subtitle={`${(count ?? 0).toLocaleString()} payout rows in the Hub ledger · CF's historical payments live in the CF database and are not shown here`}
        actions={
          <span className="flex flex-wrap gap-1.5">
            <a
              href="/admin/pay/export?scope=paypal-venmo"
              className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[12px] font-medium text-stone-700 hover:border-stone-400"
            >
              CSV: PP/Venmo
            </a>
            <a
              href="/admin/pay/export?scope=all"
              className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[12px] font-medium text-stone-700 hover:border-stone-400"
            >
              CSV: All payments
            </a>
            <a
              href="/admin/pay/export?scope=balances"
              className="rounded-md border border-stone-300 px-2.5 py-1.5 text-[12px] font-medium text-stone-700 hover:border-stone-400"
            >
              CSV: Balances
            </a>
          </span>
        }
      />

      {result === "saved" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Done — logged to the audit trail.
        </div>
      )}
      {result === "error" && <ErrorNote message="Action failed — nothing was changed." />}
      {result === "exec-only" && (
        <ErrorNote message="That action is exec-only. Nothing was changed." />
      )}

      <div className="flex gap-1 pb-4">
        <a
          href="/admin/pay"
          className={
            "rounded-md px-3 py-1.5 text-[13px] font-medium " +
            (!status ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
          }
        >
          All
        </a>
        {STATUS_FILTERS.map((s) => (
          <a
            key={s}
            href={`/admin/pay?status=${s}`}
            className={
              "rounded-md px-3 py-1.5 text-[13px] font-medium capitalize " +
              (status === s ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
            }
          >
            {s}
          </a>
        ))}
      </div>

      <AdminTable<PayoutRow>
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No payout rows with this status."
        columns={[
          {
            key: "id",
            header: "ID",
            render: (r) => <span className="text-stone-500">{r.id.slice(0, 8)}</span>,
          },
          {
            key: "athlete",
            header: "Athlete",
            render: (r) => <NameLink href={`/admin/pay/${r.id}`}>{nameOf(r)}</NameLink>,
          },
          {
            key: "amount",
            header: "Amount",
            align: "right",
            render: (r) => <span className="font-medium">{amountOf(r)}</span>,
          },
          {
            key: "method",
            header: "Method",
            secondary: true,
            render: (r) => <span className="capitalize">{r.provider ?? "—"}</span>,
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <span
                className={
                  "capitalize " +
                  (r.status === "paid"
                    ? "text-green-700"
                    : r.status === "pending"
                      ? "text-amber-700"
                      : "text-stone-500")
                }
              >
                {r.status ?? "—"}
              </span>
            ),
          },
          {
            key: "scheduled",
            header: "Scheduled",
            secondary: true,
            render: (r) => formatDate(r.scheduled_for),
          },
          { key: "paid", header: "Paid", secondary: true, render: (r) => formatDate(r.paid_at) },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (r) =>
              r.status === "pending" ? (
                <span className="inline-flex gap-1.5">
                  <form action={markPayoutPaid}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmSubmit
                      summary={`Mark ${amountOf(r)} to ${nameOf(r)} as PAID? This stamps paid_at now and is written to the audit log. It does not move money — PayPal execution stays manual.`}
                      confirmLabel="Mark paid"
                    >
                      Mark paid
                    </ConfirmSubmit>
                  </form>
                  <form action={denyPayout}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmSubmit
                      variant="quiet"
                      summary={`Deny the ${amountOf(r)} payout to ${nameOf(r)}? Status becomes 'denied' (kept in the ledger) and the action is logged.`}
                      confirmLabel="Deny"
                    >
                      Deny
                    </ConfirmSubmit>
                  </form>
                  <form action={removePayout}>
                    <input type="hidden" name="id" value={r.id} />
                    <ConfirmSubmit
                      variant="danger"
                      summary={`Remove the ${amountOf(r)} payout to ${nameOf(r)} from the queue? The row is kept with status 'removed' — money rows are never hard-deleted.`}
                      confirmLabel="Remove"
                    >
                      Remove
                    </ConfirmSubmit>
                  </form>
                </span>
              ) : null,
          },
        ]}
        mobile={{
          title: (r) => nameOf(r),
          href: (r) => `/admin/pay/${r.id}`,
          subtitle: (r) => `${r.status ?? ""} · ${r.provider ?? ""}`,
          figure: (r) => amountOf(r),
        }}
      />

      <Paginator
        page={page}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/pay"
        params={{ status }}
      />
    </div>
  );
}
