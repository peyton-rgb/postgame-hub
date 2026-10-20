// ============================================================
// /admin/content/submissions — Submission forms list
// Matches prototype screen S["submission-forms"].
// Lists submission forms with athlete web links, videographer counts,
// upload counts, nudge counts, LucidLink status, and office worker status.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { listSubmissionForms } from "@/lib/admin/submissions/queries";
import { PageHeader } from "@/components/admin/ui";
import { SubmissionsTable } from "@/components/admin/submissions/SubmissionsTable";

export const dynamic = "force-dynamic";

export default async function SubmissionFormsPage() {
  await requireAdmin("staff");

  const supabase = createServiceSupabase();
  const res = await listSubmissionForms(supabase);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Submission forms"
        subtitle="Athletes upload on a web page (or in the app). Videographers upload through the Postgame desktop app. Everything lands in the campaign's LucidLink folder; Review & edit picks it up from there."
      />

      <SubmissionsTable
        initialRows={res.rows}
        pending083={res.pending083}
        pending087={res.pending087}
        worker={res.worker}
      />
    </div>
  );
}
