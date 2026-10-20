// ============================================================
// /admin/content/review/[campaignId]/[fileId] — the file workspace.
// Matches batch-2 screens 1c (photo) and 1d (video): one component,
// the stage switches between a large photo and the Drive video player.
// [fileId] is tier3_submissions.id. Decisions go through the existing
// review API (see ReviewWorkspace).
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadReviewWorkspace } from "@/lib/admin/content/queries";
import { ErrorNote, PageHeader } from "@/components/admin/ui";
import { Crumb } from "@/components/admin/content/bits";
import ReviewWorkspace from "@/components/admin/content/ReviewWorkspace";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ReviewFilePage({ params }: { params: { campaignId: string; fileId: string } }) {
  await requireAdmin("staff");
  const base = `/admin/content/review/${params.campaignId}`;
  if (!UUID.test(params.campaignId) || !UUID.test(params.fileId)) {
    return (
      <div>
        <Crumb href="/admin/content/review" label="Review & edit" />
        <PageHeader title="File" />
        <ErrorNote message="That isn't a valid file link." />
      </div>
    );
  }
  const supabase = createServiceSupabase();
  const { data, header } = await loadReviewWorkspace(supabase, params.campaignId, params.fileId);
  if (!data) {
    return (
      <div>
        <Crumb href={header ? base : "/admin/content/review"} label={header?.name ?? "Review & edit"} />
        <PageHeader title="File" />
        <ErrorNote message="That file isn't part of this campaign's review (it may be a test upload or failed scoring)." />
      </div>
    );
  }
  return <ReviewWorkspace key={data.file.id} data={data} base={base} />;
}
