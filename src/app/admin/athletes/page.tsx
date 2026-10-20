// ============================================================
// /admin/athletes — every athlete Postgame tracks (the approved
// prototype's last S.athletes): tabs All · College · High school ·
// Pro · Former & influencers, a pick column with a pick bar
// (→ audience or CSV), and the Level / School or team / Sport /
// Instagram / NIL value / Postgame app columns.
//
// Source stays `people` (the ColdFusion user roster) — NOT `athletes`
// (recap roster rows) and NOT `athletes_master` (never populated).
// The level comes from person_type + roster_status (see
// src/lib/admin/athletes.ts). "Postgame app" = the CF user record has
// a device on file; the column shows the device itself.
//
// The scraped roster profiles (CF `profiles`, 64,000+) arrive as
// `athlete_profiles` with migration 083; until then this list is the
// people table only, and the foot says so.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";
import { Card } from "@/components/admin/campaign/bits";
import {
  AppPill,
  CardFoot,
  LevelPill,
  LinkBtn,
  Note,
  TabStrip,
  Tiles,
  Toolbar,
  Who,
  fmtCount,
  fmtUsd,
  handleText,
} from "@/components/admin/people/bits";
import PickBar, { PickAll, PickBox } from "@/components/admin/people/PickBar";
import {
  ATHLETE_TABS,
  FOLLOWER_FLOORS,
  GENDER_OPTIONS,
  INFLUENCER_MIN_FOLLOWERS,
  applyAthleteBase,
  applyAthleteLevel,
  applyAthleteList,
  applyAthleteToolbar,
  buildAthleteListFilters,
  type AthleteTab,
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
  nil_value: number | null;
  device: string | null;
  colleges: { name: string | null } | null;
}

const US_STATES = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");

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

  const [list, filtered, ...tabCounts] = await Promise.all([
    applyAthleteList(
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, sport, person_type, roster_status, college_raw, college_state, instagram_handle, instagram_followers, nil_value, device, colleges(name)"
        ),
      f,
      collegeIds
    )
      .order("instagram_followers", { ascending: false, nullsFirst: false })
      .range(from, to),
    applyAthleteList(head(), f, collegeIds),
    // Tab counts respect the toolbar filters, not the tab.
    ...ATHLETE_TABS.map((t) =>
      applyAthleteLevel(applyAthleteToolbar(applyAthleteBase(head()), f, collegeIds), t.key, f.influencersOnly)
    ),
  ]);

  // Tiles: whole-database numbers, independent of the toolbar.
  const [allRes, collegeRes, appRes, collegesRes, schoolsRes] = await Promise.all([
    applyAthleteBase(head()),
    applyAthleteLevel(applyAthleteBase(head()), "college"),
    applyAthleteBase(head()).not("device", "is", null),
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

  const params: Record<string, string | undefined> = {
    level: f.level !== "all" ? f.level : undefined,
    influencers: f.influencersOnly ? "1" : undefined,
    app: f.app || undefined,
    q: f.q || undefined,
    school: f.school || undefined,
    sport: f.sport || undefined,
    gender: f.gender || undefined,
    state: f.state || undefined,
    min: f.minFollowers != null ? String(f.minFollowers) : undefined,
  };
  const qs = (extra: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...extra })) if (v) u.set(k, v);
    const s = u.toString();
    return s ? `?${s}` : "";
  };
  const tabHref = (t: AthleteTab) => `/admin/athletes${qs({ level: t === "all" ? undefined : t, page: undefined })}`;

  // The same filters, as audience-builder params ("Make an audience" starts from what's on).
  const aud = new URLSearchParams();
  aud.set("levels", f.level === "all" ? "college|high_school|pro|former" : f.level);
  if (f.influencersOnly) aud.set("influencers", "1");
  if (f.app) aud.set("include", f.app === "yes" ? "app" : "noapp");
  if (f.sport) aud.set("sport", f.sport);
  if (f.school) aud.set("college", f.school);
  if (f.gender) aud.set("gender", f.gender);
  if (f.state) aud.set("state", f.state);
  if (f.minFollowers != null) aud.set("min", String(f.minFollowers));
  const audienceHref = `/admin/audiences/new?${aud.toString()}`;

  const nameOf = (r: AthleteRow) => [r.first_name, r.last_name].filter(Boolean).join(" ") || null;
  const schoolOf = (r: AthleteRow) => r.colleges?.name ?? r.college_raw ?? null;
  const first = total === 0 ? 0 : from + 1;
  const last = Math.min(from + rows.length, total);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const schoolNames = ((schoolsRes.data ?? []) as { name: string | null }[]).map((c) => c.name).filter((n): n is string => !!n);
  const dim = (v: string | null) => v ?? <span className="text-stone-400">—</span>;

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
          { n: fmtCount(allRes.count), l: "Athletes in the database" },
          { n: fmtCount(collegeRes.count), l: "On current college rosters", href: "/admin/athletes?level=college" },
          { n: fmtCount(appRes.count), l: "Have the app", href: "/admin/athletes?app=yes" },
          { n: collegesRes.error ? "—" : fmtCount(collegesRes.count), l: "Colleges", href: "/admin/colleges" },
        ]}
      />

      <Card pad={false}>
        <TabStrip
          current={f.level}
          tabs={ATHLETE_TABS.map((t, i) => ({
            key: t.key,
            label: t.label,
            href: tabHref(t.key),
            count: tabCounts[i]?.error ? "—" : fmtCount(tabCounts[i]?.count ?? 0),
          }))}
        />
        <Toolbar
          action="/admin/athletes"
          placeholder="Search name, handle, school or team"
          q={f.q}
          hidden={{ level: params.level }}
          datalist={{ name: "school", label: "School", value: f.school, options: schoolNames, placeholder: "All schools" }}
          selects={[
            {
              name: "influencers",
              label: "Influencers (10K+): any",
              value: f.influencersOnly ? "1" : "",
              options: [{ value: "1", label: "Influencers (10K+) only" }],
            },
            {
              name: "app",
              label: "On the app: any",
              value: f.app,
              options: [
                { value: "yes", label: "On the app" },
                { value: "no", label: "Not on the app yet" },
              ],
            },
            { name: "sport", label: "All sports", value: f.sport, options: KNOWN_SPORTS.map((s: string) => ({ value: s, label: s })) },
            { name: "gender", label: "Any gender", value: f.gender, options: GENDER_OPTIONS },
            { name: "state", label: "Any state", value: f.state, options: US_STATES.map((s) => ({ value: s, label: s })) },
            {
              name: "min",
              label: "Any followers",
              value: f.minFollowers != null ? String(f.minFollowers) : "",
              options: FOLLOWER_FLOORS.map((n) => ({ value: String(n), label: `${n.toLocaleString("en-US")}+ followers` })),
            },
          ]}
          right={
            <LinkBtn href={audienceHref} small>
              + Make an audience
            </LinkBtn>
          }
        />

        <div className="p-3 md:p-4">
          <AdminTable<AthleteRow>
            rows={rows}
            rowKey={(r) => r.id}
            emptyLabel={
              f.q || f.school || f.sport || f.gender || f.state || f.app || f.minFollowers != null
                ? "No athletes match this search on this tab."
                : `No ${ATHLETE_TABS.find((t) => t.key === f.level)?.label.toLowerCase()} athletes in the database yet.`
            }
            columns={[
              { key: "pick", header: <PickAll />, render: (r) => <PickBox id={r.id} handle={r.instagram_handle} name={nameOf(r) ?? "athlete"} /> },
              {
                key: "athlete",
                header: "Athlete",
                render: (r) => <Who name={nameOf(r)} sub={handleText(r.instagram_handle)} href={`/admin/athletes/${r.id}`} />,
              },
              { key: "level", header: "Level", render: (r) => <LevelPill row={r} /> },
              { key: "school", header: "School or team", render: (r) => dim(schoolOf(r)) },
              { key: "sport", header: "Sport", render: (r) => dim(r.sport) },
              { key: "followers", header: "Instagram", align: "right", render: (r) => fmtCount(r.instagram_followers) },
              { key: "nil", header: "NIL value", align: "right", render: (r) => fmtUsd(r.nil_value) },
              { key: "app", header: "Postgame app", secondary: true, render: (r) => <AppPill device={r.device} /> },
            ]}
            mobile={{
              title: (r) => nameOf(r) ?? "—",
              href: (r) => `/admin/athletes/${r.id}`,
              subtitle: (r) => [handleText(r.instagram_handle), schoolOf(r), r.sport].filter(Boolean).join(" · "),
              figure: (r) => fmtCount(r.instagram_followers),
              strip: (r) => (
                <>
                  <LevelPill row={r} />
                  <AppPill device={r.device} />
                  {r.nil_value != null && <span className="text-stone-500">NIL {fmtUsd(r.nil_value)}</span>}
                </>
              ),
            }}
          />
        </div>
        <CardFoot>
          <span>
            {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()} · people table, live. Scraped roster
            profiles join with migration 083.
          </span>
          <span>
            Page {Math.min(page, pages).toLocaleString()} of {pages.toLocaleString()}
          </span>
        </CardFoot>
      </Card>

      <Paginator page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/athletes" params={params} />

      <PickBar total={total} exportBase={`/admin/athletes/export${qs({ page: undefined })}`} filterAudienceHref={audienceHref} />

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
