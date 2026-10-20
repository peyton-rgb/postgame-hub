// ============================================================
// /admin/profiles — Profiles (the prototype's S.profiles; CF
// profiles.cfm): college-athlete social profiles ranked by NIL value.
//
// Source: `people` rows with a NIL value (same query as before, now
// in the house card/table layout). The full scraped profile table
// (CF `profiles` → `athlete_profiles`) arrives with migration 083;
// the foot says which source is showing. 50/page.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange, sanitizeFilterValue } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";
import { Card } from "@/components/admin/campaign/bits";
import { Avatar, CardFoot, LinkBtn, Toolbar, Who, fmtCount, fmtUsd, handleText } from "@/components/admin/people/bits";
import { FOLLOWER_FLOORS, GENDER_OPTIONS } from "@/lib/admin/athletes";
import { KNOWN_SPORTS } from "@/lib/team-folders";

export const dynamic = "force-dynamic";

interface ProfileRow {
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
  colleges: { name: string | null } | null;
}

const UPDATED = [
  { value: "7", label: "Updated this week" },
  { value: "30", label: "Updated in 30 days" },
  { value: "90", label: "Updated in 90 days" },
];

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const view = getListView("profiles", searchParams);
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const q = sanitizeFilterValue(searchParams.q ?? "");
  const school = sanitizeFilterValue(searchParams.school ?? "");
  const sport = sanitizeFilterValue(searchParams.sport ?? "");
  const genderRaw = sanitizeFilterValue(searchParams.gender ?? "");
  const gender = GENDER_OPTIONS.some((g) => g.value === genderRaw) ? genderRaw : "";
  const min = /^\d+$/.test(searchParams.min ?? "") ? searchParams.min! : "";
  const updated = UPDATED.some((u) => u.value === searchParams.updated) ? searchParams.updated! : "";

  function apply(query: any) {
    query = query
      .eq("is_archived", false)
      .in("person_type", ["Athlete", "Former Athlete"])
      .not("nil_value", "is", null);
    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,instagram_handle.ilike.%${q}%`);
    if (school) query = query.ilike("college_raw", `%${school}%`);
    if (sport) query = query.ilike("sport", `%${sport}%`);
    if (gender) query = query.eq("gender", gender);
    if (min) query = query.gte("instagram_followers", parseInt(min, 10));
    if (updated) query = query.gte("nil_value_synced_at", new Date(Date.now() - Number(updated) * 86400000).toISOString());
    return query;
  }

  const { from, to } = pageRange(page);
  const [{ data, error }, { count }, schoolsRes] = await Promise.all([
    apply(
      supabase
        .from("people")
        .select("id, first_name, last_name, sport, college_raw, instagram_handle, instagram_followers, tiktok_handle, tiktok_followers, nil_value, colleges(name)")
    )
      .order("nil_value", { ascending: false, nullsFirst: false })
      .range(from, to),
    apply(supabase.from("people").select("id", { count: "exact", head: true })),
    supabase.from("colleges").select("name").order("name").limit(1500),
  ]);

  if (error) {
    return (
      <div>
        <PageHeader title="Profiles" />
        <ErrorNote message={error.message} />
      </div>
    );
  }

  const rows = ((data ?? []) as unknown as ProfileRow[]).map((r, i) => ({ ...r, rank: from + i + 1 }));
  const total = count ?? 0;
  const params = {
    q: q || undefined,
    school: school || undefined,
    sport: sport || undefined,
    gender: gender || undefined,
    min: min || undefined,
    updated: updated || undefined,
  };
  const nameOf = (r: ProfileRow) => [r.first_name, r.last_name].filter(Boolean).join(" ") || null;
  const schoolOf = (r: ProfileRow) => r.colleges?.name ?? r.college_raw ?? null;
  const schoolNames = ((schoolsRes.data ?? []) as { name: string | null }[]).map((c) => c.name).filter((n): n is string => !!n);
  const dim = (v: string | null) => v ?? <span className="text-stone-400">—</span>;

  return (
    <div>
      <PageHeader
        title="Profiles"
        subtitle="College-athlete social profiles, ranked by NIL value."
        actions={<LinkBtn href="/admin/profiles/upload">+ Add from Instagram handle</LinkBtn>}
      />

      <Card pad={false}>
        <Toolbar
          action="/admin/profiles"
          placeholder="Search profiles"
          q={q}
          datalist={{ name: "school", label: "College", value: school, options: schoolNames, placeholder: "All colleges" }}
          selects={[
            { name: "sport", label: "All sports", value: sport, options: KNOWN_SPORTS.map((s: string) => ({ value: s, label: s })) },
            { name: "gender", label: "Any gender", value: gender, options: GENDER_OPTIONS },
            {
              name: "min",
              label: "Any followers",
              value: min,
              options: FOLLOWER_FLOORS.map((n) => ({ value: String(n), label: `${n.toLocaleString("en-US")}+ followers` })),
            },
            { name: "updated", label: "Updated any time", value: updated, options: UPDATED },
          ]}
          right={<ViewToggle listKey="profiles" view={view} />}
        />
        <div className="p-3 md:p-4">
          <AdminTable<ProfileRow & { rank: number }>
            rows={rows}
            rowKey={(r) => r.id}
            view={view}
            cardDetails={["ig", "tt", "college", "sport"]}
            emptyLabel="No profiles match."
            columns={[
              { key: "rank", header: "#", render: (r) => <span className="tabular-nums text-stone-400">{r.rank.toLocaleString()}</span> },
              {
                key: "athlete",
                header: "Athlete",
                render: (r) => <Who name={nameOf(r)} sub={handleText(r.instagram_handle)} href={`/admin/profiles/${r.id}`} />,
              },
              { key: "college", header: "College", render: (r) => dim(schoolOf(r)) },
              { key: "sport", header: "Sport", render: (r) => dim(r.sport) },
              { key: "ig", header: "Instagram", align: "right", render: (r) => fmtCount(r.instagram_followers) },
              { key: "tt", header: "TikTok", align: "right", secondary: true, render: (r) => fmtCount(r.tiktok_followers) },
              { key: "nil", header: "NIL value", align: "right", render: (r) => <span className="font-semibold">{fmtUsd(r.nil_value)}</span> },
            ]}
            mobile={{
              icon: (r) => <Avatar name={nameOf(r)} />,
              title: (r) => `${r.rank}. ${nameOf(r) ?? "—"}`,
              href: (r) => `/admin/profiles/${r.id}`,
              subtitle: (r) => [handleText(r.instagram_handle), schoolOf(r), r.sport].filter(Boolean).join(" · "),
              figure: (r) => fmtUsd(r.nil_value),
              strip: view === "cards" ? undefined : (r) => <span className="text-stone-500">{fmtCount(r.instagram_followers)} Instagram followers</span>,
            }}
          />
        </div>
        <CardFoot>
          <span>
            {total.toLocaleString()} profiles with a NIL value · people table, live. The full scraped profile list joins with
            migration 083.
          </span>
        </CardFoot>
      </Card>

      <Paginator page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/profiles" params={params} />
    </div>
  );
}
