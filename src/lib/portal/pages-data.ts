// ============================================================
// Data for the Phase 3b portal pages.
//
// Same rules as the dashboard: reads use the CALLER's client (no service role
// under the portal), campaigns come from portal_campaigns (never
// campaign_recaps), brand_id is passed explicitly into every query, and every
// number shown comes from a query or is not shown.
//
// COUNTS AND DEDUPLICATION HAPPEN IN SQL. PostgREST caps a response at 1000
// rows regardless of .limit(); `athletes` has 2,096 rows for CVS alone. The
// directory reads portal_brand_athletes (migration 049) and campaign rosters
// are fetched per-campaign, which keeps every query under the cap.
// ============================================================

import { createServerSupabase } from "@/lib/supabase-server";
import { richText } from "@/lib/portal/rich-text";

export const WRAPPED = ["delivered", "closed"] as const;
const NO_MATCH = "00000000-0000-0000-0000-000000000000";

function isWrapped(status: string | null): boolean {
  return !!status && (WRAPPED as readonly string[]).includes(status);
}

/** 933000 -> "933K". Shared with the dashboard's formatter. */
export function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

/**
 * A resized thumbnail URL for a Supabase Storage object.
 *
 * CLAUDE.md: "Supabase Storage thumbnails: use the /render/image/public/
 * endpoint with ?width=N&quality=N". Not an optimisation — the Content gallery
 * is 411 files and CVS images carry no thumbnail_url, so without this the page
 * asks the browser for 411 full-resolution originals and renders a grid of
 * blank tiles while they load. Observed exactly that before adding it.
 *
 * Anything that is not a public Storage object URL is returned untouched.
 */
/**
 * Rewrite a Storage object URL onto the image-transform endpoint.
 *
 * USE THIS SPARINGLY. Transforms are a metered Supabase feature, and one
 * call per rendered tile adds up fast: the content gallery alone was issuing
 * 411 of them per page view. Media tiles no longer use it at all — they take
 * `thumbnail_url` as stored, falling back to the plain object URL (see
 * mediaThumb below). It is kept for the small fixed-size headshots, where a
 * 160px transform is genuinely smaller than a 1.4MB original.
 *
 * Not the cause of the black gallery tiles, incidentally: the endpoint was
 * verified healthy on every URL shape in this bucket, including names
 * carrying %20 and parentheses, and 12 real tile URLs loaded in-browser in
 * 3-7ms at naturalWidth 420. The gallery's problem was volume, not the
 * endpoint.
 */
export function thumb(url: string, width = 420): string {
  const marker = "/storage/v1/object/public/";
  if (!url.includes(marker)) return url;
  return (
    url.replace(marker, "/storage/v1/render/image/public/") +
    (url.includes("?") ? "&" : "?") +
    `width=${width}&quality=70`
  );
}

/**
 * The thumbnail source for a media tile: whatever `thumbnail_url` holds, else
 * the plain object URL. No transform, so a gallery costs zero transform
 * calls. For CVS, 411 of 460 rows carry a thumbnail_url (every one of the 104
 * videos does, and none of them points at the mp4 — checked); the remaining
 * 49 are images that fall back to their original, which pagination keeps to a
 * sane number per page.
 */
export function mediaThumb(
  thumbnailUrl: string | null,
  fileUrl: string | null
): string | null {
  return thumbnailUrl || fileUrl || null;
}

export interface CampaignListItem {
  id: string;
  name: string;
  slug: string | null;
  live: boolean;
  quarter: string | null;
  campaignType: string | null;
  athletes: number;
  heroUrl: string | null;
  figures: { label: string; value: string }[];
}

interface RawCampaign {
  id: string;
  name: string | null;
  slug: string | null;
  lifecycle_status: string | null;
  admin_created_on: string | null;
  quarter: string | null;
  campaign_type: string | null;
  platform: string | null;
  description: string | null;
  hero_image_url: string | null;
  manager_name: string | null;
  manager_email: string | null;
  drive_content_folder_id: string | null;
  kpi_targets: Record<string, unknown> | null;
  key_takeaways: unknown;
  public_sections: unknown;
}

const CAMPAIGN_COLS =
  "id, name, slug, lifecycle_status, admin_created_on, quarter, campaign_type, platform, description, hero_image_url, manager_name, manager_email, drive_content_folder_id, kpi_targets, key_takeaways, public_sections";

/** Newest first, live before wrapped. */
function sortCampaigns(a: RawCampaign, b: RawCampaign): number {
  const al = a.lifecycle_status === "active" ? 0 : 1;
  const bl = b.lifecycle_status === "active" ? 0 : 1;
  if (al !== bl) return al - bl;
  const ad = a.admin_created_on ?? "";
  const bd = b.admin_created_on ?? "";
  if (ad === bd) return (a.name ?? "").localeCompare(b.name ?? "");
  return ad < bd ? 1 : -1;
}

/**
 * Figures from a recap's structured fields only. Absent keys are omitted, never
 * zero-filled — which is why most CVS wrapped campaigns show no figures at all
 * (44 of 46 carry an empty kpi_targets object).
 */
export function readFigures(raw: Record<string, unknown> | null, max = 3) {
  if (!raw || typeof raw !== "object") return [];
  const WANTED: [string, string][] = [
    ["athletes", "Athletes"],
    ["posts", "Posts"],
    ["reach", "Reach"],
    ["engagement", "Engagement"],
  ];
  const out: { label: string; value: string }[] = [];
  for (const [k, label] of WANTED) {
    const v = raw[k];
    if (v === null || v === undefined || v === "") continue;
    const text = String(v).trim();
    if (text) out.push({ label, value: text });
    if (out.length >= max) break;
  }
  return out;
}

// ---- 1 · Campaigns list -----------------------------------------
export async function loadCampaignList(brandId: string) {
  const supabase = createServerSupabase();

  const [campaignsRes, statsRes] = await Promise.all([
    supabase.from("portal_campaigns").select(CAMPAIGN_COLS).eq("brand_id", brandId),
    supabase
      .from("portal_campaign_stats")
      .select("campaign_id, athletes")
      .eq("brand_id", brandId),
  ]);

  const campaigns = ((campaignsRes.data ?? []) as RawCampaign[]).slice().sort(sortCampaigns);
  const counts = new Map<string, number>();
  for (const s of (statsRes.data ?? []) as { campaign_id: string; athletes: number | null }[]) {
    counts.set(s.campaign_id, s.athletes ?? 0);
  }

  // Hero thumbnails for wrapped cards. hero_image_url is null on every CVS row,
  // so media.is_hero is the real source; both are checked.
  const wrappedIds = campaigns.filter((c) => isWrapped(c.lifecycle_status)).map((c) => c.id);
  const heroes = await loadHeroes(supabase, wrappedIds);

  const items: CampaignListItem[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name ?? "Campaign",
    slug: c.slug,
    live: c.lifecycle_status === "active",
    quarter: c.quarter,
    campaignType: c.campaign_type,
    athletes: counts.get(c.id) ?? 0,
    heroUrl: c.hero_image_url || heroes.get(c.id) || null,
    figures: readFigures(c.kpi_targets),
  }));

  const quarters = Array.from(
    new Set(items.map((i) => i.quarter).filter((q): q is string => !!q))
  ).sort();

  return {
    items,
    quarters,
    liveCount: items.filter((i) => i.live).length,
    wrappedCount: items.filter((i) => !i.live).length,
  };
}

async function loadHeroes(
  supabase: ReturnType<typeof createServerSupabase>,
  campaignIds: string[],
  width = 900,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (campaignIds.length === 0) return out;
  const { data } = await supabase
    .from("media")
    .select("campaign_id, file_url, thumbnail_url, hero_order")
    .in("campaign_id", campaignIds)
    .eq("is_hero", true)
    .order("hero_order", { ascending: true });
  for (const m of (data ?? []) as {
    campaign_id: string;
    file_url: string | null;
    thumbnail_url: string | null;
  }[]) {
    const url = m.thumbnail_url || m.file_url;
    if (url && !out.has(m.campaign_id)) out.set(m.campaign_id, thumb(url, width));
  }
  return out;
}

// ---- 2 · Campaign detail ----------------------------------------
export interface DetailAthlete {
  id: string;
  name: string;
  school: string | null;
  sport: string | null;
  followers: number | null;
  views: number | null;
  headshotUrl: string | null;
}

export interface MediaItem {
  id: string;
  url: string;
  thumbUrl: string;
  isVideo: boolean;
  athleteName: string | null;
  /** From athletes.school via media.athlete_id — the gallery's school filter. */
  school: string | null;
  campaignName: string | null;
  createdAt: string | null;
}

export async function loadCampaignDetail(brandId: string, slug: string) {
  const supabase = createServerSupabase();

  const { data: row } = await supabase
    .from("portal_campaigns")
    .select(CAMPAIGN_COLS)
    .eq("brand_id", brandId)
    .eq("slug", slug)
    .maybeSingle();

  if (!row) return null;
  const c = row as RawCampaign;

  const [athletesRes, mediaRes, statsRes] = await Promise.all([
    // Rosters run to 418 on one CVS campaign — under the 1000 cap, so a single
    // fetch is safe here.
    supabase
      .from("athletes")
      .select("id, name, school, sport, ig_followers, metrics")
      .eq("campaign_id", c.id)
      .not("name", "is", null)
      .order("ig_followers", { ascending: false, nullsFirst: false })
      .limit(600),
    supabase
      .from("media")
      .select("id, athlete_id, type, file_url, thumbnail_url, created_at")
      .eq("campaign_id", c.id)
      .order("created_at", { ascending: false })
      .limit(400),
    supabase
      .from("portal_campaign_stats")
      .select("athletes, schools")
      .eq("campaign_id", c.id)
      .maybeSingle(),
  ]);

  const rawAthletes = (athletesRes.data ?? []) as {
    id: string;
    name: string;
    school: string | null;
    sport: string | null;
    ig_followers: number | null;
    metrics: Record<string, any> | null;
  }[];

  const media = (mediaRes.data ?? []) as {
    id: string;
    athlete_id: string | null;
    type: string | null;
    file_url: string | null;
    thumbnail_url: string | null;
    created_at: string | null;
  }[];

  // Headshots from the campaign's own media, keyed by athlete. Not filtered to
  // type='image': videos carry a thumbnail_url that is a fine still, and on
  // this data some athletes have only video. Images sort first.
  const headshots = new Map<string, string>();
  for (const m of [...media].sort((a, b) => (a.type ?? "").localeCompare(b.type ?? ""))) {
    const url = m.thumbnail_url || m.file_url;
    if (m.athlete_id && url && !headshots.has(m.athlete_id)) headshots.set(m.athlete_id, thumb(url, 160));
  }

  const nameById = new Map(rawAthletes.map((a) => [a.id, a.name]));

  const athletes: DetailAthlete[] = rawAthletes.map((a) => ({
    id: a.id,
    name: a.name,
    school: a.school,
    sport: a.sport,
    followers: a.ig_followers,
    views: reelViews(a.metrics),
    headshotUrl: headshots.get(a.id) ?? null,
  }));

  const items: MediaItem[] = media
    .map((m) => {
      const url = m.file_url || m.thumbnail_url;
      const thumbSrc = m.thumbnail_url || m.file_url;
      if (!url || !thumbSrc) return null;
      return {
        id: m.id,
        url,
        thumbUrl: thumbSrc,
        isVideo: m.type === "video",
        athleteName: m.athlete_id ? nameById.get(m.athlete_id) ?? null : null,
        // The detail page's Content tab is already scoped to one campaign,
        // where a school dropdown adds nothing — the roster tab has school
        // chips. Left null rather than fetched for a filter that isn't shown.
        // Annotated because a bare `null` narrows to the null type and then
        // fails the MediaItem[] assignment.
        school: null as string | null,
        campaignName: c.name,
        createdAt: m.created_at,
      };
    })
    .filter((m): m is MediaItem => m !== null);

  const stat = (statsRes.data ?? null) as { athletes: number | null; schools: number | null } | null;

  return {
    id: c.id,
    name: c.name ?? "Campaign",
    slug: c.slug,
    live: c.lifecycle_status === "active",
    quarter: c.quarter,
    campaignType: c.campaign_type,
    platform: c.platform,
    // Sanitized HTML, not a raw string. Both fields hold a mix of real
    // markup and plain text across CVS's rows; richText() handles either
    // and returns null when there is nothing but empty tags.
    descriptionHtml: richText(c.description),
    managerName: c.manager_name,
    managerEmail: c.manager_email,
    driveFolderId: c.drive_content_folder_id,
    // 1600, not the 900 the cards use: this hero spans the full content
    // column (1325px at 1440) and 900 visibly upscales.
    heroUrl: c.hero_image_url || (await loadHeroes(supabase, [c.id], 1600)).get(c.id) || null,
    figures: readFigures(c.kpi_targets, 4),
    takeawaysHtml: richText(
      typeof c.key_takeaways === "string"
        ? c.key_takeaways
        : Array.isArray(c.key_takeaways)
          ? c.key_takeaways.map((t) => `- ${String(t)}`).join("\n")
          : null
    ),
    athletes,
    media: items,
    athleteCount: stat?.athletes ?? athletes.length,
    schoolCount: stat?.schools ?? 0,
  };
}

/** The guarded ranking metric, same rule as portal_top_posts. */
function reelViews(metrics: Record<string, any> | null): number | null {
  const raw = metrics?.ig_reel?.views;
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Exact multiples of 100,000 are campaign aggregates copied onto athlete
  // rows, not per-post counts. Verified on "The Tournament".
  if (n % 100000 === 0) return null;
  return n;
}

// readTakeaways() is gone. It split the field on newlines, which is right for
// the plain-text rows and completely wrong for the HTML ones: "<ul><li><p>..."
// contains no newlines, so the whole blob became a single array entry and
// rendered as visible tags on the Results tab. richText() in rich-text.ts
// decides per value which format it is looking at.

// ---- 3 · Content gallery ----------------------------------------
export async function loadContentGallery(brandId: string) {
  const supabase = createServerSupabase();

  const { data: campaigns } = await supabase
    .from("portal_campaigns")
    .select("id, name")
    .eq("brand_id", brandId);

  const rows = (campaigns ?? []) as { id: string; name: string | null }[];
  const nameByCampaign = new Map(rows.map((c) => [c.id, c.name ?? "Campaign"]));
  const ids = rows.map((c) => c.id);

  if (ids.length === 0) return { items: [] as MediaItem[], campaigns: [] as string[] };

  // 460 CVS rows — one fetch is under the cap.
  const { data: media } = await supabase
    .from("media")
    .select("id, athlete_id, campaign_id, type, file_url, thumbnail_url, created_at")
    .in("campaign_id", ids)
    .order("created_at", { ascending: false })
    .limit(600);

  const mediaRows = (media ?? []) as {
    id: string;
    athlete_id: string | null;
    campaign_id: string | null;
    type: string | null;
    file_url: string | null;
    thumbnail_url: string | null;
    created_at: string | null;
  }[];

  // Athlete names for captions, only for the ids actually present.
  const athleteIds = Array.from(
    new Set(mediaRows.map((m) => m.athlete_id).filter((x): x is string => !!x))
  ).slice(0, 900);
  const nameById = new Map<string, string>();
  const schoolById = new Map<string, string>();
  if (athleteIds.length > 0) {
    const { data: ath } = await supabase
      .from("athletes")
      .select("id, name, school")
      .in("id", athleteIds);
    for (const a of (ath ?? []) as { id: string; name: string | null; school: string | null }[]) {
      if (a.name) nameById.set(a.id, a.name);
      const school = a.school?.trim();
      if (school) schoolById.set(a.id, school);
    }
  }

  const items: MediaItem[] = mediaRows
    .map((m) => {
      const url = m.file_url || m.thumbnail_url;
      const thumbSrc = m.thumbnail_url || m.file_url;
      if (!url || !thumbSrc) return null;
      return {
        id: m.id,
        url,
        thumbUrl: thumbSrc,
        isVideo: m.type === "video",
        athleteName: m.athlete_id ? nameById.get(m.athlete_id) ?? null : null,
        school: m.athlete_id ? schoolById.get(m.athlete_id) ?? null : null,
        campaignName: m.campaign_id ? nameByCampaign.get(m.campaign_id) ?? null : null,
        createdAt: m.created_at,
      };
    })
    .filter((m): m is MediaItem => m !== null);

  // Only values that actually occur in the fetched rows become options — a
  // dropdown offering a campaign with no media in it is a dead end.
  const uniq = (xs: (string | null)[]) =>
    Array.from(new Set(xs.filter((x): x is string => !!x))).sort((a, b) =>
      a.localeCompare(b)
    );

  return {
    items,
    campaigns: uniq(items.map((i) => i.campaignName)),
    athletes: uniq(items.map((i) => i.athleteName)),
    schools: uniq(items.map((i) => i.school)),
  };
}

// ---- 4 · Reports ------------------------------------------------
export interface ReportCard {
  id: string;
  name: string;
  slug: string | null;
  quarter: string | null;
  /** True when `quarter` was derived from admin_created_on, not stored. */
  quarterDerived: boolean;
  heroUrl: string | null;
  figures: { value: string; label: string }[];
}

export interface ReportGroup {
  label: string;
  /** Every campaign in the group got its quarter from a date, not a field. */
  derived: boolean;
  /** year * 4 + quarter, so Q1 2026 sorts above Q4 2025. */
  sortKey: number;
  items: ReportCard[];
}

/**
 * Calendar quarter from a date. CALENDAR, not fiscal — if Postgame's reporting
 * year does not start in January these labels will be a quarter off, and the
 * fix is a stored quarter rather than a different guess here.
 */
export function quarterFromDate(iso: string): { label: string; sortKey: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return { label: `Q${q} ${y}`, sortKey: y * 4 + q };
}

/** Parse a stored "Q1 2026" back into a sort key so both kinds interleave. */
function quarterSortKey(label: string): number {
  const m = /^Q([1-4])\s+(\d{4})$/.exec(label.trim());
  if (!m) return -1;
  return Number(m[2]) * 4 + Number(m[1]);
}

export async function loadReports(
  brandId: string
): Promise<{ groups: ReportGroup[]; total: number }> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("portal_campaigns")
    .select("id, name, slug, lifecycle_status, admin_created_on, quarter, hero_image_url, kpi_targets")
    .eq("brand_id", brandId);

  const wrapped = ((data ?? []) as RawCampaign[])
    .filter((c) => isWrapped(c.lifecycle_status))
    .sort(sortCampaigns);

  const heroes = await loadHeroes(supabase, wrapped.map((c) => c.id));

  const items: ReportCard[] = wrapped.map((c) => {
    // A STORED quarter wins, but only if it is a real value. 12 of CVS's 13
    // non-null quarters are the EMPTY STRING, which is why an earlier cut of
    // this grouped 45 of 46 campaigns under one "no quarter" heading: "" is
    // falsy, so it fell into the fallback bucket alongside the true nulls.
    // Only one row carries an actual quarter ("Q1 2026"), and that row has no
    // admin_created_on — so both sources are needed and neither is optional.
    const stored = (c.quarter ?? "").trim();
    const derived = c.admin_created_on ? quarterFromDate(c.admin_created_on) : null;

    return {
      id: c.id,
      name: c.name ?? "Campaign",
      slug: c.slug,
      quarter: stored || derived?.label || null,
      quarterDerived: !stored && !!derived,
      heroUrl: c.hero_image_url || heroes.get(c.id) || null,
      figures: readFigures(c.kpi_targets, 3),
    };
  });

  // Grouped by quarter, and there is deliberately NO "no quarter" group: a
  // heading that names an absence tells a brand nothing about their own work.
  // Every CVS campaign resolves — 13 from a stored value, 33 from
  // admin_created_on, and zero rows have neither.
  //
  // UNDATED is the honest last resort for a brand where a campaign has no
  // quarter AND no date. It cannot be reached with CVS's data today; the only
  // alternative would be inventing a date, so it stays rather than being
  // pretended away.
  const UNDATED = "Undated";
  const byLabel = new Map<string, ReportCard[]>();
  for (const i of items) {
    const key = i.quarter ?? UNDATED;
    byLabel.set(key, [...(byLabel.get(key) ?? []), i]);
  }

  const ordered: ReportGroup[] = Array.from(byLabel.entries())
    .map(([label, groupItems]) => ({
      label,
      // Marked derived only when EVERY campaign in it came from a date, so a
      // group mixing a stored quarter with derived ones is not mislabelled.
      derived: groupItems.every((i) => i.quarterDerived),
      sortKey: label === UNDATED ? -1 : quarterSortKey(label),
      items: groupItems,
    }))
    // Newest quarter first; anything unparseable or undated sinks to the end.
    .sort((a, b) => b.sortKey - a.sortKey);

  return { groups: ordered, total: items.length };
}

// ---- 5 · Athletes directory -------------------------------------
export interface DirectoryAthlete {
  key: string;
  name: string;
  school: string | null;
  sport: string | null;
  followers: number | null;
  campaigns: number;
  lastCampaign: string | null;
  views: number | null;
  headshotUrl: string | null;
}

interface DirectoryRow {
  athlete_key: string;
  name: string;
  school: string | null;
  sport: string | null;
  followers: number | null;
  campaigns: number;
  last_campaign: string | null;
  top_reel_views: number | null;
  sample_athlete_id: string | null;
}

const DIRECTORY_COLUMNS =
  "athlete_key, name, school, sport, followers, campaigns, last_campaign, top_reel_views, sample_athlete_id";

/** PostgREST refuses to return more than this in one response, whatever .limit says. */
const PAGE = 500;

export async function loadAthleteDirectory(brandId: string) {
  const supabase = createServerSupabase();

  // Deduplicated in SQL (migration 049) — 2,096 CVS rows collapse to 1,501
  // people.
  //
  // FETCHED IN CHUNKS, not with .limit(600). The 600 was a cap I chose to stay
  // under PostgREST's hard 1000-row response ceiling, and it made the page
  // claim "600 of 600" while the brand actually has 1,501 — a number that
  // looked like a total and was really a truncation. Ranged requests walk past
  // the ceiling, so the directory is now complete and the count is honest.
  const rows: DirectoryRow[] = [];
  for (let from = 0; from < 4000; from += PAGE) {
    const { data, error } = await supabase
      .from("portal_brand_athletes")
      .select(DIRECTORY_COLUMNS)
      .eq("brand_id", brandId)
      .order("followers", { ascending: false, nullsFirst: false })
      .order("athlete_key", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) break;
    const chunk = (data ?? []) as DirectoryRow[];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }

  // Headshots only for the leading slice. Rows are ordered by followers, so
  // these are the ones the first pages of the grid show; everything past it
  // falls back to initials, which is already the no-media state. Deliberately
  // NOT one lookup per athlete — 1,501 of those is both a PostgREST ceiling
  // problem and 1,501 image requests.
  const sampleIds = rows
    .map((r) => r.sample_athlete_id)
    .filter((x): x is string => !!x)
    .slice(0, 300);

  const headshots = new Map<string, string>();
  if (sampleIds.length > 0) {
    const { data: media } = await supabase
      .from("media")
      .select("athlete_id, type, file_url, thumbnail_url")
      .in("athlete_id", sampleIds)
      .order("type", { ascending: true });
    for (const m of (media ?? []) as {
      athlete_id: string | null;
      file_url: string | null;
      thumbnail_url: string | null;
    }[]) {
      const url = m.thumbnail_url || m.file_url;
      if (m.athlete_id && url && !headshots.has(m.athlete_id)) headshots.set(m.athlete_id, thumb(url, 160));
    }
  }

  const athletes: DirectoryAthlete[] = rows.map((r) => ({
    key: r.athlete_key,
    name: r.name,
    school: r.school,
    sport: r.sport,
    followers: r.followers,
    campaigns: r.campaigns,
    lastCampaign: r.last_campaign,
    views: r.top_reel_views,
    headshotUrl: r.sample_athlete_id ? headshots.get(r.sample_athlete_id) ?? null : null,
  }));

  const schools = Array.from(
    new Set(athletes.map((a) => a.school).filter((s): s is string => !!s))
  ).sort();
  const sports = Array.from(
    new Set(athletes.map((a) => a.sport).filter((s): s is string => !!s))
  ).sort();

  return { athletes, schools, sports, total: athletes.length };
}

// ---- 6 · Settings -----------------------------------------------
export interface SettingsTeamMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  status: string;
}

export interface SettingsLogoRow {
  variant: string | null;
  kind: string | null;
  url: string | null;
  width: number | null;
  height: number | null;
}

export interface SettingsData {
  team: SettingsTeamMember[];
  logos: SettingsLogoRow[];
}

export async function loadSettings(brandId: string): Promise<SettingsData> {
  const supabase = createServerSupabase();

  const [contactsRes, logosRes] = await Promise.all([
    // brand_contacts is the brand's own team list. A brand user reading their
    // own team is exactly what the Phase 2 brief adds a policy for; until then
    // the app-layer brand_id filter is the fence.
    supabase
      .from("brand_contacts")
      .select("id, role, status, invited_email, signup_email, contact_id")
      .eq("brand_id", brandId),
    supabase
      .from("brand_logos")
      .select("variant, kind, url, width, height")
      .eq("brand_id", brandId),
  ]);

  const contactRows = (contactsRes.data ?? []) as {
    id: string;
    role: string | null;
    status: string;
    invited_email: string | null;
    signup_email: string | null;
    contact_id: string | null;
  }[];

  // Names live on the identity table, not the attachment.
  const ids = contactRows.map((c) => c.contact_id).filter((x): x is string => !!x);
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data } = await supabase.from("postgame_contacts").select("id, name").in("id", ids);
    for (const p of (data ?? []) as { id: string; name: string | null }[]) {
      if (p.name) names.set(p.id, p.name);
    }
  }

  return {
    team: contactRows.map((c) => ({
      id: c.id,
      name: c.contact_id ? names.get(c.contact_id) ?? null : null,
      email: c.signup_email || c.invited_email || null,
      role: c.role,
      status: c.status,
    })),
    logos: (logosRes.data ?? []) as SettingsLogoRow[],
  };
}
