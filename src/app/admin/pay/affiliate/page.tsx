// ============================================================
// /admin/pay/affiliate — Affiliate Payments (affiliate_payments.cfm
// + affiliate_pay.cfm rebuilt). Exec-only (layout).
//
// HONEST STATE: affiliate ledgers (owed / history) live in the CF
// database; the Hub has no affiliate tables. Tabs render the real
// (empty) truth. The monthly-upload flow is live to the PREVIEW
// step (parse → preview in-browser); applying requires the
// affiliate tables migration — flagged in the morning report.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { PageHeader, EmptyRows } from "@/components/admin/ui";
import CsvPreview from "@/components/admin/CsvPreview";

export const dynamic = "force-dynamic";

const TABS = ["owed", "history", "upload"] as const;

export default async function AffiliatePaymentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff"); // exec enforced by layout
  const tab = (TABS as readonly string[]).includes(searchParams.tab ?? "")
    ? (searchParams.tab as (typeof TABS)[number])
    : "owed";

  return (
    <div>
      <PageHeader
        title="Affiliate Payments"
        subtitle="Owed · history · monthly report upload"
      />

      <div className="flex gap-1 pb-4">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "owed" ? "/admin/pay/affiliate" : `/admin/pay/affiliate?tab=${t}`}
            className={
              "rounded-md px-3 py-1.5 text-[13px] font-medium capitalize " +
              (tab === t ? "bg-[#D73F09] text-white" : "text-stone-600 hover:bg-stone-100")
            }
          >
            {t === "upload" ? "Monthly upload" : t}
          </Link>
        ))}
      </div>

      {(tab === "owed" || tab === "history") && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            The affiliate {tab === "owed" ? "owed ledger (CF: 472 rows)" : "payment history (CF: 1,372 rows)"} lives in
            the CF database — those tables haven&apos;t migrated to the Hub yet. Nothing is shown
            because nothing real exists here; the import decision is in the morning report.
          </div>
          <div className="rounded-lg border border-stone-200 bg-white">
            <EmptyRows label="No affiliate rows in the Hub database." />
          </div>
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
            <h2 className="pb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
              Upload monthly affiliate report
            </h2>
            <CsvPreview />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            Preview works now; <span className="font-medium">Apply</span> lands with the affiliate
            tables migration (parse → preview → confirmed-POST apply, per the standing import
            pattern). No apply button is shown until the write has somewhere real to go.
          </div>
        </div>
      )}
    </div>
  );
}
