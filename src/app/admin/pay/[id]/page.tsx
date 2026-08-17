// ============================================================
// /admin/pay/[id] — Payout detail + edit (pay_detail.cfm +
// pay_edit.cfm rebuilt). Exec-only (layout). Confirmed POST saves.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatDate, formatMoney } from "@/lib/admin/db";
import { PageHeader, ErrorNote } from "@/components/admin/ui";
import AdminForm, { FieldCard, Field } from "@/components/admin/StickySaveBar";
import { savePayout } from "../actions";

export const dynamic = "force-dynamic";

export default async function PayoutDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff"); // exec enforced by layout
  const supabase = createServiceSupabase();

  const { data: payout, error } = await supabase
    .from("payouts")
    .select(
      "id, athlete_id, optin_id, optin_campaign_id, amount_cents, amount_label, currency, status, provider, paypal_email, provider_ref, scheduled_for, paid_at, created_at, profiles!athlete_id(full_name, email, ig_handle, paypal_email)"
    )
    .eq("id", params.id)
    .single();

  if (error || !payout) {
    return (
      <div>
        <PageHeader title="Payout" />
        <ErrorNote message="Payout not found." />
      </div>
    );
  }

  const athlete = payout.profiles as unknown as {
    full_name: string | null;
    email: string | null;
    ig_handle: string | null;
    paypal_email: string | null;
  } | null;

  const { data: campaign } = payout.optin_campaign_id
    ? await supabase
        .from("optin_campaigns")
        .select("title, payout")
        .eq("id", payout.optin_campaign_id)
        .single()
    : { data: null };

  const result = searchParams.result;

  return (
    <div>
      <PageHeader
        title={`Payout · ${athlete?.full_name ?? athlete?.email ?? "Unknown athlete"}`}
        subtitle={`${payout.status} · created ${formatDate(payout.created_at)}${payout.paid_at ? ` · paid ${formatDate(payout.paid_at)}` : ""}`}
      />

      {result === "saved" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Saved — logged to the audit trail.
        </div>
      )}
      {result === "bad-amount" && (
        <ErrorNote message="Amount must be a plain dollar figure between 0 and 1,000,000. Nothing was changed." />
      )}
      {result === "error" && <ErrorNote message="Save failed — nothing was changed." />}

      <div className="mb-4 rounded-lg border border-stone-200 bg-white">
        <dl className="divide-y divide-stone-100 text-[13px]">
          {(
            [
              ["Athlete", athlete?.full_name ?? "—"],
              ["Email", athlete?.email ?? "—"],
              ["IG", athlete?.ig_handle ? `@${athlete.ig_handle.replace(/^@/, "")}` : "—"],
              ["Campaign", campaign?.title ?? "—"],
              ["Deal payout label", payout.amount_label ?? campaign?.payout ?? "—"],
              ["Amount (set)", payout.amount_cents != null ? formatMoney(payout.amount_cents) : "not set — label only"],
              ["Scheduled for", formatDate(payout.scheduled_for)],
              ["Provider ref", payout.provider_ref ?? "—"],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[160px_1fr] gap-3 px-4 py-2.5">
              <dt className="text-stone-500">{label}</dt>
              <dd className="text-stone-900">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <AdminForm
        action={savePayout}
        confirmSummary={`Update payment details for ${athlete?.full_name ?? "this athlete"}? Amount and payment method changes are logged. No money moves — execution stays manual.`}
      >
        <input type="hidden" name="id" value={payout.id} />
        <div className="space-y-4">
          <FieldCard title="Payment details">
            <Field
              label="Amount (USD)"
              name="amount"
              defaultValue={payout.amount_cents != null ? (payout.amount_cents / 100).toFixed(2) : ""}
              placeholder="e.g. 250.00 — never auto-invented from the label"
            />
            <Field
              label="Payment Method"
              name="provider"
              type="select"
              defaultValue={payout.provider ?? "paypal"}
              options={[
                { value: "paypal", label: "PayPal" },
                { value: "venmo", label: "Venmo" },
                { value: "zelle", label: "Zelle" },
                { value: "ach", label: "ACH" },
                { value: "wire", label: "Wire" },
              ]}
            />
            <Field
              label="Payment Email"
              name="paypal_email"
              type="email"
              defaultValue={payout.paypal_email ?? athlete?.paypal_email ?? ""}
            />
          </FieldCard>
        </div>
      </AdminForm>
    </div>
  );
}
