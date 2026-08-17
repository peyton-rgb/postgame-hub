// ============================================================
// /admin/brands — Brands / Accounts list (accounts.cfm rebuilt).
// Source: brands (130 rows). Logos always render from the brand
// row's logo columns — never typed as text.
// ============================================================

/* eslint-disable @next/next/no-img-element */
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

interface BrandRow {
  id: string;
  admin_brand_id: string | null;
  name: string | null;
  industry: string | null;
  website: string | null;
  archived: boolean | null;
  created_at: string | null;
  logo_primary_url: string | null;
  logo_mark_url: string | null;
}

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
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
        .select("id, admin_brand_id, name, industry, website, archived, created_at, logo_primary_url, logo_mark_url")
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

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle={`${(count ?? 0).toLocaleString()} ${showArchived ? "brands (incl. archived)" : "active brands"}`}
        actions={
          <a
            href={showArchived ? "/admin/brands" : "/admin/brands?archived=1"}
            className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </a>
        }
      />

      <form className="pb-4" action="/admin/brands" method="GET">
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search brand name"
          className="w-full max-w-sm rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
        />
      </form>

      <AdminTable<BrandRow>
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No brands match."
        columns={[
          {
            key: "id",
            header: "ID",
            render: (r) => <span className="text-stone-500">{r.admin_brand_id ?? r.id.slice(0, 8)}</span>,
          },
          {
            key: "name",
            header: "Brand",
            render: (r) => (
              <span className="inline-flex items-center gap-2">
                {(r.logo_mark_url || r.logo_primary_url) && (
                  <img
                    src={r.logo_mark_url ?? r.logo_primary_url ?? ""}
                    alt=""
                    className="h-5 w-5 rounded object-contain"
                  />
                )}
                <NameLink href={`/admin/brands/${r.id}/edit`}>{r.name ?? "—"}</NameLink>
                {r.archived && <span className="text-[11px] text-stone-400">archived</span>}
              </span>
            ),
          },
          { key: "industry", header: "Industry", render: (r) => r.industry ?? "—" },
          {
            key: "website",
            header: "Website",
            secondary: true,
            render: (r) =>
              r.website ? (
                <a className="text-[#D73F09] hover:underline" href={r.website} target="_blank" rel="noreferrer">
                  {r.website.replace(/^https?:\/\//, "").slice(0, 30)}
                </a>
              ) : (
                "—"
              ),
          },
          {
            key: "created",
            header: "Created On",
            secondary: true,
            render: (r) => <span className="text-stone-500">{formatDate(r.created_at)}</span>,
          },
        ]}
        mobile={{
          title: (r) => r.name ?? "—",
          href: (r) => `/admin/brands/${r.id}/edit`,
          subtitle: (r) => r.industry ?? "",
        }}
      />

      <Paginator
        page={page}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/brands"
        params={{ q: q || undefined, archived: showArchived ? "1" : undefined }}
      />
    </div>
  );
}
