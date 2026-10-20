// ============================================================
// /admin/content/review — Review & edit, campaign list.
// Matches batch-2 screen 1a (prototype "review").
//
// One row per campaign with a submission form. "Needs us" = files
// waiting on a Postgame reviewer or sitting in the edit queue; "All"
// adds campaigns waiting on athletes and fully-approved ones.
// Source: submission_links → campaign_recaps → tier3_submissions,
// through the same loadReviewsIndex port /dashboard/reviews uses.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadReviewCampaigns } from "@/lib/admin/content/queries";
import { ErrorNote, PageHeader } from "@/components/admin/ui";
import { Card, SegLinks } from "@/components/admin/content/bits";
import { ReviewList } from "@/components/admin/content/ReviewList";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: { tab?: string; view?: string } }) {
  await requireAdmin("staff");
  const view = getListView("content-review", searchParams);
  const supabase = createServiceSupabase();
  const { rows, error } = await loadReviewCampaigns(supabase);

  const tab = searchParams.tab === "all" ? "all" : "needs";
  const needs = rows.filter((r) => r.needsUs);
  const shown = tab === "needs" ? needs : rows;

  return (
    <div>
      <PageHeader
        title="Review & edit"
        subtitle={
          needs.length
            ? `${needs.length} campaign${needs.length === 1 ? " is" : "s are"} waiting on us`
            : "Nothing is waiting on us right now"
        }
        actions={
          <>
          <ViewToggle listKey="content-review" view={view} />
          <SegLinks
            items={[
              { href: "/admin/content/review", label: "Needs us", count: needs.length, active: tab === "needs" },
              { href: "/admin/content/review?tab=all", label: "All", count: rows.length, active: tab === "all" },
            ]}
          />
          </>
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}
      <Card>
        <ReviewList
          rows={shown}
          view={view}
          emptyLabel={tab === "needs" ? "No campaign has files waiting on Postgame." : "No campaign has a submission form yet."}
        />
      </Card>
    </div>
  );
}
