// ============================================================
// /admin/athletes — every athlete Postgame tracks, in four levels
// (the approved prototype's S.athletes screen):
//
//   High school · College · Pro · Former & influencers
//
// Source stays `people` (the ColdFusion roster), exactly as before —
// this is a restyle. The level comes from person_type + roster_status
// (see src/lib/admin/athletes.ts for the mapping, read back from
// production). Columns: athlete (initials, name, handle), school,
// sport, followers, campaigns done, Open.
//
// "Campaigns done" counts the recap rosters this person is on
// (`athletes.person_id` → distinct campaign_id). An athlete with no
// linked roster row shows "—": the link is what is missing, not the
// work. Nothing on this page is made up.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import { Card, Pill } from "@/components/admin/campaign/bits";
import { CardFoot, LinkBtn, Note, TabStrip, Tiles, Toolbar, Who, handleText } from "@/components/admin/people/bits";
import {
  ATHLETE_LEVELS,
  INFLUENCER_MIN_FOLLOWERS,
  applyAthleteBase,
  applyAthleteLevel,
  applyAthleteList,
  applyAthleteToolbar,
  buildAthleteListFilters,
  isInfluencer,
  type AthleteLevel,
} from "@/lib/admin/athletes";
import { KNOWN_SPORTS } from "@/lib/team-folders";

export const dynamic = "force-dynamic";

interface AthleteRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  sport: string | null;
  person_type: string | null;
  roster_status: string | null;
  college_raw: string | null;
  college_state: string | null;
  instagram_handle: string | null;
  instagram_followers: number | null;
  colleges: { name: string | null } | null;
}

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));

export default async function AthletesPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const f = buildAthleteListFilters(searchParams);

  // School filter, both paths: canonical ids by name/alias + raw text.
  let collegeIds: number[] = [];
  if (f.school) {
    const [byName, byAlias] = await Promise.all([
      supabase.from("colleges").select("id").ilike("name", `%${f.school}%`).limit(50),
      supabase.from("school_aliases").select("college_id").ilike("alias", `%${f.school}%`).limit(50),
    ]);
    collegeIds = Array.from(
      new Set([
        ...((byName.data ?? []).map((c) => c.id) as number[]),
        ...((byAlias.data ?? []).map((a) => a.college_id).filter(Boolean) as number[]),
      ])
    );
  }

  const head = () => supabase.from("people").select("id", { count: "exact", head: true });
  const { from, to } = pageRange(page);

  const [list, filtered, ...levelCounts] = await Promise.all([
    applyAthleteList(
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, sport, person_type, roster_status, college_raw, college_state, instagram_handle, instagram_followers, colleges(name)"
        ),
      f,
      collegeIds
    )
      .order("instagram_followers", { ascending: false, nullsFirst: false })
      .range(from, to),
    applyAthleteList(head(), f, collegeIds),
    // Tab counts respect the toolbar filters (search / school / sport), not the level.
    ...ATHLETE_LEVELS.map((l) => applyAthleteLevel(applyAthleteToolbar(applyAthleteBase(head()), f, collegeIds), l.key)),
  ]);

  // Tiles: whole-database numbers, independent of the toolbar.
  const [allRes, collegeRes, influencerRes, collegesRes, schoolsRes] = await Promise.all([
    applyAthleteBase(head()),
    applyAthleteLevel(applyAthleteBase(head()), "college"),
    applyAthleteLevel(applyAthleteBase(head()), "former", true),
    supabase.from("colleges").select("id", { count: "exact", head: true }),
    supabase.from("colleges").select("name").order("name").limit(1500),
  ]);

  if (list.error || filtered.error) {
    return (
      <div>
        <PageHeader title="Athletes" />
        <ErrorNote message={(list.error ?? filtered.error)?.message ?? "Query failed"} />
      </div>
    );
  }

  const rows = (list.data ?? []) as unknown as AthleteRow[];
  const total = filtered.count ?? 0;

  // Campaigns done: distinct recap campaigns per linked person.
  const done = new Map<string, number>();
  if (rows.length) {
    const { data: roster } = await supabase
      .from("athletes")
      .select("person_id, campaign_id")
      .in("person_id", rows.map((r) => r.id))
      .limit(5000);
    const seen = new Map<string, Set<string>>();
    for (const r of (roster ?? []) as { person_id: string | null; campaign_id: string | null }[]) {
      if (!r.person_id || !r.campaign_id) continue;
      if (!seen.has(r.person_id)) seen.set(r.person_id, new Set());
      seen.get(r.person_id)!.add(r.campaign_id);
    }
    seen.forEach((set, pid) => done.set(pid, set.size));
  }

  const params = {
    level: f.level !== "college" ? f.level : undefined,
    influencers: f.influencersOnly ? "1" : undefined,
    q: f.q || undefined,
    school: f.school || undefined,
    sport: f.sport || undefined,
  };
  const qs = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...extra })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `?${s}` : "";
  };
  const tabHref = (level: AthleteLevel) => `/admin/athletes${qs({ level: level === "college" ? undefined : level, influencers: undefined, page: undefined })}`;

  const nameOf = (r: AthleteRow) => [r.first_name, r.last_name].filter(Boolean).join(" ") || null;
  const schoolOf = (r: AthleteRow) => r.colleges?.name ?? r.college_raw ?? null;
  const first = total === 0 ? 0 : from + 1;
  const last = Math.min(from + rows.length, total);
  const schoolNames = ((schoolsRes.data ?? []) as { name: string | null }[]).map((c) => c.name).filter((n): n is string => !!n);

  return (
    <div>
      <PageHeader
        title="Athletes"
        subtitle="Every athlete Postgame tracks: college rosters (updated every season), plus high school, pro and former athletes brands may want in a campaign."
        actions={
          <>
            <LinkBtn href={`/admin/athletes/export${qs({ page: undefined })}`} external>
              Export CSV
            </LinkBtn>
            <LinkBtn href="/admin/rosters">Rosters</LinkBtn>
          </>
        }
      />

      <Tiles
        items={[
          { n: fmt(allRes.count), l: "Athletes in the database" },
          { n: fmt(collegeRes.count), l: "On current college rosters", href: "/admin/athletes" },
          { n: fmt(influencerRes.count), l: "Influencers (10K+)", href: "/admin/athletes?level=former&influencers=1" },
          { n: collegesRes.error ? "—" : fmt(collegesRes.count), l: "Colleges in the database", href: "/admin/colleges" },
        ]}
      />

      <Card pad={false}>
        <TabStrip
          current={f.level}
          tabs={ATHLETE_LEVELS.map((l, i) => ({
            key: l.key,
            label: l.label,
            href: tabHref(l.key),
            count: levelCounts[i]?.error ? "—" : fmt(levelCounts[i]?.count ?? 0),
          }))}
        />
        <Toolbar
          action="/admin/athletes"
          placeholder="Search name, handle or school"
          q={f.q}
          hidden={{ level: params.level, influencers: params.influencers }}
          datalist={{ name: "school", label: "School", value: f.school, options: schoolNames, placeholder: "All schools" }}
          selects={[
            {
              name: "sport",
              label: "All sports",
              value: f.sport,
              options: KNOWN_SPORTS.map((s: string) => ({ value: s, label: s })),
            },
          ]}
          right={
            <>
              {f.level === "former" && (
                <LinkBtn href={`/admin/athletes${qs({ influencers: f.influencersOnly ? undefined : "1", page: undefined })}`} small>
                  {f.influencersOnly ? "Showing influencers (10K+) · show all former" : "Influencers (10K+) only"}
                </LinkBtn>
              )}
              <LinkBtn href={`/admin/audiences/new${qs({ page: undefined })}`} small>
                + Make an audience
              </LinkBtn>
            </>
          }
        />

        <div className="p-3 md:p-4">
          <AdminTable<AthleteRow>
            rows={rows}
            rowKey={(r) => r.id}
            emptyLabel={
              f.q || f.school || f.sport
                ? "No athletes match this search on this tab."
                : `No ${ATHLETE_LEVELS.find((l) => l.key === f.level)?.label.toLowerCase()} athletes in the database yet.`
            }
            columns={[
              {
                key: "athlete",
                header: "Athlete",
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <Who name={nameOf(r)} sub={handleText(r.instagram_handle)} href={`/admin/users/${r.id}`} />
                    {isInfluencer(r) && <Pill tone="acc">Influencer</Pill>}
                  </div>
                ),
              },
              { key: "school", header: f.level === "pro" ? "School or team" : "School", render: (r) => schoolOf(r) ?? <span className="text-stone-400">—</span> },
              { key: "sport", header: "Sport", render: (r) => r.sport ?? <span className="text-stone-400">—</span> },
              { key: "followers", header: "Instagram", align: "right", render: (r) => fmt(r.instagram_followers) },
              {
                key: "done",
                header: "Campaigns done",
                align: "right",
                render: (r) => (done.has(r.id) ? String(done.get(r.id)) : <span className="text-stone-400" title="No recap roster linked to this athlete yet">—</span>),
              },
              {
                key: "open",
                header: "",
                align: "right",
                render: (r) => <LinkBtn href={`/admin/users/${r.id}`} small>Open</LinkBtn>,
              },
            ]}
            mobile={{
              title: (r) => nameOf(r) ?? "—",
              href: (r) => `/admin/users/${r.id}`,
              subtitle: (r) => [handleText(r.instagram_handle), schoolOf(r), r.sport].filter(Boolean).join(" · "),
              figure: (r) => fmt(r.instagram_followers),
              strip: (r) => (
                <>
                  {isInfluencer(r) && <Pill tone="acc">Influencer</Pill>}
                  <span className="text-stone-500">{done.has(r.id) ? `${done.get(r.id)} campaigns done` : "No campaigns linked"}</span>
                </>
              ),
            }}
          />
        </div>
        <CardFoot>
          <span>
            {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()} · people table, live
          </span>
          <span>Campaigns done = recap rosters linked to the athlete</span>
        </CardFoot>
      </Card>

      <Paginator page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/athletes" params={params} />

      <Note>
        <b>College</b> athletes come from the seasonal roster scrape. <b>High school</b>, <b>Pro</b> and <b>Former</b> athletes are
        kept so brands can ask for rising stars, pros or alumni in a campaign. <b>Former</b> includes sports influencers: former
        college athletes who kept {INFLUENCER_MIN_FOLLOWERS.toLocaleString()}+ Instagram followers after their playing days. They
        carry an Influencer tag, and the Influencers (10K+) filter shows just them. These are the same groups ColdFusion uses
        (College Athlete, High School Athlete, Professional Athlete, Former College, Former Pro).
      </Note>
      <Note>
        <b>Athletes</b> are everyone on a college roster. Bots scrape school athletics sites each season, so this list stays
        current. <b>App users</b> are the athletes who downloaded the Postgame app and signed up. Only app users can opt in, sign
        contracts and get paid in the app.
      </Note>
    </div>
  );
}
