// ============================================================
// /admin/content/pipeline — Content pipeline, one screen with tabs.
// Matches prototype S.pipeline / S["pipeline-review"] /
// S["pipeline-posting"] / S["pipeline-recaps"]: Collecting → Review →
// Posting → Recaps. Each tab is a bookmarkable link (?tab=), and each
// reuses the same table as its standalone screen.
//
// Review tab: the prototype's "Sent back by brand / Waiting on brand"
// segments need a brand gate on uploaded files, which tier3_submissions
// doesn't record yet — only "Needs review" is shown.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadPostingCampaigns, loadRecaps, loadReviewCampaigns } from "@/lib/admin/content/queries";
import { EmptyRows, ErrorNote, PageHeader } from "@/components/admin/ui";
import { CampCell, CardFoot, CardTabs } from "@/components/admin/ops-bits";
import { BtnLink, Card, Pill, TableWrap, Td, Th } from "@/components/admin/content/bits";
import { ReviewList } from "@/components/admin/content/ReviewList";
import { PostingList } from "@/components/admin/content/PostingList";
import { RecapGrid } from "@/components/admin/content/RecapGrid";

export const dynamic = "force-dynamic";

type Tab = "collecting" | "review" | "posting" | "recaps";

export default async function PipelinePage({ searchParams }: { searchParams: { tab?: string } }) {
  await requireAdmin("staff");
  const tab: Tab = (["review", "posting", "recaps"] as const).includes(searchParams.tab as any)
    ? (searchParams.tab as Tab)
    : "collecting";
  const supabase = createServiceSupabase();
  const [review, posting, recaps] = await Promise.all([
    loadReviewCampaigns(supabase),
    loadPostingCampaigns(supabase),
    loadRecaps(supabase, { status: "draft", page: 1 }),
  ]);
  const needs = review.rows.filter((r) => r.needsUs);
  const base = "/admin/content/pipeline";
  const error = review.error ?? posting.error ?? recaps.error;

  const action =
    tab === "collecting" ? (
      <BtnLink href="/admin/content/submissions" primary>
        Submission forms
      </BtnLink>
    ) : tab === "recaps" ? (
      <BtnLink href="/admin/content/recaps" primary>
        Recap builder
      </BtnLink>
    ) : null;

  return (
    <div>
      <PageHeader title="Content pipeline" subtitle="Every campaign's content from upload to recap." actions={action} />
      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}
      <Card>
        <CardTabs
          tabs={[
            { href: base, label: "Collecting", count: review.rows.length, active: tab === "collecting" },
            { href: `${base}?tab=review`, label: "Review", count: needs.length, active: tab === "review" },
            { href: `${base}?tab=posting`, label: "Posting", count: posting.rows.length, active: tab === "posting" },
            { href: `${base}?tab=recaps`, label: "Recaps", count: recaps.total, active: tab === "recaps" },
          ]}
        />

        {tab === "collecting" &&
          (review.rows.length === 0 ? (
            <EmptyRows label="No campaign has a submission form yet." />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Campaign</Th>
                  <Th right>Athletes</Th>
                  <Th right>Files in</Th>
                  <Th>Status</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {review.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-stone-50/60">
                    <Td>
                      <CampCell name={r.name} brandName={r.brandName} logo={r.logo} />
                    </Td>
                    <Td right className="tabular-nums">{r.athletes || "—"}</Td>
                    <Td right className="tabular-nums">{r.files || "—"}</Td>
                    <Td>
                      {r.waitingOnAthletes ? (
                        <Pill tone="warn">Waiting on athletes</Pill>
                      ) : r.needsUs ? (
                        <Pill tone="accent">In review</Pill>
                      ) : (
                        <Pill tone="ok">Collected</Pill>
                      )}
                    </Td>
                    <Td right>
                      <BtnLink
                        href={r.adminCampaignId ? `/admin/content/submissions/${r.adminCampaignId}` : `/admin/content/review/${r.id}`}
                      >
                        Open
                      </BtnLink>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ))}

        {tab === "review" && <ReviewList rows={needs} emptyLabel="No campaign has files waiting on Postgame." />}

        {tab === "posting" && <PostingList rows={posting.rows} />}

        {tab === "recaps" && (
          <>
            <div className="border-b border-stone-200 px-4 py-2.5 text-[12px] text-stone-500">
              Draft recaps, newest first
              {recaps.readyCount !== null && ` · ${recaps.readyCount} campaigns ready for a recap`}
            </div>
            <RecapGrid cards={recaps.cards} emptyLabel="No draft recaps." />
          </>
        )}

        <CardFoot>
          <span>Real data</span>
        </CardFoot>
      </Card>
    </div>
  );
}
