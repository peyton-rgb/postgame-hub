// ============================================================
// /admin/profiles — Profiles (profiles.cfm rebuilt): the NIL-value
// view of the network. Source: people, NIL-first columns, sorted
// by nil_value. 50/page.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import FilterPopover from "@/components/admin/FilterPopover";
import { KNOWN_SPORTS } from "@/lib/team-folders";

export const dynamic = "force-dynamic";

function money(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const sport = sanitizeFilterValue(searchParams.sport ?? "");
  const gender = sanitizeFilterValue(searchParams.gender ?? "");

  function apply(query: any) {
    query = query
      .eq("is_archived", false)
      .in("person_type", ["Athlete", "Former Athlete"])
      .not("nil_value", "is", null);
    if (q)
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,instagram_handle.ilike.%${q}%`);
    if (sport) query = query.ilike("sport", `%${sport}%`);
    if (gender) query = query.eq("gender", gender);
    return query;
  }

  const { from, to } = pageRange(page);
  const [{ data, error }, { count }] = await Promise.all([
    apply(
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, sport, college_raw, instagram_handle, instagram_followers, tiktok_handle, tiktok_followers, nil_value, rating"
        )
    )
      .order("nil_value", { ascending: false, nullsFirst: false })
      .range(from, to),
    apply(supabase.from("people").select("id", { count: "exact", head: true })),
  ]);

  if (error) {
    return (
      <div>
        <PageHeader title="Profiles" />
        <ErrorNote message={error.message} />
      </div>
    );
  }

  const rows = (data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    sport: string | null;
    college_raw: string | null;
    instagram_handle: string | null;
    instagram_followers: number | null;
    tiktok_handle: string | null;
    tiktok_followers: number | null;
    nil_value: number | null;
    rating: string | null;
  }[];

  return (
    <div>
      <PageHeader
        title="Profiles"
        subtitle={`${(count ?? 0).toLocaleString()} athletes with a NIL valuation`}
      />
      <div className="pb-4">
        <FilterPopover
          fields={[
            { key: "q", label: "Name / handle", type: "text" },
            {
              key: "sport",
              label: "Sport",
              type: "select",
              options: KNOWN_SPORTS.map((s: string) => ({ value: s, label: s })),
            },
            {
              key: "gender",
              label: "Gender",
              type: "select",
              options: [
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
              ],
            },
          ]}
        />
      </div>

      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No NIL profiles match."
        columns={[
          {
            key: "nil",
            header: "NIL Value",
            align: "right",
            render: (r) => <span className="font-semibold tabular-nums">{money(r.nil_value)}</span>,
          },
          {
            key: "name",
            header: "Name",
            render: (r) => (
              <NameLink href={`/admin/users/${r.id}`}>
                {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
              </NameLink>
            ),
          },
          { key: "college", header: "College", render: (r) => r.college_raw ?? "—" },
          { key: "sport", header: "Sport", secondary: true, render: (r) => r.sport ?? "—" },
          {
            key: "ig",
            header: "IG",
            render: (r) =>
              r.instagram_handle
                ? `@${r.instagram_handle.replace(/^@/, "")} (${r.instagram_followers?.toLocaleString() ?? "?"})`
                : "—",
          },
          {
            key: "tt",
            header: "TikTok",
            secondary: true,
            render: (r) =>
              r.tiktok_handle
                ? `@${r.tiktok_handle.replace(/^@/, "")} (${r.tiktok_followers?.toLocaleString() ?? "?"})`
                : "—",
          },
          { key: "rating", header: "Rating", align: "center", render: (r) => r.rating ?? "—" },
        ]}
        mobile={{
          title: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
          href: (r) => `/admin/users/${r.id}`,
          subtitle: (r) => [r.college_raw, r.sport].filter(Boolean).join(" · "),
          figure: (r) => money(r.nil_value),
        }}
      />

      <Paginator
        page={page}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/profiles"
        params={{ q: q || undefined, sport: sport || undefined, gender: gender || undefined }}
      />
    </div>
  );
}
