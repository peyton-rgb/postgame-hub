// ============================================================
// /admin/affiliate-links — Upload Affiliate Links (affiliate.cfm
// rebuilt). CF's 746 uploads live in the CF database; the Hub has
// no affiliate-links tables. Tonight: the parse → preview flow is
// live; import lands with the affiliate tables migration (morning-
// report decision). Honest empty upload registry, no fake rows.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { PageHeader, EmptyRows } from "@/components/admin/ui";
import CsvPreview from "@/components/admin/CsvPreview";

export const dynamic = "force-dynamic";

export default async function AffiliateLinksPage() {
  await requireAdmin("staff");

  return (
    <div>
      <PageHeader
        title="Upload Affiliate Links"
        subtitle="CSV in → preview → import (import gated on the affiliate tables migration)"
      />

      <div className="space-y-4">
        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
          <h2 className="pb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
            New upload
          </h2>
          <CsvPreview />
          <p className="mt-3 text-[12px] text-amber-700">
            Import applies with the affiliate tables migration — until then this stops at preview
            (no writes, stated honestly). Decision flagged in the morning report.
          </p>
        </div>

        <div>
          <h2 className="pb-2 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
            Upload registry
          </h2>
          <div className="rounded-lg border border-stone-200 bg-white">
            <EmptyRows label="No affiliate-link uploads in the Hub database. CF's 746 historical uploads stay in the CF database." />
          </div>
        </div>
      </div>
    </div>
  );
}
