// ============================================================
// /admin/content/review/[campaignId] — one campaign's athletes.
// Matches batch-2 screen 1b (prototype "review-campaign").
//
// [campaignId] is campaign_recaps.id (the id submission_links and
// tier3_submissions carry). Athletes are grouped by name, exactly as
// the review hub does (reviewHubLogic.buildAthletes), and checked
// against the form's own min_photos / min_videos.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadCampaignFiles, loadReviewCampaignHeader, reviewAthletes } from "@/lib/admin/content/queries";
import { ErrorNote, EmptyRows, PageHeader } from "@/components/admin/ui";
import { BtnLink, Card, Crumb, SegLinks, TableWrap, Td, Th } from "@/components/admin/content/bits";
import { BrandMark } from "@/components/admin/brand-bits";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ReviewCampaignPage({
  params,
  searchParams,
}: {
  params: { campaignId: string };
  searchParams: { tab?: string };
}) {
  await requireAdmin("staff");
  const back = <Crumb href="/admin/content/review" label="Review & edit" />;
  if (!UUID.test(params.campaignId)) {
    return (
      <div>
        {back}
        <PageHeader title="Campaign" />
        <ErrorNote message="That isn't a campaign id." />
      </div>
    );
  }

  const supabase = createServiceSupabase();
  const header = await loadReviewCampaignHeader(supabase, params.campaignId);
  if (!header) {
    return (
      <div>
        {back}
        <PageHeader title="Campaign" />
        <ErrorNote message="Campaign not found." />
      </div>
    );
  }
  const files = await loadCampaignFiles(supabase, params.campaignId);
  const athletes = reviewAthletes(files, header);

  const tab = searchParams.tab === "done" || searchParams.tab === "all" ? searchParams.tab : "needs";
  const needs = athletes.filter((a) => a.tab !== "done");
  const done = athletes.filter((a) => a.tab === "done");
  const shown = tab === "needs" ? needs : tab === "done" ? done : athletes;
  const base = `/admin/content/review/${header.id}`;

  return (
    <div>
      {back}
      <PageHeader
        title={header.name}
        subtitle={[
          header.brandName,
          `${athletes.length} athlete${athletes.length === 1 ? "" : "s"}`,
          header.minPhotos || header.minVideos
            ? `form asks for ${header.minPhotos} photo${header.minPhotos === 1 ? "" : "s"} + ${header.minVideos} video${header.minVideos === 1 ? "" : "s"}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {header.adminCampaignId && (
              <BtnLink href={`/admin/content/submissions/${header.adminCampaignId}`}>Submission form</BtnLink>
            )}
            {header.token && (
              <BtnLink href={`/dashboard/submission-forms/${header.token}/review`}>Open review hub</BtnLink>
            )}
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 px-3 pt-3">
          <BrandMark src={header.logo} name={header.brandName} size={26} />
          <SegLinks
            items={[
              { href: base, label: "Needs us", count: needs.length, active: tab === "needs" },
              { href: `${base}?tab=done`, label: "Done", count: done.length, active: tab === "done" },
              { href: `${base}?tab=all`, label: "All", count: athletes.length, active: tab === "all" },
            ]}
          />
        </div>
        <div className="mt-3">
          {shown.length === 0 ? (
            <EmptyRows label={files.length ? "No athletes here." : "No files have been uploaded to this campaign's form yet."} />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Athlete</Th>
                  <Th>Progress</Th>
                  <Th>Next step</Th>
                  <Th right />
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => {
                  const pct = a.required ? Math.round((a.approved / a.required) * 100) : 0;
                  const href = a.firstFileId ? `${base}/${a.firstFileId}` : base;
                  return (
                    <tr key={a.key} className="hover:bg-stone-50/60">
                      <Td>
                        <div className="font-medium text-stone-900">{a.name}</div>
                        <div className="text-[12px] text-stone-500">{a.school ?? "—"}</div>
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12px] text-stone-600">
                          <span className="h-1.5 w-[90px] overflow-hidden rounded-full bg-stone-100">
                            <i className="block h-full rounded-full bg-status-ok" style={{ width: `${pct}%` }} />
                          </span>
                          {a.approved} of {a.required} approved
                        </span>
                      </Td>
                      <Td className="text-stone-700">{a.next}</Td>
                      <Td right>
                        {a.firstFileId ? (
                          <BtnLink href={href} primary={a.ctaPrimary}>
                            {a.cta}
                          </BtnLink>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </div>
      </Card>
    </div>
  );
}
