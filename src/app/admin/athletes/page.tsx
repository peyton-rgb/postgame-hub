// ============================================================
// /admin/athletes — Athlete Search (CF user_profiles.cfm +
// profiles.cfm consolidated into ONE search, per the locked scope).
//
// Source: people (46k+ with college_raw), joined to colleges via
// college_id where populated (2,895 linked via athletes.person_id;
// the people.college_id backfill is a separate GATED job — so this
// screen codes BOTH paths: canonical college name when linked,
// college_raw text fallback when not).
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable, { NameLink } from "@/components/admin/AdminTable";
import FilterPopover from "@/components/admin/FilterPopover";
import { KNOWN_SPORTS } from "@/lib/team-folders";

export const dynamic = "force-dynamic";

const FOLLOWER_TIERS: Record<string, { min: number | null; max: number | null; label: string }> = {
  "1m": { min: 1_000_000, max: null, label: "1M+" },
  "100k": { min: 100_000, max: 1_000_000, label: "100K–1M" },
  "10k": { min: 10_000, max: 100_000, label: "10K–100K" },
  "1k": { min: 1_000, max: 10_000, label: "1K–10K" },
  under1k: { min: 0, max: 1_000, label: "Under 1K" },
};

interface AthleteRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  sport: string | null;
  gender: string | null;
  rating: string | null;
  college_raw: string | null;
  college_state: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
  colleges: { name: string | null } | null;
}

export default async function AthleteSearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const sport = sanitizeFilterValue(searchParams.sport ?? "");
  const college = sanitizeFilterValue(searchParams.college ?? "");
  const gender = sanitizeFilterValue(searchParams.gender ?? "");
  const tierKey = searchParams.tier && FOLLOWER_TIERS[searchParams.tier] ? searchParams.tier : "";

  // College filter, both paths: canonical ids by name/alias + raw text.
  let collegeIds: number[] = [];
  if (college) {
    const [byName, byAlias] = await Promise.all([
      supabase.from("colleges").select("id").ilike("name", `%${college}%`).limit(50),
      supabase.from("school_aliases").select("college_id").ilike("alias", `%${college}%`).limit(50),
    ]);
    collegeIds = Array.from(
      new Set(
        [
          ...((byName.data ?? []).map((c) => c.id) as number[]),
          ...((byAlias.data ?? []).map((a) => a.college_id).filter(Boolean) as number[]),
        ]
      )
    );
  }

  function apply(query: any) {
    query = query.eq("is_archived", false).in("person_type", ["Athlete", "Former Athlete"]);
    if (q) {
      query = query.or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,instagram_handle.ilike.%${q}%`
      );
    }
    if (sport) query = query.ilike("sport", `%${sport}%`);
    if (gender) query = query.eq("gender", gender);
    if (tierKey) {
      const tier = FOLLOWER_TIERS[tierKey];
      if (tier.min != null) query = query.gte("instagram_followers", tier.min);
      if (tier.max != null) query = query.lt("instagram_followers", tier.max);
    }
    if (college) {
      const terms = [`college_raw.ilike.%${college}%`];
      if (collegeIds.length) terms.push(`college_id.in.(${collegeIds.join(",")})`);
      query = query.or(terms.join(","));
    }
    return query;
  }

  const { from, to } = pageRange(page);
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    apply(
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, sport, gender, rating, college_raw, college_state, instagram_handle, instagram_followers, colleges(name)"
        )
    )
      .order("instagram_followers", { ascending: false, nullsFirst: false })
      .range(from, to),
    apply(supabase.from("people").select("id", { count: "exact", head: true })),
  ]);

  if (error || countError) {
    return (
      <div>
        <PageHeader title="Athlete Search" />
        <ErrorNote message={(error ?? countError)?.message ?? "Query failed"} />
      </div>
    );
  }

  const rows = (data ?? []) as unknown as AthleteRow[];
  const params = {
    q: q || undefined,
    sport: sport || undefined,
    college: college || undefined,
    gender: gender || undefined,
    tier: tierKey || undefined,
  };

  const collegeOf = (r: AthleteRow) => r.colleges?.name ?? r.college_raw ?? "—";

  return (
    <div>
      <PageHeader
        title="Athlete Search"
        subtitle={`${(count ?? 0).toLocaleString()} matching athletes · canonical college when linked, raw text fallback otherwise`}
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
            { key: "college", label: "College", type: "text", placeholder: "Name or alias" },
            {
              key: "gender",
              label: "Gender",
              type: "select",
              options: [
                { value: "Male", label: "Male" },
                { value: "Female", label: "Female" },
              ],
            },
            {
              key: "tier",
              label: "Followers",
              type: "select",
              options: Object.entries(FOLLOWER_TIERS).map(([value, t]) => ({
                value,
                label: t.label,
              })),
            },
          ]}
        />
      </div>

      <AdminTable<AthleteRow>
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No athletes match this search."
        columns={[
          {
            key: "name",
            header: "Name",
            render: (r) => (
              <NameLink href={`/admin/users/${r.id}`}>
                {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
              </NameLink>
            ),
          },
          { key: "sport", header: "Sport", render: (r) => r.sport ?? "—" },
          { key: "college", header: "College", render: (r) => collegeOf(r) },
          { key: "state", header: "State", secondary: true, render: (r) => r.college_state ?? "—" },
          {
            key: "ig",
            header: "IG",
            render: (r) =>
              r.instagram_handle ? (
                <a
                  className="text-[#D73F09] hover:underline"
                  href={`https://instagram.com/${r.instagram_handle.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  @{r.instagram_handle.replace(/^@/, "")}
                </a>
              ) : (
                "—"
              ),
          },
          {
            key: "followers",
            header: "Followers",
            align: "right",
            render: (r) => r.instagram_followers?.toLocaleString() ?? "—",
          },
          { key: "rating", header: "Rating", align: "center", render: (r) => r.rating ?? "—" },
        ]}
        mobile={{
          title: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
          href: (r) => `/admin/users/${r.id}`,
          subtitle: (r) => [collegeOf(r), r.sport].filter(Boolean).join(" · "),
          figure: (r) => r.instagram_followers?.toLocaleString() ?? "",
        }}
      />

      <Paginator
        page={page}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        basePath="/admin/athletes"
        params={params}
      />
    </div>
  );
}
