// ============================================================
// /admin/profiles/upload — Upload Profiles + import wizard
// (uploads_profiles.cfm + import/import_step1.cfm rebuilt).
//
// The wizard follows the standing import pattern: parse → preview
// → confirmed apply. Tonight the APPLY stays disabled by design —
// a bulk upsert into the 52k-row people table is exactly the kind
// of write the overnight run must not enable unilaterally. The
// preview step is fully live (in-browser parse, no writes).
// CF's upload registry (339 rows) stays in the CF database.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { PageHeader, EmptyRows } from "@/components/admin/ui";
import CsvPreview from "@/components/admin/CsvPreview";

export const dynamic = "force-dynamic";

export default async function UploadProfilesPage() {
  await requireAdmin("staff");

  return (
    <div>
      <PageHeader
        title="Upload Profiles"
        subtitle="Import wizard: parse → preview → confirmed apply"
      />

      <div className="space-y-4">
        <ol className="flex flex-wrap gap-2 text-[13px]">
          <li className="rounded-full bg-[#D73F09] px-3 py-1 font-medium text-white">1 · Upload + preview</li>
          <li className="rounded-full bg-stone-100 px-3 py-1 text-stone-500">2 · Column mapping</li>
          <li className="rounded-full bg-stone-100 px-3 py-1 text-stone-500">3 · Confirmed apply</li>
        </ol>

        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
          <CsvPreview maxRows={25} />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          Steps 2–3 (mapping + apply into <code className="rounded bg-amber-100 px-1">people</code>)
          are intentionally not enabled in the overnight build: a bulk write into the 52k-row
          network table needs a reviewed dedupe strategy (ILIKE/TRIM name-matching rules, the
          college alias map, and archive-not-in-upload behavior). Queued in the morning report.
        </div>

        <div>
          <h2 className="pb-2 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
            Upload registry
          </h2>
          <div className="rounded-lg border border-stone-200 bg-white">
            <EmptyRows label="No profile uploads recorded in the Hub. CF's 339 historical uploads stay in the CF database." />
          </div>
        </div>
      </div>
    </div>
  );
}
