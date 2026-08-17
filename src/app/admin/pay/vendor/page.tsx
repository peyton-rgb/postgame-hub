// ============================================================
// /admin/pay/vendor — Pay Vendor request form
// (pay_submit_payrequest.cfm rebuilt). Exec-only (layout).
//
// HONEST STATE: the Hub database has no vendor-payment table yet
// (CF stored these in its own DB; only athlete `payouts` exist
// here). The form is built to CF's field set so the workflow is
// ready, but SUBMIT IS DISABLED until a vendor_payment_requests
// migration ships — that decision is flagged in the morning
// report, not invented overnight.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/ui";
import { FieldCard, Field } from "@/components/admin/StickySaveBar";

export const dynamic = "force-dynamic";

export default async function PayVendorPage() {
  await requireAdmin("staff"); // exec enforced by layout

  return (
    <div>
      <PageHeader
        title="Pay Vendor"
        subtitle="Submit a payment request — athlete direct, agency, videographer, or other"
      />

      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <span className="font-medium">Not wired to storage yet.</span> The Hub database has no
        vendor-payment table (CF kept these in its own DB). The form below is the rebuilt
        workflow, submit-disabled until the vendor_payment_requests migration is approved —
        it&apos;s in the morning report as an open schema decision.
      </div>

      <form className="pointer-events-auto space-y-4">
        <FieldCard title="Who are we paying?">
          <Field
            label="Recipient Type"
            name="recipient_type"
            type="select"
            options={[
              { value: "athlete", label: "Athlete directly" },
              { value: "agency", label: "Agency" },
              { value: "videographer", label: "Videographer" },
              { value: "other", label: "Other" },
            ]}
          />
          <Field label="Recipient Name *" name="recipient_name" />
          <Field label="IG Username (if athlete)" name="ig_username" />
          <Field label="Recipient Email" name="recipient_email" type="email" />
          <Field label="Recipient Phone" name="recipient_phone" />
        </FieldCard>

        <FieldCard title="Payment">
          <Field label="Campaign" name="campaign" placeholder="Campaign name" />
          <Field label="Payment Amount (USD) *" name="amount" type="number" />
          <Field
            label="Payment Method *"
            name="method"
            type="select"
            options={[
              { value: "paypal", label: "PayPal" },
              { value: "venmo", label: "Venmo" },
              { value: "zelle", label: "Zelle" },
              { value: "ach", label: "ACH" },
              { value: "wire", label: "Wire" },
              { value: "check", label: "Check" },
            ]}
          />
          <Field label="Payment Handle (PayPal / Venmo / Zelle)" name="handle" />
          <Field label="Notes" name="notes" type="textarea" span2 />
        </FieldCard>

        <FieldCard title="Banking (ACH / Wire only — masked after save, exec-reveal logged)">
          <Field label="Bank Account Name" name="bank_name" />
          <Field label="Bank Account Number" name="bank_account" />
          <Field label="Routing Number" name="routing" />
          <Field label="TAX ID (FEIN or SSN)" name="tax_id" />
        </FieldCard>

        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <button
            type="button"
            disabled
            className="rounded-md bg-stone-300 px-4 py-2 text-[13px] font-medium text-white cursor-not-allowed"
            title="Storage table pending — see morning report"
          >
            Submit request (disabled — storage pending)
          </button>
        </div>
      </form>
    </div>
  );
}
