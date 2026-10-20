// ============================================================
// Athlete list vocabulary — shared by /admin/athletes, its CSV
// export and the audience builder so the four levels mean the
// same thing everywhere.
//
// Source: `people` (the ColdFusion roster, 52,809 rows). The level
// comes from two columns that exist on production today:
//   person_type    'Athlete' | 'Former Athlete' | (Agent, Fan, …)
//   roster_status  'college_athlete' | 'high_school_athlete' |
//                  'professional_athlete' | 'former_college' |
//                  'former_pro' | 'other' | 'not_on_roster' | …
// (values read back from production 2026-10-20).
//
//   High school   roster_status = high_school_athlete
//   College       person_type = Athlete and roster_status is null or
//                 not one of the high-school / pro / former codes
//   Pro           roster_status = professional_athlete
//   Former        person_type = Former Athlete, or roster_status is a
//                 former code. "Influencers" are former athletes who
//                 kept 10,000+ Instagram followers (Peyton's bar).
// ============================================================

import { sanitizeFilterValue } from "@/lib/admin/db";

export type AthleteLevel = "high_school" | "college" | "pro" | "former";
/** A list tab: one level, or every level at once. */
export type AthleteTab = AthleteLevel | "all";

/** Tab order on /admin/athletes (the prototype's LEVELS). */
export const ATHLETE_TABS: Array<{ key: AthleteTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "college", label: "College" },
  { key: "high_school", label: "High school" },
  { key: "pro", label: "Pro" },
  { key: "former", label: "Former & influencers" },
];

export const ATHLETE_LEVELS: Array<{ key: AthleteLevel; label: string; short: string }> = [
  { key: "high_school", label: "High school", short: "High school" },
  { key: "college", label: "College", short: "College" },
  { key: "pro", label: "Pro", short: "Pro" },
  { key: "former", label: "Former & influencers", short: "Former" },
];

export const INFLUENCER_MIN_FOLLOWERS = 10_000;

const HS = "high_school_athlete";
const PRO = "professional_athlete";
const FORMER = ["former_college", "former_pro"];

export function isAthleteLevel(v: string | undefined | null): v is AthleteLevel {
  return v === "high_school" || v === "college" || v === "pro" || v === "former";
}

/** Base scope every athlete list starts from: live roster people only. */
export function applyAthleteBase(query: any) {
  return query.eq("is_archived", false).in("person_type", ["Athlete", "Former Athlete"]);
}

/** Narrow a `people` query to one level (after applyAthleteBase). "all" leaves it alone. */
export function applyAthleteLevel(query: any, level: AthleteTab, influencersOnly = false): any {
  switch (level) {
    case "all":
      return influencersOnly ? applyAthleteLevel(query, "former", true) : query;
    case "high_school":
      return query.eq("roster_status", HS);
    case "pro":
      return query.eq("roster_status", PRO);
    case "former": {
      query = query.or(`person_type.eq.Former Athlete,roster_status.in.(${FORMER.join(",")})`);
      if (influencersOnly) query = query.gte("instagram_followers", INFLUENCER_MIN_FOLLOWERS);
      return query;
    }
    case "college":
    default:
      return query
        .eq("person_type", "Athlete")
        .or(`roster_status.is.null,roster_status.not.in.(${[HS, PRO, ...FORMER].join(",")})`);
  }
}

/** Several levels at once (the audience builder's Levels checkboxes). */
export function applyAthleteLevels(query: any, levels: AthleteLevel[], influencersOnly = false) {
  const set = new Set(levels);
  if (set.size === 0 || set.size === 4) {
    // Everyone — but "influencers only" still bites on the former group.
    return influencersOnly
      ? query.or(
          `roster_status.eq.${HS},roster_status.eq.${PRO},person_type.eq.Athlete,` +
            `and(or(person_type.eq.Former Athlete,roster_status.in.(${FORMER.join(",")})),instagram_followers.gte.${INFLUENCER_MIN_FOLLOWERS})`
        )
      : query;
  }
  const terms: string[] = [];
  if (set.has("high_school")) terms.push(`roster_status.eq.${HS}`);
  if (set.has("pro")) terms.push(`roster_status.eq.${PRO}`);
  if (set.has("college"))
    terms.push(`and(person_type.eq.Athlete,or(roster_status.is.null,roster_status.not.in.(${[HS, PRO, ...FORMER].join(",")})))`);
  if (set.has("former")) {
    const former = `or(person_type.eq.Former Athlete,roster_status.in.(${FORMER.join(",")}))`;
    terms.push(influencersOnly ? `and(${former},instagram_followers.gte.${INFLUENCER_MIN_FOLLOWERS})` : former);
  }
  return query.or(terms.join(","));
}

/** Level of one row, for the pill in mixed lists. */
export function levelOf(row: { person_type: string | null; roster_status: string | null }): AthleteLevel {
  if (row.roster_status === HS) return "high_school";
  if (row.roster_status === PRO) return "pro";
  if (row.person_type === "Former Athlete" || (row.roster_status != null && FORMER.includes(row.roster_status))) return "former";
  return "college";
}

export function isInfluencer(row: {
  person_type: string | null;
  roster_status: string | null;
  instagram_followers: number | null;
}): boolean {
  return levelOf(row) === "former" && (row.instagram_followers ?? 0) >= INFLUENCER_MIN_FOLLOWERS;
}

// ------------------------------------------------------------
// Toolbar filters (?q= ?school= ?sport=) shared by the page and the
// CSV export so the download always matches what is on screen.
// ------------------------------------------------------------

export interface AthleteListFilters {
  level: AthleteTab;
  influencersOnly: boolean;
  q: string;
  school: string;
  sport: string;
  /** "yes" = on the Postgame app (a device on file), "no" = not yet */
  app: "" | "yes" | "no";
  /** people.gender codes: M · W · N */
  gender: string;
  /** two-letter college state */
  state: string;
  /** minimum Instagram followers */
  minFollowers: number | null;
}

export const GENDER_OPTIONS = [
  { value: "M", label: "Men" },
  { value: "W", label: "Women" },
  { value: "N", label: "Non-binary" },
];

export const FOLLOWER_FLOORS = [1_000, 5_000, 10_000, 50_000, 100_000];

export function buildAthleteListFilters(sp: Record<string, string | undefined>): AthleteListFilters {
  const level = sp.level === "all" || isAthleteLevel(sp.level) ? (sp.level as AthleteTab) : "all";
  const gender = sanitizeFilterValue(sp.gender ?? "");
  const state = sanitizeFilterValue(sp.state ?? "").toUpperCase();
  return {
    level,
    influencersOnly: sp.influencers === "1",
    q: sanitizeFilterValue(sp.q ?? ""),
    school: sanitizeFilterValue(sp.school ?? ""),
    sport: sanitizeFilterValue(sp.sport ?? ""),
    app: sp.app === "yes" || sp.app === "no" ? sp.app : "",
    gender: GENDER_OPTIONS.some((g) => g.value === gender) ? gender : "",
    state: /^[A-Z]{2}$/.test(state) ? state : "",
    minFollowers: /^\d+$/.test(sp.min ?? "") ? parseInt(sp.min!, 10) : null,
  };
}

/** "On the Postgame app" = the ColdFusion user record has a device on file. */
export function applyAppFilter(query: any, app: "" | "yes" | "no") {
  if (app === "yes") return query.not("device", "is", null);
  if (app === "no") return query.is("device", null);
  return query;
}

/** Everything except the level (so tab counts can share the toolbar filters). */
export function applyAthleteToolbar(query: any, f: AthleteListFilters, collegeIds: number[] = []) {
  if (f.q) {
    query = query.or(
      `first_name.ilike.%${f.q}%,last_name.ilike.%${f.q}%,instagram_handle.ilike.%${f.q}%,college_raw.ilike.%${f.q}%`
    );
  }
  if (f.sport) query = query.ilike("sport", `%${f.sport}%`);
  if (f.gender) query = query.eq("gender", f.gender);
  if (f.state) query = query.eq("college_state", f.state);
  if (f.minFollowers != null) query = query.gte("instagram_followers", f.minFollowers);
  query = applyAppFilter(query, f.app);
  if (f.school) {
    const terms = [`college_raw.ilike.%${f.school}%`];
    if (collegeIds.length) terms.push(`college_id.in.(${collegeIds.join(",")})`);
    query = query.or(terms.join(","));
  }
  return query;
}

export function applyAthleteList(query: any, f: AthleteListFilters, collegeIds: number[] = []) {
  return applyAthleteLevel(applyAthleteToolbar(applyAthleteBase(query), f, collegeIds), f.level, f.influencersOnly);
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "—";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
