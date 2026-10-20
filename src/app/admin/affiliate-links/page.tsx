// ============================================================
// /admin/affiliate-links — Affiliate links (affiliate.cfm rebuilt).
//
// Restyled to the prototype's card pattern: one card with two
// bookmarkable tabs —
//   (default)   Links  — per-athlete affiliate links from the
//               `affiliate_links` table (migration 083, unapplied →
//               honest pending note, no fake rows).
//   ?tab=upload Upload — CSV parse → preview. Import applies with the
//               affiliate tables migration; no apply button until then.
// Read-only. CF's 746 historical uploads stay in the CF database.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { PageHeader } from "@/components/admin/ui";
import { Card, fmtShortDate } from "@/components/admin/campaign/bits";
import CsvPreview from "@/components/admin/CsvPreview";
import { AthleteCell, Btn, CampaignCell, CardTabs, MobileRow, PayCard, PayTable, Pending083 } from "@/components/admin/pay/bits";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import { attachCampaigns, attachPeople } from "@/lib/admin/pay/queries";

export const dynamic = "force-dynamic";

interface LinkRow {
  affiliate_id: number;
  person_id: string | null;
  campaign_id: number | null;
  ig: string | null;
  link: string | null;
  short_url: string | null;
  clicks: number | null;
  provider: string | null;
  date_stamp: string | null;
  created_at: string | null;
  personName: string | null;
  personPic: string | null;
  campaignName: string | null;
  brandName: string | null;
  brandLogo: string | null;
}

export default async function AffiliateLinksPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const tab = searchParams.tab === "upload" ? "upload" : "links";
  const view = getListView("affiliate-links", searchParams);

  let pending = false;
  let error: string | null = null;
  let rows: LinkRow[] = [];
  if (tab === "links") {
    const db = createServiceSupabase();
    const res = await safeQuery<any[]>(
      () =>
        db
          .from("affiliate_links")
          .select("affiliate_id, person_id, campaign_id, ig, link, short_url, clicks, provider, date_stamp, created_at")
          .order("created_at", { ascending: false })
          .limit(300) as any
    );
    pending = res.pending;
    error = res.error;
    rows = (res.data ?? []).map((r) => ({ ...r, personName: null, personPic: null, campaignName: null, brandName: null, brandLogo: null }));
    if (rows.length) await Promise.all([attachPeople(db, rows), attachCampaigns(db, rows)]);
  }

  const who = (r: LinkRow) => r.personName ?? (r.ig ? `@${r.ig.replace(/^@/, "")}` : "—");
  const linkCell = (r: LinkRow) => {
    const url = r.short_url ?? r.link;
    if (!url) return <span className="text-stone-400">—</span>;
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block max-w-[260px] truncate text-[#D73F09] hover:underline">
        {url.replace(/^https?:\/\//, "")}
      </a>
    );
  };

  return (
    <div>
      <PageHeader
        title="Affiliate links"
        subtitle="Each athlete's tracking link for a campaign, and the CSV upload that creates them."
        actions={
          tab === "links" ? (
            <>
              <ViewToggle listKey="affiliate-links" view={view} />
              <Btn href="/admin/affiliate-links?tab=upload" primary>
                Upload links
              </Btn>
            </>
          ) : undefined
        }
      />
      <Card pad={false}>
        <CardTabs
          active={tab}
          tabs={[
            { key: "links", label: "Links", href: "/admin/affiliate-links", count: pending ? null : rows.length, showCount: tab === "links" },
            { key: "upload", label: "Upload", href: "/admin/affiliate-links?tab=upload" },
          ]}
        />
        {tab === "links" &&
          (pending ? (
            <Pending083 feature="Affiliate links" />
          ) : error ? (
            <div className="px-4 py-6 text-[13px] text-status-bad">{error}</div>
          ) : (
            <PayTable<LinkRow>
              rows={rows}
              rowKey={(r) => String(r.affiliate_id)}
              view={view}
              card={(r) => (
                <PayCard
                  top={<AthleteCell name={who(r)} pic={r.personPic} handle={r.personName ? r.ig : null} />}
                  figure={r.clicks == null ? undefined : `${r.clicks.toLocaleString()} clicks`}
                  details={[
                    { label: "Campaign", value: <CampaignCell title={r.campaignName} brandName={r.brandName} brandLogo={r.brandLogo} /> },
                    { label: "Added", value: fmtShortDate(r.date_stamp ?? r.created_at) },
                  ]}
                  actions={r.short_url ?? r.link ? linkCell(r) : undefined}
                />
              )}
              emptyLabel="No affiliate links in the Hub yet."
              columns={[
                { key: "who", header: "Athlete", render: (r) => <AthleteCell name={who(r)} pic={r.personPic} handle={r.personName ? r.ig : null} /> },
                { key: "camp", header: "Campaign", render: (r) => <CampaignCell title={r.campaignName} brandName={r.brandName} brandLogo={r.brandLogo} /> },
                { key: "link", header: "Link", render: linkCell },
                { key: "clicks", header: "Clicks", align: "right", render: (r) => (r.clicks == null ? "—" : r.clicks.toLocaleString()) },
                { key: "added", header: "Added", secondary: true, render: (r) => <span className="text-stone-600">{fmtShortDate(r.date_stamp ?? r.created_at)}</span> },
              ]}
              mobile={(r) => (
                <MobileRow
                  top={<AthleteCell name={who(r)} pic={r.personPic} />}
                  figure={r.clicks == null ? undefined : `${r.clicks.toLocaleString()} clicks`}
                  strip={
                    <>
                      <span className="truncate">{r.campaignName ?? "—"}</span>
                      {linkCell(r)}
                    </>
                  }
                />
              )}
            />
          ))}
        {tab === "upload" && (
          <div className="px-4 py-4 md:px-5">
            <h2 className="pb-3 text-[13px] font-semibold text-stone-900">New upload</h2>
            <CsvPreview />
            <p className="mt-3 text-[12px] text-stone-500">
              Import applies with the affiliate tables migration (083) — until then this stops at preview, with no writes. CF&apos;s 746 historical uploads stay in the CF database.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
