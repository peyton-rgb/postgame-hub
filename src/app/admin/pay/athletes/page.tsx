// ============================================================
// /admin/pay/athletes — Pay athletes (app). Exec-only (layout).
//
// The old /admin/pay queue (pay.cfm rebuilt), restyled to the
// prototype's "Pay athletes (app)" card: tabs To approve / Scheduled
// / Paid / All, a search + method toolbar, and one row per payout
// with avatar, campaign + brand mark, method, requested date, amount,
// status pill and the confirmed-POST actions.
//
// Source is unchanged: `payouts` (the Hub's real payout ledger, one
// row per verified deal) joined to profiles for the athlete and to
// optin_campaigns → brands for the campaign title and logo. The
// bank-rail queue that used to live at /admin/pay/ach is the
// "ACH / Wire / Zelle" method filter here. CF's historical payments
// stay in the CF database and are not shown.
//
// "Approve" is the same write as the old "Mark paid": it stamps
// paid_at and logs to the audit trail. It does not move money —
// PayPal execution stays manual.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatMoney, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import { Card, fmtShortDate } from "@/components/admin/campaign/bits";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import {
  AthleteCell,
  Btn,
  CampaignCell,
  CardTabs,
  MethodPill,
  MobileRow,
  PayCard,
  PayTable,
  ResultNote,
  StatusPill,
  Toolbar,
  methodLabel,
} from "@/components/admin/pay/bits";
import {
  METHOD_FILTERS,
  PAYOUT_SELECT,
  PAYOUT_TABS,
  applyMethod,
  applyPayoutTab,
  payoutName,
  payoutTabCounts,
  shapePayout,
  type MethodFilter,
  type PayoutRow,
  type PayoutTab,
} from "@/lib/admin/pay/queries";
import { markPayoutPaid, denyPayout, removePayout } from "../actions";

export const dynamic = "force-dynamic";

const RESULT_NOTES: Record<string, { tone: "ok" | "warn" | "err"; text: string }> = {
  saved: { tone: "ok", text: "Done — logged to the audit trail." },
  error: { tone: "err", text: "Action failed — nothing was changed." },
  "exec-only": { tone: "err", text: "That action is exec-only. Nothing was changed." },
  "not-found": { tone: "err", text: "That payout no longer exists — nothing was changed." },
};

export default async function PayAthletesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();

  const tab: PayoutTab = (PAYOUT_TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab : "approve") as PayoutTab;
  const method: MethodFilter = (METHOD_FILTERS.some((m) => m.key === searchParams.method) ? searchParams.method : "all") as MethodFilter;
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const nowIso = new Date().toISOString();
  const note = searchParams.result ? RESULT_NOTES[searchParams.result] : undefined;
  const view = getListView("pay-athletes", searchParams);

  // Search matches the athlete (name / handle / email). It needs an inner
  // join so rows whose profile doesn't match drop out of the page.
  const select = q ? PAYOUT_SELECT.replace("profiles!athlete_id(", "profiles!athlete_id!inner(") : PAYOUT_SELECT;
  const apply = (query: any) => {
    query = applyMethod(applyPayoutTab(query, tab, nowIso), method);
    if (q) query = query.or(`full_name.ilike.%${q}%,ig_handle.ilike.%${q}%,email.ilike.%${q}%`, { referencedTable: "profiles" });
    return query;
  };

  const { from, to } = pageRange(page);
  const orderCol = tab === "paid" ? "paid_at" : tab === "scheduled" ? "scheduled_for" : "created_at";
  const [list, filtered, counts] = await Promise.all([
    apply(supabase.from("payouts").select(select))
      .order(orderCol, { ascending: tab === "scheduled", nullsFirst: false })
      .range(from, to),
    apply(
      supabase
        .from("payouts")
        .select(q ? "id, profiles!athlete_id!inner(id)" : "id", { count: "exact", head: true })
    ),
    payoutTabCounts(supabase, nowIso, method),
  ]);

  const header = (
    <PageHeader
      title="Pay athletes (app)"
      subtitle="Payout requests from the athlete app, one per verified deal. Approving records it as paid — the money itself still goes out by hand."
      actions={
        <>
          <Btn href="/admin/pay/export?scope=paypal-venmo" external>
            CSV: PayPal / Venmo
          </Btn>
          <Btn href="/admin/pay/export?scope=balances" external>
            CSV: Balances
          </Btn>
        </>
      }
    />
  );

  if (list.error || filtered.error) {
    return (
      <div>
        {header}
        <ErrorNote message={(list.error ?? filtered.error)?.message ?? "Query failed"} />
      </div>
    );
  }

  const rows: PayoutRow[] = (list.data ?? []).map(shapePayout);
  const total = filtered.count ?? 0;
  const params = { tab, method: method === "all" ? undefined : method, q: q || undefined };
  const amountOf = (r: PayoutRow) => (r.amount_cents != null ? formatMoney(r.amount_cents) : (r.amount_label ?? "—"));
  const returnFields = (
    <>
      <input type="hidden" name="return_tab" value={tab} />
      {method !== "all" && <input type="hidden" name="return_method" value={method} />}
      {q && <input type="hidden" name="return_q" value={q} />}
      {page > 1 && <input type="hidden" name="return_page" value={String(page)} />}
    </>
  );

  const actionsFor = (r: PayoutRow) =>
    r.status === "pending" ? (
      <>
        <form action={markPayoutPaid}>
          <input type="hidden" name="id" value={r.id} />
          {returnFields}
          <ConfirmSubmit
            summary={`Approve the ${amountOf(r)} payout to ${payoutName(r)} and mark it PAID? This stamps paid_at now and is written to the audit log. It does not move money — ${methodLabel(r.provider)} execution stays manual.`}
            confirmLabel="Approve"
          >
            Approve
          </ConfirmSubmit>
        </form>
        <form action={denyPayout}>
          <input type="hidden" name="id" value={r.id} />
          {returnFields}
          <ConfirmSubmit
            variant="quiet"
            summary={`Deny the ${amountOf(r)} payout to ${payoutName(r)}? Status becomes 'denied' (kept in the ledger) and the action is logged.`}
            confirmLabel="Deny"
          >
            Deny
          </ConfirmSubmit>
        </form>
        <form action={removePayout}>
          <input type="hidden" name="id" value={r.id} />
          {returnFields}
          <ConfirmSubmit
            variant="danger"
            summary={`Remove the ${amountOf(r)} payout to ${payoutName(r)} from the queue? The row is kept with status 'removed' — money rows are never hard-deleted.`}
            confirmLabel="Remove"
          >
            Remove
          </ConfirmSubmit>
        </form>
      </>
    ) : null;

  const tabHref = (key: PayoutTab) => {
    const sp = new URLSearchParams();
    if (key !== "approve") sp.set("tab", key);
    if (method !== "all") sp.set("method", method);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `/admin/pay/athletes?${s}` : "/admin/pay/athletes";
  };

  return (
    <div>
      {header}
      {note && <ResultNote tone={note.tone}>{note.text}</ResultNote>}

      <Card pad={false}>
        <CardTabs
          active={tab}
          tabs={PAYOUT_TABS.map((t) => ({ key: t.key, label: t.label, href: tabHref(t.key), count: counts[t.key], showCount: true }))}
        />
        <Toolbar
          action="/admin/pay/athletes"
          hidden={{ tab: tab === "approve" ? undefined : tab }}
          search={{ name: "q", value: q, placeholder: "Search athlete, handle or email" }}
          selects={[{ name: "method", value: method, ariaLabel: "Payment method", options: METHOD_FILTERS.map((m) => ({ value: m.key, label: m.label })) }]}
          right={
            <>
              <ViewToggle listKey="pay-athletes" view={view} />
              <Btn href="/admin/pay/bonus-affiliate">Pay bonus</Btn>
              <Btn href="/admin/pay/export?scope=all" external>
                CSV: All payments
              </Btn>
            </>
          }
        />

        <PayTable<PayoutRow>
          rows={rows}
          rowKey={(r) => r.id}
          view={view}
          card={(r) => (
            <PayCard
              top={<AthleteCell name={payoutName(r)} handle={r.profiles?.ig_handle} pic={r.profiles?.avatar_url} href={`/admin/pay/${r.id}`} />}
              figure={amountOf(r)}
              strip={
                <>
                  <StatusPill status={r.status} />
                  <MethodPill method={r.provider} />
                  <span>
                    {tab === "paid" ? "Paid" : tab === "scheduled" ? "Pay date" : "Requested"}{" "}
                    {fmtShortDate(tab === "paid" ? r.paid_at : tab === "scheduled" ? r.scheduled_for : r.created_at)}
                  </span>
                </>
              }
              details={[
                {
                  label: "Campaign",
                  value: (
                    <CampaignCell title={r.campaign?.title ?? null} brandName={r.campaign?.brandName ?? null} brandLogo={r.campaign?.brandLogo ?? null} />
                  ),
                },
              ]}
              actions={actionsFor(r)}
            />
          )}
          emptyLabel={
            q || method !== "all"
              ? "No payouts match that search."
              : tab === "approve"
                ? "Nothing to approve — no pending payouts have reached their pay date."
                : tab === "scheduled"
                  ? "No payouts are scheduled for a future date."
                  : tab === "paid"
                    ? "No payouts have been marked paid in the Hub ledger."
                    : "No payout rows in the Hub ledger yet."
          }
          columns={[
            {
              key: "athlete",
              header: "Athlete",
              render: (r) => (
                <AthleteCell name={payoutName(r)} handle={r.profiles?.ig_handle} pic={r.profiles?.avatar_url} href={`/admin/pay/${r.id}`} />
              ),
            },
            {
              key: "campaign",
              header: "Campaign",
              render: (r) => (
                <CampaignCell title={r.campaign?.title ?? null} brandName={r.campaign?.brandName ?? null} brandLogo={r.campaign?.brandLogo ?? null} />
              ),
            },
            { key: "method", header: "Method", render: (r) => <MethodPill method={r.provider} /> },
            {
              key: "when",
              header: tab === "paid" ? "Paid" : tab === "scheduled" ? "Pay date" : "Requested",
              secondary: true,
              render: (r) => (
                <span className="text-stone-600">
                  {fmtShortDate(tab === "paid" ? r.paid_at : tab === "scheduled" ? r.scheduled_for : r.created_at)}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              render: (r) => (
                <span className={r.amount_cents != null ? "font-semibold text-stone-900" : "text-stone-500"} title={r.amount_cents == null ? "No dollar figure set yet — this is the deal's payout label" : undefined}>
                  {amountOf(r)}
                </span>
              ),
            },
            { key: "status", header: "Status", render: (r) => <StatusPill status={r.status} /> },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (r) => <span className="inline-flex flex-wrap justify-end gap-1.5">{actionsFor(r)}</span>,
            },
          ]}
          mobile={(r) => (
            <MobileRow
              top={<AthleteCell name={payoutName(r)} handle={r.profiles?.ig_handle} pic={r.profiles?.avatar_url} href={`/admin/pay/${r.id}`} />}
              figure={amountOf(r)}
              strip={
                <>
                  <StatusPill status={r.status} />
                  <MethodPill method={r.provider} />
                  <span className="truncate">
                    {r.campaign?.title ?? "—"}
                    {r.campaign?.brandName ? ` · ${r.campaign.brandName}` : ""}
                  </span>
                </>
              }
              actions={actionsFor(r)}
            />
          )}
        />
      </Card>

      <Paginator page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/pay/athletes" params={params} />
    </div>
  );
}
