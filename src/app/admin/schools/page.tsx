// ============================================================
// /admin/schools — Schools & teams (prototype S.schools and
// S["schools-teams"]). Replaces the old /admin/colleges list
// (which now redirects here); editing a college and the alias
// mapper keep their existing routes under /admin/colleges.
//   default tab   — colleges (live table), search + status, 50/page
//   ?tab=teams    — teams ranked by NIL value (teams, migration 083)
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange, safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import { CardFoot, TablePending, Toolbar } from "@/components/admin/ops-bits";
import { Pill } from "@/components/admin/campaign/bits";
import { Dim, SimpleTable, TabbedCard, btnCls } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

interface CollegeRow {
  id: number;
  name: string | null;
  short_name: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean | null;
  ncaa_division: string | null;
}

interface TeamRow {
  team_id: number;
  team_name: string | null;
  college_id: number | null;
  sport_id: number | null;
  gender: string | null;
  nil_value: number | null;
  instagram_followers: number | null;
}

export default async function SchoolsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const tab = searchParams.tab === "teams" ? "teams" : "colleges";
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const status = searchParams.status === "active" || searchParams.status === "inactive" ? searchParams.status : "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const { count: collegeTotal } = await supabase.from("colleges").select("id", { count: "exact", head: true });

  const actions = (
    <Link href="/admin/colleges/mapper" className={btnCls}>
      Alias mapper
    </Link>
  );

  const tabs = [
    { href: "/admin/schools", label: "Colleges", count: collegeTotal ?? null, active: tab === "colleges" },
    { href: "/admin/schools?tab=teams", label: "Teams", active: tab === "teams" },
  ];

  if (tab === "teams") {
    const res = await safeQuery<TeamRow[]>(() => {
      let query = supabase
        .from("teams")
        .select("team_id, team_name, college_id, sport_id, gender, nil_value, instagram_followers")
        .order("nil_value", { ascending: false, nullsFirst: false })
        .limit(100);
      if (q) query = query.ilike("team_name", `%${q}%`);
      return query;
    });
    const rows = res.data ?? [];
    const collegeIds = Array.from(new Set(rows.map((r) => r.college_id).filter((x): x is number => x != null)));
    const sportIds = Array.from(new Set(rows.map((r) => r.sport_id).filter((x): x is number => x != null)));
    const [colRes, sportRes] = await Promise.all([
      collegeIds.length ? supabase.from("colleges").select("id, name").in("id", collegeIds) : Promise.resolve({ data: [] as any[] }),
      sportIds.length
        ? safeQuery<{ sport_id: number; sport: string | null }[]>(() => supabase.from("sports").select("sport_id, sport").in("sport_id", sportIds))
        : Promise.resolve({ data: [] as { sport_id: number; sport: string | null }[] }),
    ]);
    const colName = new Map<number, string>(((colRes.data ?? []) as { id: number; name: string }[]).map((c) => [c.id, c.name]));
    const sportName = new Map<number, string>(((sportRes.data ?? []) as { sport_id: number; sport: string | null }[]).map((s) => [s.sport_id, s.sport ?? ""]));

    return (
      <div>
        <PageHeader title="Schools & teams" subtitle="The colleges athletes pick from, and teams ranked by NIL value." actions={actions} />
        <TabbedCard tabs={tabs}>
          {res.pending ? (
            <TablePending table="teams" feature="Top teams by combined NIL value" />
          ) : res.error ? (
            <div className="p-4"><ErrorNote message={res.error} /></div>
          ) : (
            <>
              <Toolbar action="/admin/schools" placeholder="Search teams" q={q} hidden={{ tab: "teams" }} />
              <SimpleTable
                rows={rows}
                rowKey={(t) => String(t.team_id)}
                empty="No teams yet."
                cols={[
                  { h: "#", r: (t) => <Dim>{rows.indexOf(t) + 1}</Dim> },
                  {
                    h: "Team",
                    r: (t) => (
                      <span className="font-medium text-stone-900">
                        {t.team_name ?? (t.college_id != null ? colName.get(t.college_id) : null) ?? "—"}
                      </span>
                    ),
                  },
                  { h: "Sport", r: (t) => (t.sport_id != null ? sportName.get(t.sport_id) : null) || <Dim>—</Dim> },
                  {
                    h: "Instagram followers",
                    num: true,
                    r: (t) => (t.instagram_followers != null ? t.instagram_followers.toLocaleString() : <Dim>—</Dim>),
                  },
                  {
                    h: "NIL value",
                    num: true,
                    r: (t) =>
                      t.nil_value != null ? (
                        Number(t.nil_value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
                      ) : (
                        <Dim>—</Dim>
                      ),
                  },
                ]}
              />
              <CardFoot>
                <span>Top {rows.length} teams by NIL value</span>
              </CardFoot>
            </>
          )}
        </TabbedCard>
      </div>
    );
  }

  // ---- Colleges tab ----
  function apply(query: any) {
    if (q) query = query.or(`name.ilike.%${q}%,short_name.ilike.%${q}%,city.ilike.%${q}%`);
    if (status === "active") query = query.eq("is_active", true);
    if (status === "inactive") query = query.or("is_active.is.null,is_active.eq.false");
    return query;
  }
  const { from, to } = pageRange(page);
  const [{ data, error }, { count }] = await Promise.all([
    apply(supabase.from("colleges").select("id, name, short_name, city, state, is_active, ncaa_division")).order("name").range(from, to),
    apply(supabase.from("colleges").select("id", { count: "exact", head: true })),
  ]);
  const rows = (data ?? []) as CollegeRow[];

  const ids = rows.map((r) => r.id);
  const { data: aliasRows } = ids.length
    ? await supabase.from("school_aliases").select("college_id").in("college_id", ids)
    : { data: [] as { college_id: number | null }[] };
  const aliasCounts = new Map<number, number>();
  for (const a of (aliasRows ?? []) as { college_id: number | null }[]) {
    if (a.college_id != null) aliasCounts.set(a.college_id, (aliasCounts.get(a.college_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader title="Schools & teams" subtitle="The colleges athletes pick from, and teams ranked by NIL value." actions={actions} />
      <TabbedCard tabs={tabs}>
        <Toolbar
          action="/admin/schools"
          placeholder="Search colleges"
          q={q}
          selects={[
            {
              name: "status",
              label: "Status",
              value: status,
              options: [
                { value: "", label: "Any status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
            },
          ]}
        />
        {error ? (
          <div className="p-4"><ErrorNote message={error.message} /></div>
        ) : (
          <SimpleTable
            rows={rows}
            rowKey={(c) => String(c.id)}
            empty="No colleges match."
            cols={[
              {
                h: "College",
                r: (c) => (
                  <Link href={`/admin/colleges/${c.id}/edit`} className="font-medium text-stone-900 hover:underline">
                    {c.name ?? "—"}
                  </Link>
                ),
              },
              { h: "City", r: (c) => c.city || <Dim>—</Dim> },
              { h: "State", r: (c) => c.state || <Dim>—</Dim> },
              { h: "Division", r: (c) => c.ncaa_division || <Dim>—</Dim> },
              { h: "Aliases", num: true, r: (c) => aliasCounts.get(c.id) ?? 0 },
              { h: "Status", r: (c) => (c.is_active ? <Pill tone="ok">Active</Pill> : <Pill>Inactive</Pill>) },
            ]}
          />
        )}
        <div className="border-t border-stone-200 px-3">
          <Paginator
            page={page}
            total={count ?? 0}
            pageSize={PAGE_SIZE}
            basePath="/admin/schools"
            params={{ q: q || undefined, status: status || undefined }}
          />
        </div>
      </TabbedCard>
    </div>
  );
}
