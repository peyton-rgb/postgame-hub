// ============================================================
// /admin/brands — Brands list (the Lovable admin's "Accounts",
// restyled to the approved Hub prototype). Source: brands.
//
// Columns match the prototype: Brand · Drive · Active · All campaigns ·
// Latest campaign · Portal (status + Copy link). Campaign numbers come
// from the live portal_campaigns view today, and from the blended
// `campaigns` table once migration 083 is applied.
//
// Logos always render from the brand row's logo columns — never
// typed as text (standing brand rule). Anything that depends on
// migration 083 (account_types, campaigns, brand_portal_links)
// degrades to an honest "—" until it is applied.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import CopyButton from "@/components/admin/CopyButton";
import { BrandMark, PortalPill, portalState, type PortalLinkRow } from "@/components/admin/brand-bits";

export const dynamic = "force-dynamic";

interface BrandRow {
  id: string;
  admin_brand_id: string | null;
  name: string | null;
  industry: string | null;
  website: string | null;
  archived: boolean | null;
  created_at: string | null;
  portal_token: string | null;
  logo_primary_url: string | null;
  logo_mark_url: string | null;
  drive_parent_folder_id: string | null;
}

interface BrandActivity {
  active: number;
  total: number;
  latestName: string | null;
  latestDate: string | null;
}

interface CampaignCount {
  active: number;
  total: number;
}

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const view = getListView("brands", searchParams);
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const showArchived = searchParams.archived === "1";

  function apply(query: any) {
    if (!showArchived) query = query.eq("archived", false);
    if (q) query = query.ilike("name", `%${q}%`);
    return query;
  }

  const { from, to } = pageRange(page);
  const [{ data, error }, { count }] = await Promise.all([
    apply(
      supabase
        .from("brands")
        .select(
          "id, admin_brand_id, name, industry, website, archived, created_at, portal_token, logo_primary_url, logo_mark_url, drive_parent_folder_id"
        )
    )
      .order("name")
      .range(from, to),
    apply(supabase.from("brands").select("id", { count: "exact", head: true })),
  ]);

  if (error) {
    return (
      <div>
        <PageHeader title="Brands" />
        <ErrorNote message={error.message} />
      </div>
    );
  }
  const rows = (data ?? []) as BrandRow[];
  const ids = rows.map((r) => r.id);

  // ---- Side lookups for the brands on this page (migration 083 shapes). ----
  // Each is a separate safeQuery so a missing table/column shows "—" in its
  // own column instead of sinking the whole list.
  const [typeRes, campRes, portalRes, activityRes] = ids.length
    ? await Promise.all([
        safeQuery<{ id: string; account_type: { account_type: string | null } | null }[]>(
          () =>
            supabase
              .from("brands")
              .select("id, account_type:account_types!account_type_id(account_type)")
              .in("id", ids) as any
        ),
        safeQuery<{ brand_id: string | null; is_active: boolean | null }[]>(() =>
          supabase.from("campaigns").select("brand_id, is_active").in("brand_id", ids)
        ),
        safeQuery<PortalLinkRow[]>(() =>
          supabase.from("brand_portal_links").select("brand_id, active").in("brand_id", ids)
        ),
        // Live today: one row per campaign recap, with lifecycle + created date.
        safeQuery<{ brand_id: string | null; name: string | null; lifecycle_status: string | null; admin_created_on: string | null }[]>(() =>
          supabase
            .from("portal_campaigns")
            .select("brand_id, name, lifecycle_status, admin_created_on")
            .in("brand_id", ids)
            .limit(5000)
        ),
      ])
    : [
        { data: null, pending: true, error: null },
        { data: null, pending: true, error: null },
        { data: null, pending: true, error: null },
        { data: null, pending: true, error: null },
      ];

  // Active / all / latest campaign per brand: the blended campaigns table
  // when it exists (083), otherwise the live portal_campaigns view.
  const activity = new Map<string, BrandActivity>();
  for (const c of activityRes.data ?? []) {
    if (!c.brand_id) continue;
    const e = activity.get(c.brand_id) ?? { active: 0, total: 0, latestName: null, latestDate: null };
    e.total += 1;
    if (c.lifecycle_status === "active") e.active += 1;
    if (c.admin_created_on && (!e.latestDate || c.admin_created_on > e.latestDate)) {
      e.latestDate = c.admin_created_on;
      e.latestName = c.name;
    } else if (!e.latestName && !e.latestDate) e.latestName = c.name;
    activity.set(c.brand_id, e);
  }

  const typeById = new Map<string, string | null>();
  for (const t of typeRes.data ?? []) typeById.set(t.id, t.account_type?.account_type ?? null);

  const campaignsById = new Map<string, CampaignCount>();
  for (const c of campRes.data ?? []) {
    if (!c.brand_id) continue;
    const cur = campaignsById.get(c.brand_id) ?? { active: 0, total: 0 };
    cur.total += 1;
    if (c.is_active) cur.active += 1;
    campaignsById.set(c.brand_id, cur);
  }

  const portalById = new Map<string, PortalLinkRow>();
  for (const p of portalRes.data ?? []) portalById.set(p.brand_id, p);

  const useBlended = !campRes.pending && !campRes.error;
  const act = (r: BrandRow): BrandActivity | null => {
    const live = activity.get(r.id) ?? null;
    if (useBlended) {
      const c = campaignsById.get(r.id);
      if (c) return { active: c.active, total: c.total, latestName: live?.latestName ?? null, latestDate: live?.latestDate ?? null };
    }
    return live;
  };
  const num = (n: number | undefined) =>
    n ? <span className="font-medium tabular-nums text-stone-900">{n.toLocaleString()}</span> : <span className="tabular-nums text-stone-400">0</span>;
  const driveHref = (r: BrandRow) =>
    r.drive_parent_folder_id ? `https://drive.google.com/drive/folders/${r.drive_parent_folder_id}` : null;
  const portalHref = (r: BrandRow) => (r.portal_token ? `/portal/${r.portal_token}` : null);

  const listParams = { q: q || undefined, archived: showArchived ? "1" : undefined };
  const toggleHref = (() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (!showArchived) p.set("archived", "1");
    const s = p.toString();
    return s ? `/admin/brands?${s}` : "/admin/brands";
  })();

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Every brand Postgame runs campaigns for. Open one for its campaigns, portal and files."
        actions={
          <>
            <ViewToggle listKey="brands" view={view} />
            <Link
              href={toggleHref}
              className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Link>
            <Link
              href="/admin/brands/new"
              className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:brightness-105"
            >
              + Add brand
            </Link>
          </>
        }
      />

      {searchParams.result === "created" && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-900">
          Brand created.
        </div>
      )}

      <form className="pb-4" action="/admin/brands" method="GET">
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search brands"
          className="w-full max-w-sm rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
        />
      </form>

      <AdminTable<BrandRow>
        rows={rows}
        rowKey={(r) => r.id}
        view={view}
        cardDetails={["active", "total"]}
        emptyLabel={q ? "No brands match." : "No brands yet."}
        columns={[
          {
            key: "brand",
            header: "Brand",
            render: (r) => (
              <span className="flex items-center gap-2.5">
                <BrandMark name={r.name} src={r.logo_mark_url ?? r.logo_primary_url ?? null} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <NameLink href={`/admin/brands/${r.id}`}>{r.name ?? "—"}</NameLink>
                    {r.archived && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                        Archived
                      </span>
                    )}
                  </span>
                  {(r.industry || typeById.get(r.id)) && (
                    <span className="block truncate text-[12px] text-stone-500">
                      {[r.industry, typeById.get(r.id)].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </span>
            ),
          },
          {
            key: "drive",
            header: "Drive",
            align: "center",
            render: (r) => {
              const href = driveHref(r);
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  title="Open the brand's Drive folder"
                  className="inline-grid h-[22px] w-[22px] place-items-center rounded-[5px] hover:bg-stone-100"
                >
                  <img src="/icons/google-drive.png" alt="Drive" className="h-[14px] w-[14px]" />
                </a>
              ) : (
                <span className="text-stone-300" title="No Drive folder linked">—</span>
              );
            },
          },
          { key: "active", header: "Active", align: "right", render: (r) => num(act(r)?.active) },
          { key: "total", header: "All campaigns", align: "right", render: (r) => num(act(r)?.total) },
          {
            key: "latest",
            header: "Latest campaign",
            render: (r) => {
              const a = act(r);
              if (!a?.latestName) return <span className="text-stone-400">No campaigns yet</span>;
              return (
                <span className="block min-w-0">
                  <span className="block max-w-[260px] truncate text-stone-800">{a.latestName}</span>
                  {a.latestDate && <span className="block text-[12px] text-stone-500">{formatDate(a.latestDate)}</span>}
                </span>
              );
            },
          },
          {
            key: "portal",
            header: "Portal",
            render: (r) => {
              const href = portalHref(r);
              const state = portalState(portalById.get(r.id), r.portal_token);
              return href ? (
                <span className="inline-flex items-center gap-2">
                  <PortalPill state={state} />
                  <CopyButton value={href} label="Copy link" />
                </span>
              ) : (
                <span className="text-stone-400">No portal yet</span>
              );
            },
          },
        ]}
        mobile={{
          icon: (r) => <BrandMark name={r.name} src={r.logo_mark_url ?? r.logo_primary_url ?? null} />,
          title: (r) => r.name ?? "—",
          href: (r) => `/admin/brands/${r.id}`,
          subtitle: (r) => act(r)?.latestName ?? ([r.industry, typeById.get(r.id)].filter(Boolean).join(" · ") || null),
          strip: (r) => (
            <>
              <PortalPill state={portalState(portalById.get(r.id), r.portal_token)} />
              <span className="text-stone-500">{(act(r)?.total ?? 0).toLocaleString()} campaigns</span>
            </>
          ),
          figure: (r) => <span className="tabular-nums text-stone-900">{(act(r)?.active ?? 0).toLocaleString()} active</span>,
        }}
      />

      <Paginator
        page={page}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/brands"
        params={listParams}
      />
    </div>
  );
}
