// ============================================================
// /admin/pay/invoices — Invoices. Exec-only (layout).
//
// Prototype S.invoices (= "Pay invoices (Bill)" retitled, with a
// "Submit invoice" button) and S["submit-invoices"] for the form:
//   ?tab=asap (default) · scheduled · paid — the list
//   ?tab=submit                            — log a new invoice
//
// Source: the `invoices` table from migration 083 (unapplied). Every
// read goes through the feature-detecting loaders, so until 083 lands
// the list shows the honest pending note and submitting reports
// "pending083" instead of failing. Bank account, routing and tax
// numbers are never collected — the table has no columns for them.
//
// Replaces /admin/pay/vendor (which redirects to ?tab=submit).
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import { Card, fmtShortDate } from "@/components/admin/campaign/bits";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import {
  Btn,
  CampaignCell,
  CardTabs,
  MethodPill,
  MobileRow,
  PAY_RESULT_NOTES,
  PayCard,
  PayTable,
  Pending083,
  ResultNote,
  Toolbar,
  dollarsFmt,
} from "@/components/admin/pay/bits";
import { loadInvoices, loadInvoiceSummary, type InvoiceRow } from "@/lib/admin/pay/queries";
import { loadCampaignChoices } from "@/lib/admin/pay/ledger";
import { markInvoicePaid, submitInvoice } from "../actions";

export const dynamic = "force-dynamic";

type Tab = "asap" | "scheduled" | "paid" | "submit";
const TABS: Tab[] = ["asap", "scheduled", "paid", "submit"];
const PAYEE_TYPES = [
  { value: "athlete", label: "Athlete" },
  { value: "agency", label: "Agency" },
  { value: "videographer", label: "Videographer" },
  { value: "other", label: "Other" },
];

function termsLabel(days: number | null): string {
  const d = Math.round(Number(days ?? 0));
  return d <= 0 ? "Pay ASAP" : `Net ${d}`;
}

function cap(s: string | null): string {
  return s ? s[0].toUpperCase() + s.slice(1) : "Payee";
}

export default async function InvoicesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();

  const tab: Tab = (TABS as string[]).includes(searchParams.tab ?? "") ? (searchParams.tab as Tab) : "asap";
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const payee = PAYEE_TYPES.some((p) => p.value === searchParams.payee) ? searchParams.payee! : "all";
  const note = searchParams.result ? PAY_RESULT_NOTES[searchParams.result] : undefined;
  const view = getListView("pay-invoices", searchParams);

  const [summary, list, campaigns] = await Promise.all([
    loadInvoiceSummary(supabase),
    tab === "submit" ? Promise.resolve(null) : loadInvoices(supabase, tab),
    tab === "submit" ? loadCampaignChoices(supabase) : Promise.resolve(null),
  ]);

  const tabHref = (t: Tab) => (t === "asap" ? "/admin/pay/invoices" : `/admin/pay/invoices?tab=${t}`);

  const header = (
    <PageHeader
      title="Invoices"
      subtitle="Invoices to pay now and on a schedule. Mark paid once the money has gone out."
      actions={
        tab === "submit" ? undefined : (
          <Btn href="/admin/pay/invoices?tab=submit" primary>
            + Submit invoice
          </Btn>
        )
      }
    />
  );

  const tabs = (
    <CardTabs
      active={tab}
      tabs={[
        { key: "asap", label: "Pay ASAP", href: tabHref("asap"), count: summary.dueNow, showCount: true },
        { key: "scheduled", label: "Scheduled", href: tabHref("scheduled"), count: summary.scheduled, showCount: true },
        { key: "paid", label: "Paid", href: tabHref("paid") },
        { key: "submit", label: "Submit invoice", href: tabHref("submit") },
      ]}
    />
  );

  if (tab === "submit") {
    const field = "w-full rounded-md border border-stone-300 bg-white px-2.5 py-2 text-[13px] text-stone-900";
    const label = "mb-1 block text-[12px] font-medium text-stone-600";
    return (
      <div>
        {header}
        {note && <ResultNote tone={note.tone}>{note.text}</ResultNote>}
        <Card pad={false}>
          {tabs}
          {summary.pending && (
            <div className="border-b border-stone-200 bg-amber-50 px-4 py-2.5 text-[12px] text-status-warn md:px-5">
              The invoices table arrives with migration 083 (written, not applied). The form works, but a submit will report that and save nothing until then.
            </div>
          )}
          <form action={submitInvoice} className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2 md:px-5">
            <fieldset className="md:col-span-2">
              <legend className={label}>Payee type</legend>
              <div className="inline-flex max-w-full flex-wrap rounded-lg border border-stone-200 bg-stone-50 p-0.5">
                {PAYEE_TYPES.map((p, i) => (
                  <label key={p.value} className="cursor-pointer">
                    <input type="radio" name="payee_type" value={p.value} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="block rounded-md px-3 py-1 text-[12px] font-medium text-stone-500 peer-checked:bg-white peer-checked:text-stone-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[#D73F09]">
                      {p.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="inv-name" className={label}>Payee</label>
              <input id="inv-name" name="recipient_name" required className={field} placeholder="Name of the person or company" />
            </div>
            <div>
              <label htmlFor="inv-camp" className={label}>Campaign</label>
              {campaigns && campaigns.rows.length > 0 ? (
                <select id="inv-camp" name="campaign_id" className={field} defaultValue="">
                  <option value="">Choose a campaign</option>
                  {campaigns.rows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              ) : (
                <select id="inv-camp" name="campaign_id" className={field + " text-stone-400"} disabled title="The campaign list arrives with migration 083">
                  <option>Campaign list arrives with migration 083</option>
                </select>
              )}
            </div>
            <div>
              <label htmlFor="inv-amt" className={label}>Amount ($)</label>
              <input id="inv-amt" name="amount" required inputMode="decimal" className={field} placeholder="$0" />
            </div>
            <div>
              <label htmlFor="inv-method" className={label}>Payment method</label>
              <select id="inv-method" name="method" className={field} defaultValue="ach">
                <option value="ach">ACH</option>
                <option value="paypal">PayPal</option>
                <option value="venmo">Venmo</option>
                <option value="zelle">Zelle</option>
                <option value="wire">Wire</option>
                <option value="check">Check</option>
              </select>
            </div>
            <div>
              <label htmlFor="inv-terms" className={label}>Terms</label>
              <select id="inv-terms" name="terms" className={field} defaultValue="asap">
                <option value="asap">Pay ASAP</option>
                <option value="net30">Net 30</option>
                <option value="net45">Net 45</option>
              </select>
            </div>
            <div>
              <label htmlFor="inv-num" className={label}>Invoice number</label>
              <input id="inv-num" name="invoice_number" className={field} />
            </div>
            <div>
              <label htmlFor="inv-handle" className={label}>Payment handle (PayPal / Venmo / Zelle)</label>
              <input id="inv-handle" name="handle" className={field} />
            </div>
            <div>
              <label htmlFor="inv-ig" className={label}>Instagram (if athlete)</label>
              <input id="inv-ig" name="ig_username" className={field} placeholder="@handle" />
            </div>
            <div>
              <label htmlFor="inv-email" className={label}>Email</label>
              <input id="inv-email" name="recipient_email" type="email" className={field} />
            </div>
            <div>
              <label htmlFor="inv-phone" className={label}>Phone</label>
              <input id="inv-phone" name="recipient_phone" className={field} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="inv-notes" className={label}>Notes</label>
              <textarea id="inv-notes" name="notes" rows={3} className={field} />
            </div>
            <div className="rounded-lg border border-dashed border-stone-300 px-4 py-3 text-[12px] text-stone-500 md:col-span-2">
              Bank account, routing and tax numbers are never collected here. Attaching the invoice PDF comes with the invoice file storage — not wired yet.
            </div>
            <div className="flex justify-end md:col-span-2">
              <button type="submit" className="rounded-md bg-[#D73F09] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#B33407]">
                Submit invoice
              </button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  if (list && list.error) {
    return (
      <div>
        {header}
        <ErrorNote message={list.error} />
      </div>
    );
  }

  const needle = q.toLowerCase();
  const rows: InvoiceRow[] = (list?.rows ?? []).filter(
    (r) =>
      (payee === "all" || r.payee_type === payee) &&
      (!needle || [r.name, r.campaignName, r.brandName, r.email, r.ig].some((v) => (v ?? "").toLowerCase().includes(needle)))
  );

  const returnFields = (
    <>
      <input type="hidden" name="return_tab" value={tab} />
      {q && <input type="hidden" name="return_q" value={q} />}
    </>
  );

  const dueCell = (r: InvoiceRow) => {
    if (tab === "paid") return <span className="text-stone-600">Paid {fmtShortDate(r.date_paid)}</span>;
    if (!r.dueAt) return <span className="text-stone-400">—</span>;
    const days = Math.floor((Date.now() - r.dueAt.getTime()) / 86400000);
    if (days >= 1)
      return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-status-bad">Overdue {days} day{days === 1 ? "" : "s"}</span>;
    return <span className="text-stone-600">{days === 0 ? "Today" : fmtShortDate(r.dueAt.toISOString())}</span>;
  };

  const actionFor = (r: InvoiceRow) =>
    r.date_paid ? null : (
      <form action={markInvoicePaid}>
        <input type="hidden" name="invoice_id" value={r.invoice_id} />
        {returnFields}
        <ConfirmSubmit summary={`Mark the ${dollarsFmt(r.amount, true)} invoice from ${r.name ?? "this payee"} as paid? Only do this once the money has gone out. Logged to the audit trail.`} confirmLabel="Mark paid">
          Mark paid
        </ConfirmSubmit>
      </form>
    );

  return (
    <div>
      {header}
      {note && <ResultNote tone={note.tone}>{note.text}</ResultNote>}
      <Card pad={false}>
        {tabs}
        <Toolbar
          action="/admin/pay/invoices"
          hidden={{ tab: tab === "asap" ? undefined : tab }}
          search={{ name: "q", value: q, placeholder: "Search payee or campaign" }}
          selects={[{ name: "payee", value: payee, ariaLabel: "Payee type", options: [{ value: "all", label: "All payee types" }, ...PAYEE_TYPES] }]}
          right={<ViewToggle listKey="pay-invoices" view={view} />}
        />
        {list?.pending ? (
          <Pending083 feature="Invoices" />
        ) : (
          <PayTable<InvoiceRow>
            rows={rows}
            rowKey={(r) => String(r.invoice_id)}
            view={view}
            card={(r) => (
              <PayCard
                top={
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-900">{r.name ?? "—"}</div>
                    <div className="truncate text-[12px] text-stone-500">{cap(r.payee_type)}</div>
                  </div>
                }
                figure={dollarsFmt(r.amount, true)}
                strip={
                  <>
                    {dueCell(r)}
                    <MethodPill method={r.payment_method} />
                  </>
                }
                details={[
                  { label: "Campaign", value: <CampaignCell title={r.campaignName} brandName={r.brandName} brandLogo={r.brandLogo} /> },
                  { label: "Terms", value: termsLabel(r.payment_due_days) },
                ]}
                actions={actionFor(r)}
              />
            )}
            emptyLabel={q || payee !== "all" ? "No invoices match that." : tab === "paid" ? "No invoices have been marked paid yet." : tab === "scheduled" ? "No invoices are scheduled." : "No invoices are due right now."}
            columns={[
              {
                key: "payee",
                header: "Payee",
                render: (r) => (
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-900">{r.name ?? "—"}</div>
                    <div className="truncate text-[12px] text-stone-500">{cap(r.payee_type)}</div>
                  </div>
                ),
              },
              { key: "campaign", header: "Campaign", render: (r) => <CampaignCell title={r.campaignName} brandName={r.brandName} brandLogo={r.brandLogo} /> },
              { key: "method", header: "Method", secondary: true, render: (r) => <MethodPill method={r.payment_method} /> },
              { key: "terms", header: "Terms", secondary: true, render: (r) => <span className="text-stone-600">{termsLabel(r.payment_due_days)}</span> },
              { key: "due", header: tab === "paid" ? "Paid" : "Due", render: dueCell },
              { key: "amount", header: "Amount", align: "right", render: (r) => <span className="font-semibold text-stone-900">{dollarsFmt(r.amount, true)}</span> },
              { key: "act", header: "", align: "right", render: (r) => <span className="inline-flex justify-end">{actionFor(r)}</span> },
            ]}
            mobile={(r) => (
              <MobileRow
                top={
                  <div className="min-w-0">
                    <div className="truncate font-medium text-stone-900">{r.name ?? "—"}</div>
                    <div className="truncate text-[12px] text-stone-500">
                      {cap(r.payee_type)}
                      {r.campaignName ? ` · ${r.campaignName}` : ""}
                    </div>
                  </div>
                }
                figure={dollarsFmt(r.amount, true)}
                strip={
                  <>
                    {dueCell(r)}
                    <span>{termsLabel(r.payment_due_days)}</span>
                    <MethodPill method={r.payment_method} />
                  </>
                }
                actions={actionFor(r)}
              />
            )}
          />
        )}
      </Card>
    </div>
  );
}
