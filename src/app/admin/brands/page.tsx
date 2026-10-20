// ============================================================
// /admin/brands — Brands list (the Lovable admin's "Accounts",
// restyled to the approved Hub prototype). Source: brands.
//
// Each row: logo mark + name + industry, account type, campaigns
// (active / all, from the blended `campaigns` table), portal
// status, created date. Name opens the brand detail page.
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
          "id, admin_brand_id, name, industry, website, archived, created_at, portal_token, logo_primary_url, logo_mark_url"
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
  const [typeRes, campRes, portalRes] = ids.length
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
      ])
    : [
        { data: null, pending: true, error: null },
        { data: null, pending: true, error: null },
        { data: null, pending: true, error: null },
      ];

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

  const campaignsCell = (r: BrandRow) => {
    if (campRes.pending || campRes.error) {
      return (
        <span className="text-stone-400" title="Campaign counts arrive with migration 083.">
          —
        </span>
      );
    }
    const c = campaignsById.get(r.id) ?? { active: 0, total: 0 };
    if (c.total === 0) return <span className="text-stone-400">—</span>;
    return (
      <span className="tabular-nums" title={`${c.active} active of ${c.total} campaigns`}>
        <span className="font-medium text-stone-900">{c.active.toLocaleString()}</span>
        <span className="text-stone-400"> / {c.total.toLocaleString()}</span>
      </span>
    );
  };

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
        cardDetails={["type", "campaigns"]}
        emptyLabel={q ? "No brands match." : "No brands yet."}
        columns={[
          {
            key: "brand",
            header: "Brand",
            render: (r) => (
              <span className="flex items-center gap-2.5">
                <BrandMark
                  name={r.name}
                  src={r.logo_mark_url ?? r.logo_primary_url ?? null}
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <NameLink href={`/admin/brands/${r.id}`}>{r.name ?? "—"}</NameLink>
                    {r.archived && (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                        Archived
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[12px] text-stone-500">{r.industry ?? "—"}</span>
                </span>
              </span>
            ),
          },
          {
            key: "type",
            header: (
              <span title={typeRes.pending ? "Account types arrive with migration 083." : undefined}>
                Type
              </span>
            ),
            secondary: true,
            render: (r) => {
              const t = typeById.get(r.id);
              return t ? <span className="text-stone-700">{t}</span> : <span className="text-stone-400">—</span>;
            },
          },
          {
            key: "campaigns",
            header: "Campaigns",
            align: "right",
            render: campaignsCell,
          },
          {
            key: "portal",
            header: "Portal",
            align: "center",
            render: (r) => <PortalPill state={portalState(portalById.get(r.id), r.portal_token)} />,
          },
          {
            key: "created",
            header: "Created",
            align: "right",
            secondary: true,
            render: (r) => <span className="text-stone-500">{formatDate(r.created_at)}</span>,
          },
        ]}
        mobile={{
          icon: (r) => <BrandMark name={r.name} src={r.logo_mark_url ?? r.logo_primary_url ?? null} />,
          title: (r) => r.name ?? "—",
          href: (r) => `/admin/brands/${r.id}`,
          subtitle: (r) => [r.industry, typeById.get(r.id)].filter(Boolean).join(" · ") || null,
          strip: (r) => (
            <>
              <PortalPill state={portalState(portalById.get(r.id), r.portal_token)} />
              <span className="text-stone-500">{campaignsCell(r)} campaigns</span>
            </>
          ),
          figure: (r) => <span className="text-stone-500">{formatDate(r.created_at)}</span>,
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
