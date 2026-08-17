// ============================================================
// /admin/colleges — Colleges admin (colleges.cfm rebuilt).
// Lists the freshly seeded canonical colleges (1,190) with alias
// counts from school_aliases (334 seeded). Search + 50/page.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

interface CollegeRow {
  id: number;
  name: string | null;
  short_name: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  is_active: boolean | null;
  ncaa_division: string | null;
}

export default async function CollegesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");

  function apply(query: any) {
    if (q) query = query.or(`name.ilike.%${q}%,short_name.ilike.%${q}%,city.ilike.%${q}%`);
    return query;
  }

  const { from, to } = pageRange(page);
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    apply(
      supabase
        .from("colleges")
        .select("id, name, short_name, city, state, website, is_active, ncaa_division")
    )
      .order("name")
      .range(from, to),
    apply(supabase.from("colleges").select("id", { count: "exact", head: true })),
  ]);

  if (error || countError) {
    return (
      <div>
        <PageHeader title="Colleges" />
        <ErrorNote message={(error ?? countError)?.message ?? "Query failed"} />
      </div>
    );
  }
  const rows = (data ?? []) as CollegeRow[];

  // Alias counts for just this page of colleges.
  const ids = rows.map((r) => r.id);
  const { data: aliasRows } = ids.length
    ? await supabase.from("school_aliases").select("college_id").in("college_id", ids)
    : { data: [] as { college_id: number | null }[] };
  const aliasCounts = new Map<number, number>();
  for (const a of aliasRows ?? []) {
    if (a.college_id != null)
      aliasCounts.set(a.college_id, (aliasCounts.get(a.college_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Colleges"
        subtitle={`${(count ?? 0).toLocaleString()} canonical colleges · aliases map raw import strings onto them`}
        actions={
          <Link
            href="/admin/colleges/mapper"
            className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407]"
          >
            Alias mapper
          </Link>
        }
      />

      <form className="pb-4" action="/admin/colleges" method="GET">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, short name, or city"
          className="w-full max-w-sm rounded-md border border-stone-300 px-3 py-1.5 text-[13px]"
        />
      </form>

      <AdminTable<CollegeRow>
        rows={rows}
        rowKey={(r) => String(r.id)}
        emptyLabel="No colleges match."
        columns={[
          { key: "id", header: "ID", render: (r) => <span className="text-stone-500 tabular-nums">{r.id}</span> },
          {
            key: "name",
            header: "Name",
            render: (r) => (
              <NameLink href={`/admin/colleges/${r.id}/edit`}>{r.name ?? "—"}</NameLink>
            ),
          },
          { key: "short", header: "Short", secondary: true, render: (r) => r.short_name ?? "—" },
          {
            key: "citystate",
            header: "City / State",
            render: (r) => [r.city, r.state].filter(Boolean).join(", ") || "—",
          },
          { key: "div", header: "Division", secondary: true, render: (r) => r.ncaa_division ?? "—" },
          {
            key: "aliases",
            header: "Aliases",
            align: "center",
            render: (r) => <span className="tabular-nums">{aliasCounts.get(r.id) ?? 0}</span>,
          },
          {
            key: "active",
            header: "Active",
            align: "center",
            render: (r) =>
              r.is_active ? (
                <span className="text-green-600 font-semibold">✓</span>
              ) : (
                <span className="text-stone-400">—</span>
              ),
          },
        ]}
        mobile={{
          title: (r) => r.name ?? "—",
          href: (r) => `/admin/colleges/${r.id}/edit`,
          subtitle: (r) => [r.city, r.state].filter(Boolean).join(", "),
          figure: (r) => `${aliasCounts.get(r.id) ?? 0} aliases`,
        }}
      />

      <Paginator
        page={page}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/colleges"
        params={{ q: q || undefined }}
      />
    </div>
  );
}
