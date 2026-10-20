// ============================================================
// /admin/content/posting — Posting instructions, campaign list.
// Matches prototype S.posting: Campaign · Athletes · Posts · Sent ·
// Posted · Progress. Source: posting_campaigns + posting_packages
// (the same counts GET /api/posting-campaigns computes).
//
// Setting up a NEW posting campaign (prototype S["posting-new"]) is not
// built yet — the Hub has no create flow either (it is Phase 3 of the
// posting work), so there is no "New" button rather than a dead one.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadPostingCampaigns } from "@/lib/admin/content/queries";
import { ErrorNote, PageHeader } from "@/components/admin/ui";
import { Card } from "@/components/admin/content/bits";
import { CardFoot } from "@/components/admin/ops-bits";
import { PostingList } from "@/components/admin/content/PostingList";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";

export const dynamic = "force-dynamic";

export default async function PostingPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("staff");
  const view = getListView("content-posting", searchParams);
  const supabase = createServiceSupabase();
  const { rows, error } = await loadPostingCampaigns(supabase);
  return (
    <div>
      <PageHeader
        title="Posting instructions"
        subtitle="Campaigns with posts scheduled. Copy each athlete's posting link and mark it sent."
        actions={<ViewToggle listKey="content-posting" view={view} />}
      />
      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}
      <Card>
        <PostingList rows={rows} view={view} />
        <CardFoot>
          <span>
            {rows.length} campaign{rows.length === 1 ? "" : "s"} · real data
          </span>
        </CardFoot>
      </Card>
    </div>
  );
}
