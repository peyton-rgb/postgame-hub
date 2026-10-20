// ============================================================
// Shared audience-segment logic — used by the audience builder
// (/admin/audiences/new), saved-audience detail, the CSV export and
// the campaign audience pane, so the count, preview and download can
// never drift.
//
// One vocabulary for URL params AND the saved_audiences.filters jsonb
// (migration 083). Multi-value fields are "|"-joined; old single
// values (the first builder, and campaigns/queries.ts filtersToParams)
// still parse, so nothing that worked before breaks:
//
//   state=FL|TX  gender=M|W  sport=Football|Soccer  college=Duke|Auburn
//   min=10000  max=  rating=3 (minimum, 0–5)
//   levels=college|former  influencers=1  include=all|app|noapp
//   handles=a|b|c (added by handle)  exclude=x|y (handles left out)
//   exclude_campaigns=<campaign_recaps id>|… (athletes on those recap rosters)
//
// Source table: `people` (the ColdFusion users roster). Levels mean
// the same as on /admin/athletes (src/lib/admin/athletes.ts).
// ============================================================

import { sanitizeFilterValue } from "@/lib/admin/db";
import { parseHandles } from "@/lib/admin/handles";
import {
  applyAppFilter,
  applyAthleteLevels,
  isAthleteLevel,
  type AthleteLevel,
} from "@/lib/admin/athletes";

export type AudienceInclude = "all" | "app" | "noapp";

export interface AudienceFilters {
  states: string[];
  genders: string[];
  sports: string[];
  colleges: string[];
  minFollowers: number | null;
  maxFollowers: number | null;
  /** minimum rating "0".."5"; any other legacy value matches exactly */
  rating: string;
  /** null = every level (legacy filters had no levels) */
  levels: AthleteLevel[] | null;
  influencersOnly: boolean;
  include: AudienceInclude;
  handles: string[];
  exclude: string[];
  excludeCampaigns: string[];
}

const LEGACY_GENDER: Record<string, string> = { male: "M", men: "M", female: "W", women: "W", "non-binary": "N" };

function splitMulti(raw: string | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split("|")
        .map((v) => sanitizeFilterValue(v).trim())
        .filter(Boolean)
    )
  ).slice(0, 100);
}

function splitHandles(raw: string | undefined): string[] {
  return raw ? parseHandles(raw.replace(/\|/g, "\n")) : [];
}

export function buildAudienceFilters(sp: Record<string, string | undefined>): AudienceFilters {
  const levels = splitMulti(sp.levels).filter(isAthleteLevel) as AthleteLevel[];
  const include = sp.include === "app" || sp.include === "noapp" ? sp.include : "all";
  return {
    states: splitMulti(sp.state ?? sp.states).map((s) => s.toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s)),
    genders: splitMulti(sp.gender ?? sp.genders)
      .map((g) => LEGACY_GENDER[g.toLowerCase()] ?? g.toUpperCase())
      .filter((g) => ["M", "W", "N"].includes(g)),
    sports: splitMulti(sp.sport ?? sp.sports),
    colleges: splitMulti(sp.college ?? sp.colleges),
    minFollowers: /^\d+$/.test(sp.min ?? "") ? parseInt(sp.min!, 10) : null,
    maxFollowers: /^\d+$/.test(sp.max ?? "") ? parseInt(sp.max!, 10) : null,
    rating: sanitizeFilterValue(sp.rating ?? ""),
    levels: sp.levels != null && sp.levels !== "" ? levels : null,
    influencersOnly: sp.influencers === "1",
    include,
    handles: splitHandles(sp.handles),
    exclude: splitHandles(sp.exclude),
    excludeCampaigns: splitMulti(sp.exclude_campaigns).filter((v) => /^[0-9a-f-]{36}$/i.test(v)),
  };
}

/** The params / saved-filters form of a filter set (empty values dropped). */
export function audienceParams(f: AudienceFilters): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: string | null | undefined) => {
    if (v) out[k] = v;
  };
  put("levels", f.levels ? f.levels.join("|") : "");
  put("influencers", f.influencersOnly ? "1" : "");
  put("include", f.include !== "all" ? f.include : "");
  put("state", f.states.join("|"));
  put("gender", f.genders.join("|"));
  put("sport", f.sports.join("|"));
  put("college", f.colleges.join("|"));
  put("min", f.minFollowers != null ? String(f.minFollowers) : "");
  put("max", f.maxFollowers != null ? String(f.maxFollowers) : "");
  put("rating", f.rating);
  put("handles", f.handles.join("|"));
  put("exclude", f.exclude.join("|"));
  put("exclude_campaigns", f.excludeCampaigns.join("|"));
  return out;
}

export function audienceQuery(f: AudienceFilters): string {
  return new URLSearchParams(audienceParams(f)).toString();
}

/** saved_audiences.filters jsonb → params (tolerates numbers and arrays). */
export function savedFiltersToParams(raw: Record<string, unknown> | null | undefined): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v === true ? "1" : v);
    else if (Array.isArray(v)) out[k] = v.map(String).join("|");
  }
  if (!out.min && out.minFollowers) out.min = out.minFollowers;
  if (!out.max && out.maxFollowers) out.max = out.maxFollowers;
  return out;
}

/** True when anything narrows the list beyond "every college athlete". */
export function hasNarrowingFilters(f: AudienceFilters): boolean {
  const lv = f.levels;
  const defaultLevels = lv != null && lv.length === 1 && lv[0] === "college";
  return (
    !defaultLevels ||
    f.influencersOnly ||
    f.include !== "all" ||
    f.states.length > 0 ||
    f.genders.length > 0 ||
    f.sports.length > 0 ||
    f.colleges.length > 0 ||
    f.minFollowers != null ||
    f.maxFollowers != null ||
    !!f.rating ||
    f.exclude.length > 0 ||
    f.excludeCampaigns.length > 0
  );
}

/** Handle spellings to match against people.instagram_handle (stored with mixed case / @). */
export function handleVariants(handles: string[]): string[] {
  const out = new Set<string>();
  for (const h of handles) {
    out.add(h);
    out.add(`@${h}`);
  }
  return Array.from(out);
}

const quoteIn = (vals: string[]) => `(${vals.map((v) => `"${v.replace(/"/g, "")}"`).join(",")})`;

/** Base scope + leave-outs, shared by the filtered part and the hand-added handles. */
function applyAudienceScope(query: any, f: AudienceFilters, excludedPersonIds: string[]) {
  query = query.eq("is_archived", false).eq("is_active", true).in("person_type", ["Athlete", "Former Athlete"]);
  query = applyAppFilter(query, f.include === "app" ? "yes" : f.include === "noapp" ? "no" : "");
  if (f.exclude.length)
    query = query.or(`instagram_handle.is.null,instagram_handle.not.in.${quoteIn(handleVariants(f.exclude))}`);
  if (excludedPersonIds.length) query = query.not("id", "in", `(${excludedPersonIds.join(",")})`);
  return query;
}

/**
 * The filter part of an audience (everything except hand-added handles).
 * Synchronous on purpose: the campaign audience pane counts with it.
 * `excludedPersonIds` comes from resolveExcludedPeople() when the audience
 * leaves out campaign rosters.
 */
export function applyAudienceFilters(query: any, f: AudienceFilters, excludedPersonIds: string[] = []) {
  query = applyAudienceScope(query, f, excludedPersonIds);
  if (f.levels) query = applyAthleteLevels(query, f.levels, f.influencersOnly);
  else if (f.influencersOnly) query = applyAthleteLevels(query, ["college", "high_school", "pro", "former"], true);
  if (f.states.length) query = query.in("college_state", f.states);
  if (f.genders.length) query = query.in("gender", f.genders);
  if (f.sports.length) query = query.or(f.sports.map((s) => `sport.ilike.%${s}%`).join(","));
  // Spaces become wildcards so a name whose comma was stripped
  // ("University of California, Los Angeles") still matches.
  if (f.colleges.length) query = query.or(f.colleges.map((c) => `college_raw.ilike.%${c.replace(/\s+/g, "%")}%`).join(","));
  if (f.minFollowers != null) query = query.gte("instagram_followers", f.minFollowers);
  if (f.maxFollowers != null) query = query.lte("instagram_followers", f.maxFollowers);
  if (f.rating) query = /^[0-5]$/.test(f.rating) ? query.gte("rating", f.rating) : query.eq("rating", f.rating);
  return query;
}

/** Hand-added handles, inside the same scope and leave-outs. */
export function applyAudienceHandles(query: any, f: AudienceFilters, excludedPersonIds: string[] = []) {
  return applyAudienceScope(query, f, excludedPersonIds).in("instagram_handle", handleVariants(f.handles));
}

/** People on the recap rosters of the campaigns this audience leaves out. */
export async function resolveExcludedPeople(supabase: any, f: AudienceFilters): Promise<string[]> {
  if (!f.excludeCampaigns.length) return [];
  const { data } = await supabase
    .from("athletes")
    .select("person_id")
    .in("campaign_id", f.excludeCampaigns)
    .not("person_id", "is", null)
    .limit(5000);
  return Array.from(new Set(((data ?? []) as { person_id: string }[]).map((r) => r.person_id)));
}

/**
 * Exact audience size.
 *  - handles only, nothing else narrowing → just those athletes
 *  - otherwise → |filtered| + |handles| − |handles that are also filtered|
 */
export async function countAudience(
  supabase: any,
  f: AudienceFilters,
  excluded: string[]
): Promise<{ total: number; filtered: number; byHandle: number; handlesOnly: boolean; error: string | null }> {
  const head = () => supabase.from("people").select("id", { count: "exact", head: true });
  const handlesOnly = f.handles.length > 0 && !hasNarrowingFilters(f);
  if (handlesOnly) {
    const r = await applyAudienceHandles(head(), f, excluded);
    return { total: r.count ?? 0, filtered: 0, byHandle: r.count ?? 0, handlesOnly, error: r.error?.message ?? null };
  }
  const [a, b, both] = await Promise.all([
    applyAudienceFilters(head(), f, excluded),
    f.handles.length ? applyAudienceHandles(head(), f, excluded) : Promise.resolve({ count: 0, error: null }),
    f.handles.length
      ? applyAudienceFilters(head(), f, excluded).in("instagram_handle", handleVariants(f.handles))
      : Promise.resolve({ count: 0, error: null }),
  ]);
  const err = a.error?.message ?? b.error?.message ?? both.error?.message ?? null;
  const filtered = a.count ?? 0;
  const byHandle = b.count ?? 0;
  return { total: filtered + byHandle - (both.count ?? 0), filtered, byHandle, handlesOnly, error: err };
}

export const AUDIENCE_PERSON_COLUMNS =
  "id, first_name, last_name, sport, college_raw, college_state, instagram_handle, instagram_followers, tiktok_handle, gender, rating, nil_value, device, person_type, roster_status";

/** Top-N preview by followers, hand-added handles merged in. */
export async function previewAudience(supabase: any, f: AudienceFilters, excluded: string[], n = 50): Promise<any[]> {
  const handlesOnly = f.handles.length > 0 && !hasNarrowingFilters(f);
  const sel = () => supabase.from("people").select(AUDIENCE_PERSON_COLUMNS);
  const [a, b] = await Promise.all([
    handlesOnly
      ? Promise.resolve({ data: [] })
      : applyAudienceFilters(sel(), f, excluded).order("instagram_followers", { ascending: false, nullsFirst: false }).limit(n),
    f.handles.length
      ? applyAudienceHandles(sel(), f, excluded).order("instagram_followers", { ascending: false, nullsFirst: false }).limit(n)
      : Promise.resolve({ data: [] }),
  ]);
  const seen = new Map<string, any>();
  for (const r of [...(a.data ?? []), ...(b.data ?? [])]) seen.set(r.id, r);
  return Array.from(seen.values())
    .sort((x, y) => (y.instagram_followers ?? 0) - (x.instagram_followers ?? 0))
    .slice(0, n);
}

/** Plain-English lines for the "Who's in it" summary. */
export function describeAudience(
  f: AudienceFilters,
  campaignNames: Map<string, string> = new Map()
): Array<{ k: string; v: string }> {
  const LV: Record<AthleteLevel, string> = { college: "College", high_school: "High school", pro: "Pro", former: "Former" };
  const GN: Record<string, string> = { M: "Men", W: "Women", N: "Non-binary" };
  const lines: Array<{ k: string; v: string }> = [];
  const narrowing = hasNarrowingFilters(f);
  if (f.handles.length) lines.push({ k: narrowing ? "Plus athletes added by handle" : "Only these athletes", v: String(f.handles.length) });
  if (f.levels && !(f.levels.length === 1 && f.levels[0] === "college"))
    lines.push({ k: "Levels", v: (f.levels.length ? f.levels.map((l) => LV[l]).join(", ") : "All") + (f.influencersOnly ? " (influencers only)" : "") });
  else if (f.influencersOnly) lines.push({ k: "Levels", v: "Influencers only" });
  if (f.include !== "all") lines.push({ k: "Include", v: f.include === "app" ? "app users only" : "athletes without the app" });
  if (f.states.length) lines.push({ k: "States", v: f.states.join(", ") });
  if (f.genders.length) lines.push({ k: "Gender", v: f.genders.map((g) => GN[g] ?? g).join(", ") });
  if (f.colleges.length) lines.push({ k: "Colleges", v: f.colleges.join(", ") });
  if (f.sports.length) lines.push({ k: "Sports", v: f.sports.join(", ") });
  if (f.minFollowers != null || f.maxFollowers != null)
    lines.push({
      k: "Followers",
      v: `${(f.minFollowers ?? 0).toLocaleString("en-US")} to ${f.maxFollowers != null ? f.maxFollowers.toLocaleString("en-US") : "no limit"}`,
    });
  if (f.rating) lines.push({ k: "Rating", v: /^[0-5]$/.test(f.rating) ? `${f.rating}+` : f.rating });
  if (f.excludeCampaigns.length)
    lines.push({
      k: "Leaving out athletes on",
      v: f.excludeCampaigns.map((id) => campaignNames.get(id) ?? "a campaign").join(", "),
    });
  if (f.exclude.length) lines.push({ k: "Excluding", v: `${f.exclude.length} handle${f.exclude.length > 1 ? "s" : ""}` });
  return lines;
}
