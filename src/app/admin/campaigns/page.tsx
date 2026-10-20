// ============================================================
// /admin/campaigns — Campaigns list, rebuilt from the postgame1.com
// (Lovable) admin onto the blended `campaigns` table (migration 083).
//
// Same columns as the Lovable screen: Campaign (brand – name), Drive,
// Campaign Manager, Status, Selected, Created. Same controls: search,
// "Active only" (on by default), New campaign, and the dashboard's
// "missing X" filters (?missing=contract|brief|optin|instructions|tags).
//
// Server-rendered, 50 per page, newest first.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import ViewToggle from "@/components/admin/ViewToggle";
import { BrandMark } from "@/components/admin/brand-bits";
import { getListView } from "@/lib/admin/list-view";

export const dynamic = "force-dynamic";

const MISSING_LABELS: Record<string, string> = {
  contract: "Missing Talent Agreement",
  brief: "Missing Creative Brief",
  optin: "Missing Opt-in",
  instructions: "Missing Instructions",
  tags: "Missing Tags",
};

const emptyOr = (field: string) => `${field}.is.null,${field}.eq.`;

interface Row {
  campaign_id: number;
  campaign_name: string | null;
  is_active: boolean | null;
  total_is_selected: number | null;
  date_stamp: string | null;
  created_at: string;
  brand: { id: string; name: string | null; logo_mark_url: string | null; logo_primary_url: string | null; logo_url: string | null } | null;
  manager: { first_name: string | null; last_name: string | null } | null;
  storage: { campaign_folder_url: string | null } | null;
}

function managerName(r: Row): string | null {
  const n = [r.manager?.first_name, r.manager?.last_name].filter(Boolean).join(" ").trim();
  return n || null;
}

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const view = getListView("campaigns", searchParams);

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const missing = searchParams.missing && MISSING_LABELS[searchParams.missing] ? searchParams.missing : "";
  // "Active only" is on by default; ?all=1 shows inactive too. A missing-X
  // filter always looks at active campaigns, as in the Lovable admin.
  const showAll = searchParams.all === "1" && !missing;

  const { from, to } = pageRange(page);
  let listQuery = supabase
    .from("campaigns")
    .select(
      "campaign_id, campaign_name, is_active, total_is_selected, date_stamp, created_at, " +
        "brand:brands!brand_id(id, name, logo_mark_url, logo_primary_url, logo_url), manager:people!manager_person_id(first_name, last_name), " +
        "storage:campaign_storage(campaign_folder_url)"
    );
  let countQuery = supabase.from("campaigns").select("campaign_id", { count: "exact", head: true });

  const applyFilters = (query: any) => {
    let out = query;
    if (!showAll) out = out.eq("is_active", true);
    if (q) out = out.ilike("campaign_name", `%${q}%`);
    switch (missing) {
      case "contract":
        out = out.or(emptyOr("contract"));
        break;
      case "brief":
        out = out.or(emptyOr("campaign_brief_link"));
        break;
      case "optin":
        out = out.or(emptyOr("campaign_webpage"));
        break;
      case "instructions":
        out = out.or(emptyOr("campaign_details_link"));
        break;
      case "tags":
        out = out
          .or(emptyOr("instagram_hashtag"))
          .or(emptyOr("instagram_hashtag2"))
          .or(emptyOr("instagram_hashtag3"))
          .or(emptyOr("instagram_mention"));
        break;
    }
    return out;
  };
  listQuery = applyFilters(listQuery);
  countQuery = applyFilters(countQuery);

  const [{ data, error }, { count }] = await Promise.all([
    listQuery
      .order("date_stamp", { ascending: false, nullsFirst: false })
      .order("campaign_id", { ascending: false })
      .range(from, to),
    countQuery,
  ]);
  const rows = (data ?? []) as unknown as Row[];

  const params = { q: q || undefined, missing: missing || undefined, all: showAll ? "1" : undefined };
  const toggleHref = (() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (!showAll) p.set("all", "1");
    const s = p.toString();
    return s ? `/admin/campaigns?${s}` : "/admin/campaigns";
  })();

  return (
    <div>
      <PageHeader
        title="Campaigns"
        subtitle="Manage influencer campaigns"
        actions={
          <>
          <ViewToggle listKey="campaigns" view={view} />
          <Link
            href="/admin/campaigns/new"
            className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white"
          >
            + New campaign
          </Link>
          </>
        }
      />

      {searchParams.result === "deleted" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Campaign deleted.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form action="/admin/campaigns" className="flex-1 min-w-[220px]">
          {missing && <input type="hidden" name="missing" value={missing} />}
          {showAll && <input type="hidden" name="all" value="1" />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search campaigns..."
            className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
          />
        </form>
        {!missing && (
          <Link
            href={toggleHref}
            className="flex items-center gap-2 text-[13px] text-stone-700"
            title={showAll ? "Showing all campaigns" : "Showing active campaigns only"}
          >
            <span
              className={
                "relative inline-block h-5 w-9 rounded-full transition-colors " +
                (showAll ? "bg-stone-300" : "bg-[#D73F09]")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all " +
                  (showAll ? "left-0.5" : "left-[18px]")
                }
              />
            </span>
            Active only
          </Link>
        )}
      </div>

      {missing && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1 text-[12px] text-stone-700">
            Filter: {MISSING_LABELS[missing]}
            <Link href="/admin/campaigns" aria-label="Clear filter" className="text-stone-500 hover:text-stone-900">
              ✕
            </Link>
          </span>
        </div>
      )}

      {error ? (
        <ErrorNote message={`Could not load campaigns: ${error.message}`} />
      ) : (
        <>
          <AdminTable<Row>
            rows={rows}
            rowKey={(r) => String(r.campaign_id)}
            view={view}
            cardDetails={["manager", "status", "created"]}
            emptyLabel={
              q || missing ? "No campaigns match." : "No campaigns yet. The real list arrives with the data migration."
            }
            columns={[
              {
                key: "campaign",
                header: "Campaign",
                // Brand name opens the brand detail page; campaign name
                // opens the campaign. Two links, so no nested anchors.
                render: (r) => (
                  <span className="inline-flex flex-wrap items-center gap-x-1">
                    <span className="mr-1.5 inline-flex">
                      <BrandMark
                        name={r.brand?.name ?? null}
                        src={r.brand?.logo_mark_url ?? r.brand?.logo_primary_url ?? r.brand?.logo_url ?? null}
                      />
                    </span>
                    {r.brand?.name && (
                      <>
                        <Link
                          href={`/admin/brands/${r.brand.id}`}
                          className="font-medium text-stone-700 hover:text-[#D73F09] hover:underline"
                        >
                          {r.brand.name}
                        </Link>
                        <span className="text-stone-400">-</span>
                      </>
                    )}
                    <NameLink href={`/admin/campaigns/${r.campaign_id}`}>{r.campaign_name || "—"}</NameLink>
                  </span>
                ),
              },
              {
                key: "drive",
                header: "Drive",
                align: "center",
                render: (r) =>
                  r.storage?.campaign_folder_url ? (
                    <a
                      href={r.storage.campaign_folder_url}
                      target="_blank"
                      rel="noreferrer"
                      title="Open campaign Drive folder"
                      className="text-[#D73F09]"
                    >
                      ↗
                    </a>
                  ) : (
                    <span className="text-stone-400">—</span>
                  ),
              },
              {
                key: "manager",
                header: "Campaign Manager",
                render: (r) => managerName(r) ?? <span className="text-stone-400">—</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <span
                    className={
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium " +
                      (r.is_active ? "bg-green-50 text-status-ok" : "bg-stone-100 text-stone-500")
                    }
                  >
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                ),
              },
              {
                key: "selected",
                header: "Selected",
                align: "right",
                render: (r) => (r.total_is_selected ?? 0).toLocaleString(),
              },
              {
                key: "created",
                header: "Created",
                align: "right",
                secondary: true,
                render: (r) => formatDate(r.date_stamp ?? r.created_at),
              },
            ]}
            mobile={{
              icon: (r) => (
                <BrandMark
                  name={r.brand?.name ?? null}
                  src={r.brand?.logo_mark_url ?? r.brand?.logo_primary_url ?? r.brand?.logo_url ?? null}
                />
              ),
              title: (r) => r.campaign_name || "—",
              href: (r) => `/admin/campaigns/${r.campaign_id}`,
              subtitle: (r) => [r.brand?.name, managerName(r)].filter(Boolean).join(" · ") || null,
              strip: (r) => (r.is_active ? "Active" : "Inactive"),
              figure: (r) => `${(r.total_is_selected ?? 0).toLocaleString()} selected`,
            }}
          />
          <Paginator
            page={page}
            total={count ?? 0}
            pageSize={PAGE_SIZE}
            basePath="/admin/campaigns"
            params={params}
          />
        </>
      )}
    </div>
  );
}
