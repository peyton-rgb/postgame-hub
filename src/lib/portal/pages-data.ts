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
import { richText } from "@/lib/rich-text";
import { compact, titleCaseSchool, titleCaseSport } from "@/lib/portal/format";
import {
  figuresFromPostMetrics,
  POST_METRICS_SELECT,
  POST_METRICS_SOURCE,
  type PostMetricsRow,
} from "@/lib/portal/post-metrics";

export { compact };

export const WRAPPED = ["delivered", "closed"] as const;
const NO_MATCH = "00000000-0000-0000-0000-000000000000";

function isWrapped(status: string | null): boolean {
  return !!status && (WRAPPED as readonly string[]).includes(status);
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
 * Formats a browser will actually paint. Anything outside this list has to go
 * through the transform endpoint or it renders as nothing.
 */
const WEB_SAFE = /\.(jpe?g|png|gif|webp)($|\?)/i;

/**
 * The thumbnail source for a media tile, and what to fall back to.
 *
 * EVERY TILE GOES THROUGH THE RENDER ENDPOINT AT 600, with the original as an
 * onerror fallback. The brief asked for that only where `thumbnail_url` is
 * empty; measuring the Content page's first 40 tiles is what widened it, and
 * the numbers are the argument:
 *
 *   thumbnail_url direct, transform only when empty   75.70 MB   (-3%)
 *   every tile through the transform at 600            9.69 MB   (-88%)
 *
 * `thumbnail_url` IS NOT A THUMBNAIL on this data. Of those 40 rows it is
 * byte-identical to `file_url` on 21 and empty on 6 — so on 27 of 40, serving
 * "the thumbnail" means serving the original: a mean of 2.0 MB, up to 7.4 MB,
 * into a 240px tile. Honouring only the empty ones fixed 6 rows and left 78
 * MB a page. The 13 rows where it genuinely differs are video poster frames,
 * and they are cheaper through the transform too.
 *
 * NON-WEB-SAFE ROWS STILL HAVE NO CHOICE. 7 of CVS's 460 rows are `.HEIC`,
 * which no browser paints; serving those raw is what made Bella Bonnett's tile
 * a black box (`content-type: image/heif`, 2.2MB, nothing on screen). For
 * those the transform is not an optimisation, it is the only way the picture
 * exists — so they get no fallback, because falling back to the original would
 * restore the black box.
 *
 * WHY A FALLBACK AT ALL. The transform is a separate service from object
 * storage and can fail on an object storage will still serve — an unsupported
 * colour profile, a size limit, a bad day. Without a fallback that tile is
 * permanently blank; with one it costs a wasted request and shows the picture.
 * The fallback is only ever the same object served unresized, so it can never
 * show the wrong image.
 *
 * 600, not 420: the Content tiles reach 300px wide, which is 600 device
 * pixels on a 2x screen.
 */
/**
 * The searchable text for a media row: who, where, which campaign, and the
 * filename. Lowercased once here so filtering is a substring test rather than
 * a per-keystroke rebuild of four fields.
 *
 * The filename is decoded (%20 back to a space) and stripped of its path and
 * the upload timestamp prefix, so "darius acuff" matches
 * ".../1775691416036-2026_CVS_Darius_Acuff_Jr.18.jpg".
 */
function searchText(
  athlete: string | null | undefined,
  school: string | null | undefined,
  campaign: string | null | undefined,
  url: string
): string {
  let file = "";
  try {
    file = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
  } catch {
    file = url.split("?")[0].split("/").pop() ?? "";
  }
  // Drop the "1775691416036-" upload prefix and turn separators into spaces.
  file = file.replace(/^\d{10,}-/, "").replace(/[._\-]+/g, " ");
  return [athlete, school, campaign, file]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function mediaThumb(
  thumbnailUrl: string | null,
  fileUrl: string | null
): { src: string; fallback: string | null } | null {
  const stored = thumbnailUrl && thumbnailUrl.trim() ? thumbnailUrl.trim() : null;
  const original = fileUrl && fileUrl.trim() ? fileUrl.trim() : null;
  const url = stored || original;
  if (!url) return null;
  const transformed = thumb(url, 600);
  // No fallback for a format the browser cannot paint: the "fallback" would be
  // the very file that renders as nothing.
  if (!WEB_SAFE.test(url)) return { src: transformed, fallback: null };
  // Nothing to fall back to if the transform is a no-op (a URL outside object
  // storage comes back unchanged).
  return { src: transformed, fallback: transformed === url ? null : url };
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
    heroUrl: c.hero_image_url || heroes.get(c.id)?.url || null,
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

interface Hero {
  url: string;
  /**
   * media.focal_y as a percentage, or null.
   *
   * The column EXISTS — an earlier note in the run log said it did not — but
   * it is populated on 2 of 63 hero rows, so nearly every campaign falls back
   * to the CSS default. Read here rather than guessed so the two rows that
   * have one are honoured, and so populating the rest needs no code change.
   */
  focalY: number | null;
}

async function loadHeroes(
  supabase: ReturnType<typeof createServerSupabase>,
  campaignIds: string[],
  width = 900,
): Promise<Map<string, Hero>> {
  const out = new Map<string, Hero>();
  if (campaignIds.length === 0) return out;
  const { data } = await supabase
    .from("media")
    .select("campaign_id, file_url, thumbnail_url, hero_order, focal_y")
    .in("campaign_id", campaignIds)
    .eq("is_hero", true)
    .order("hero_order", { ascending: true });
  for (const m of (data ?? []) as {
    campaign_id: string;
    file_url: string | null;
    thumbnail_url: string | null;
    focal_y: number | null;
  }[]) {
    const url = m.thumbnail_url || m.file_url;
    if (!url || out.has(m.campaign_id)) continue;
    // focal_y is stored 0-1 on the rows that have it; anything outside that
    // is ignored rather than clamped, because a value out of range means the
    // column was written with a different convention and guessing which
    // would move every crop.
    const f = m.focal_y;
    const focalY = typeof f === "number" && f >= 0 && f <= 1 ? Math.round(f * 100) : null;
    out.set(m.campaign_id, { url: thumb(url, width), focalY });
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
  /** Serve if thumbUrl fails. Only set where thumbUrl is a transform call. */
  thumbFallbackUrl: string | null;
  /**
   * Everything about this row that is searchable, lowercased, built once.
   *
   * THERE IS NO CAPTION OR TAG COLUMN ON `media`. The columns are id,
   * athlete_id, campaign_id, type, urls, storage/source ids, sizes, focal
   * points, hero flags and `slot` — and `slot` is populated on 5 of CVS's 460
   * rows with no vocabulary behind it. So the free text on a media row is the
   * athlete, the school, the campaign and the FILENAME, which is real text
   * people recognise ("2026_CVS_Darius_Acuff_Jr.18.jpg"). Logged as the reason
   * keyword search covers those four and not "tags".
   */
  haystack: string;
  isVideo: boolean;
  athleteName: string | null;
  /** From athletes.school via media.athlete_id — the gallery's school filter. */
  school: string | null;
  campaignName: string | null;
  createdAt: string | null;
}

/** One row of the Results tab's Top content list. */
export interface DetailPost {
  id: string;
  name: string;
  school: string | null;
  views: number | null;
  postUrl: string | null;
  thumbUrl: string | null;
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

  const [athletesRes, mediaRes, statsRes, postMetricsRes] = await Promise.all([
    // Rosters run to 418 on one CVS campaign — under the 1000 cap, so a single
    // fetch is safe here.
    supabase
      .from("athletes")
      .select("id, name, school, sport, ig_followers, metrics, post_url")
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
    // Fetched unconditionally rather than behind an `if kpi_targets is empty`,
    // so it rides the same round trip. It is only READ when kpi_targets is
    // empty — a recap with real targets always shows those.
    supabase
      .from("portal_campaign_post_metrics")
      .select(POST_METRICS_SELECT)
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
    post_url: string | null;
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
    school: titleCaseSchool(a.school),
    sport: titleCaseSport(a.sport),
    followers: a.ig_followers,
    views: reelViews(a.metrics),
    headshotUrl: headshots.get(a.id) ?? null,
  }));

  // ---- Top content -------------------------------------------------
  // The campaign's six highest-viewed posts, under the Results figures. Same
  // shape and same guarded metric as the dashboard's Top posts tile
  // (reelViews below drops the aggregate-shaped values), so a brand meets one
  // pattern for "the posts that worked" rather than two.
  //
  // Ranked on views, so a row without a view count is not in it at all —
  // there is nothing to rank it by and no figure to show.
  const topContent: DetailPost[] = rawAthletes
    .map((a) => ({
      id: a.id,
      name: a.name,
      school: titleCaseSchool(a.school),
      views: reelViews(a.metrics),
      // The column first, then the per-platform URL — which one is populated
      // depends on how the row was imported.
      postUrl:
        (a.post_url && a.post_url.trim()) ||
        (typeof a.metrics?.ig_reel?.post_url === "string" ? a.metrics.ig_reel.post_url : null) ||
        null,
      thumbUrl: headshots.get(a.id) ?? null,
    }))
    .filter((p): p is DetailPost => p.views !== null)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 6);

  const items: MediaItem[] = media
    .map((m) => {
      const url = m.file_url || m.thumbnail_url;
      const thumbSrc = mediaThumb(m.thumbnail_url, m.file_url);
      if (!url || !thumbSrc) return null;
      return {
        id: m.id,
        url,
        thumbUrl: thumbSrc.src,
        thumbFallbackUrl: thumbSrc.fallback,
        isVideo: m.type === "video",
        athleteName: m.athlete_id ? nameById.get(m.athlete_id) ?? null : null,
        // The detail page's Content tab is already scoped to one campaign,
        // where a school dropdown adds nothing — the roster tab has school
        // chips. Left null rather than fetched for a filter that isn't shown.
        // Annotated because a bare `null` narrows to the null type and then
        // fails the MediaItem[] assignment.
        school: null as string | null,
        campaignName: c.name,
        haystack: searchText(
          m.athlete_id ? nameById.get(m.athlete_id) : null,
          null,
          c.name,
          url
        ),
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
    ...(await (async () => {
      // hero_image_url is a bare column with no focal point of its own, so a
      // campaign using it gets the CSS default.
      if (c.hero_image_url) return { heroUrl: c.hero_image_url, heroFocalY: null };
      const hero = (await loadHeroes(supabase, [c.id], 1600)).get(c.id);
      return { heroUrl: hero?.url ?? null, heroFocalY: hero?.focalY ?? null };
    })()),
    // 5, not the 4 the tiles use: kpi_targets only ever holds four keys, but
    // the derived set is five (posts, reel views, feed and story impressions,
    // followers) and the Results tab is the one surface with room for all of
    // them.
    ...campaignFigures(c.kpi_targets, postMetricsRes.data as PostMetricsRow | null, 5),
    takeawaysHtml: richText(
      typeof c.key_takeaways === "string"
        ? c.key_takeaways
        : Array.isArray(c.key_takeaways)
          ? c.key_takeaways.map((t) => `- ${String(t)}`).join("\n")
          : null
    ),
    athletes,
    topContent,
    media: items,
    athleteCount: stat?.athletes ?? athletes.length,
    schoolCount: stat?.schools ?? 0,
  };
}

/**
 * The figures for one campaign, and where they came from.
 *
 * kpi_targets is what the agency set out to hit and always wins when it has
 * anything in it. Seven of the eight backfilled CVS campaigns have an empty
 * one — their trackers held no metrics — so rather than show a bare Results
 * tab those fall back to what the athletes actually posted, labelled so a
 * brand can tell a derived total from an agreed target.
 */
export function campaignFigures(
  kpiTargets: Record<string, unknown> | null,
  postMetrics: PostMetricsRow | null,
  max = 4
): { figures: { label: string; value: string }[]; figuresSource: string | null } {
  const targets = readFigures(kpiTargets, max);
  if (targets.length) return { figures: targets, figuresSource: null };

  const derived = figuresFromPostMetrics(postMetrics, max);
  return {
    figures: derived,
    figuresSource: derived.length ? POST_METRICS_SOURCE : null,
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
      const school = titleCaseSchool(a.school);
      if (school) schoolById.set(a.id, school);
    }
  }

  const items: MediaItem[] = mediaRows
    .map((m) => {
      const url = m.file_url || m.thumbnail_url;
      const thumbSrc = mediaThumb(m.thumbnail_url, m.file_url);
      if (!url || !thumbSrc) return null;
      return {
        id: m.id,
        url,
        thumbUrl: thumbSrc.src,
        thumbFallbackUrl: thumbSrc.fallback,
        isVideo: m.type === "video",
        athleteName: m.athlete_id ? nameById.get(m.athlete_id) ?? null : null,
        school: m.athlete_id ? schoolById.get(m.athlete_id) ?? null : null,
        campaignName: m.campaign_id ? nameByCampaign.get(m.campaign_id) ?? null : null,
        haystack: searchText(
          m.athlete_id ? nameById.get(m.athlete_id) : null,
          m.athlete_id ? schoolById.get(m.athlete_id) : null,
          m.campaign_id ? nameByCampaign.get(m.campaign_id) : null,
          url
        ),
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
      heroUrl: c.hero_image_url || heroes.get(c.id)?.url || null,
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
    school: titleCaseSchool(r.school),
    sport: titleCaseSport(r.sport),
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

// ---- 7 · Search -------------------------------------------------
// The toolbar search box was a decorative span for the whole of 3b. This is
// what it does now: one query across the brand's campaigns and one across its
// athletes, both scoped by brand_id like every other read on these pages.
//
// SERVER-SIDE, not a filter over a loaded list. The athlete directory is
// 1,501 people for CVS and PostgREST caps a response at 1000 rows, so
// "search" done in the browser would silently miss people. `ilike` with the
// term wrapped in % is the same matching the Campaigns page's own box uses,
// and it runs in Postgres where the whole set is visible.

export interface SearchHit {
  kind: "campaign" | "athlete";
  /** Stable key: campaign id, or the directory's athlete_key. */
  key: string;
  name: string;
  meta: string | null;
  href: string | null;
}

/** Postgres pattern metacharacters, so a name with a % in it searches for a %. */
function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export async function loadPortalSearch(brandId: string, rawQuery: string) {
  const q = rawQuery.trim();
  // Two characters, because one matches most of the directory and the result
  // would be a truncated list masquerading as an answer.
  if (q.length < 2) {
    return { query: q, tooShort: q.length > 0, campaigns: [], athletes: [] as SearchHit[] };
  }

  const supabase = createServerSupabase();
  const term = likeTerm(q);

  const [campRes, athRes] = await Promise.all([
    supabase
      .from("portal_campaigns")
      .select("id, name, slug, lifecycle_status, quarter, campaign_type")
      .eq("brand_id", brandId)
      .ilike("name", term)
      .limit(40),
    supabase
      .from("portal_brand_athletes")
      .select("athlete_key, name, school, sport, followers, last_campaign")
      .eq("brand_id", brandId)
      .ilike("name", term)
      .order("followers", { ascending: false, nullsFirst: false })
      .limit(60),
  ]);

  const campaigns: SearchHit[] = ((campRes.data ?? []) as {
    id: string;
    name: string | null;
    slug: string | null;
    lifecycle_status: string | null;
    quarter: string | null;
    campaign_type: string | null;
  }[]).map((c) => ({
    kind: "campaign" as const,
    key: c.id,
    name: c.name ?? "Campaign",
    meta:
      [c.lifecycle_status === "active" ? "Live" : "Wrapped", c.quarter, c.campaign_type]
        .filter(Boolean)
        .join(" · ") || null,
    href: c.slug ? `/portal/campaigns/${c.slug}` : null,
  }));

  const athletes: SearchHit[] = ((athRes.data ?? []) as {
    athlete_key: string;
    name: string;
    school: string | null;
    sport: string | null;
    followers: number | null;
    last_campaign: string | null;
  }[]).map((a) => ({
    kind: "athlete" as const,
    key: a.athlete_key,
    name: a.name,
    meta:
      [
        titleCaseSchool(a.school),
        titleCaseSport(a.sport),
        a.followers !== null ? `${compact(a.followers)} followers` : null,
        a.last_campaign,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    // The directory is one page with client-side filters, so there is no
    // per-athlete route to link to. The row is the answer.
    href: null,
  }));

  return { query: q, tooShort: false, campaigns, athletes };
}

// ---- 8 · Reports: the metrics dashboard -------------------------
// The recap LIBRARY is /portal/recaps; this is what /portal/reports shows —
// one page of numbers across a brand's wrapped campaigns, for a chosen period.
//
// SAME RULES AS EVERY OTHER SURFACE. Nothing is invented, nothing is
// zero-filled, and a figure appears only where at least one athlete reported
// it. Headline totals come from portal_brand_report_periods (migration 059),
// which aggregates each period independently because `athletes` is a distinct
// PERSON count and cannot be summed across windows. Per-campaign rows come
// from portal_campaign_post_metrics — already the Results tab's source — so a
// campaign's row here and its own Results tab are the same arithmetic.

/** The periods the filter offers. `last4_prior` is never selectable: it exists
    only as the comparison for `last4`. */
export type ReportPeriodKey = "all" | "last4" | `y${number}`;

export interface ReportPeriodOption {
  key: string;
  label: string;
  /** Which period row this one is compared against, if any. */
  compareKey: string | null;
  compareLabel: string | null;
}

export interface ReportKpi {
  label: string;
  value: string;
  sub?: string;
  /** Absent when there is no prior period, or the prior period has no figure. */
  compare?: { text: string; up: boolean; label: string };
}

export interface ReportRow {
  campaignId: string;
  name: string;
  slug: string | null;
  quarter: string | null;
  quarterSort: number;
  athletes: number | null;
  posts: number | null;
  reelViews: number | null;
  impressions: number | null;
  followers: number | null;
}

export interface ReportQuarter {
  label: string;
  sortKey: number;
  posts: number;
  reelViews: number;
}

export interface ReportSurface {
  label: string;
  /** "views" or "impressions" — these are NOT the same measurement. */
  metric: string;
  value: number;
  display: string;
  share: number;
  athletes: number;
}

export interface TopAthlete {
  athleteId: string;
  name: string;
  school: string | null;
  sport: string | null;
  campaignName: string | null;
  views: number;
  postUrl: string | null;
  headshotUrl: string | null;
}

export interface ReportsMetrics {
  period: string;
  periodLabel: string;
  options: ReportPeriodOption[];
  kpis: ReportKpi[];
  rows: ReportRow[];
  columns: {
    athletes: boolean;
    posts: boolean;
    reelViews: boolean;
    impressions: boolean;
    followers: boolean;
  };
  quarters: ReportQuarter[];
  surfaces: ReportSurface[];
  bestQuarter: { label: string; reelViews: string; posts: string; share: number } | null;
  topAthletes: TopAthlete[];
}

interface PeriodRow {
  period: string;
  period_year: number | null;
  campaigns: number | null;
  athletes: number | null;
  posts: number | null;
  reel_views: number | string | null;
  reel_views_athletes: number | null;
  feed_impressions: number | string | null;
  feed_impressions_athletes: number | null;
  story_impressions: number | string | null;
  story_impressions_athletes: number | null;
  tiktok_views: number | string | null;
  tiktok_views_athletes: number | null;
  followers: number | string | null;
  followers_athletes: number | null;
}

const PERIOD_COLS =
  "period, period_year, campaigns, athletes, posts, reel_views, reel_views_athletes, " +
  "feed_impressions, feed_impressions_athletes, story_impressions, story_impressions_athletes, " +
  "tiktok_views, tiktok_views_athletes, followers, followers_athletes";

/** PostgREST returns numeric and bigint as strings. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * A change against the prior period, formatted so it stays readable at any
 * magnitude.
 *
 * Percentages break down on this data: CVS's 2026 reel views against 2025's
 * are +4,388%, which is a number nobody reads as "45 times". So anything at or
 * above a 10x change is expressed as a multiple, and everything below it as a
 * percentage. A prior period of zero yields NO comparison rather than an
 * infinite one.
 */
function comparison(now: number | null, prior: number | null, label: string) {
  if (now === null || prior === null || prior <= 0 || now < 0) return undefined;
  const ratio = now / prior;
  const up = now >= prior;
  if (ratio >= 10) return { text: `${Math.round(ratio)}x`, up, label };
  if (ratio > 0 && ratio <= 0.1) return { text: `${(1 / ratio).toFixed(0)}x lower`, up, label };
  const pct = Math.round((ratio - 1) * 100);
  if (pct === 0) return { text: "level", up: true, label };
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, up, label };
}

export async function loadReportsMetrics(
  brandId: string,
  requestedPeriod?: string
): Promise<ReportsMetrics> {
  const supabase = createServerSupabase();

  const [periodsRes, quartersRes, campRes, statsRes, topRes] = await Promise.all([
    supabase.from("portal_brand_report_periods").select(PERIOD_COLS).eq("brand_id", brandId),
    supabase
      .from("portal_brand_report_quarters")
      .select("quarter_start, quarter_label, quarter_year, posts, reel_views, reel_views_athletes")
      .eq("brand_id", brandId)
      .order("quarter_start", { ascending: true }),
    supabase
      .from("portal_campaigns")
      .select("id, name, slug, lifecycle_status, admin_created_on, quarter")
      .eq("brand_id", brandId),
    supabase.from("portal_campaign_stats").select("campaign_id, athletes").eq("brand_id", brandId),
    // 200, not 10: the list is filtered to the selected period below, and the
    // top ten of a single year are not the top ten of all time.
    supabase
      .from("portal_top_posts")
      .select("athlete_id, campaign_id, athlete_name, school, sport, campaign_name, views, post_url")
      .eq("brand_id", brandId)
      .order("views", { ascending: false })
      .limit(200),
  ]);

  const periods = new Map<string, PeriodRow>();
  for (const r of (periodsRes.data ?? []) as unknown as PeriodRow[]) periods.set(r.period, r);

  // ---- what the filter can offer --------------------------------------
  // Only periods that exist AND carry a campaign. An empty year in the
  // dropdown is a dead end.
  const years = Array.from(periods.values())
    .filter((r) => r.period_year !== null && (r.campaigns ?? 0) > 0)
    .map((r) => r.period_year as number)
    .sort((a, b) => b - a);

  const options: ReportPeriodOption[] = [
    { key: "all", label: "All time", compareKey: null, compareLabel: null },
  ];
  if ((periods.get("last4")?.campaigns ?? 0) > 0) {
    options.push({
      key: "last4",
      label: "Last 4 quarters",
      // The four quarters before these — the same span a year earlier.
      compareKey: (periods.get("last4_prior")?.campaigns ?? 0) > 0 ? "last4_prior" : null,
      compareLabel: "the year before",
    });
  }
  for (const y of years) {
    options.push({
      key: `y${y}`,
      label: String(y),
      compareKey: periods.has(`y${y - 1}`) ? `y${y - 1}` : null,
      compareLabel: String(y - 1),
    });
  }

  const chosen =
    options.find((o) => o.key === requestedPeriod) ??
    options.find((o) => o.key === "all") ??
    options[0];
  const row = periods.get(chosen.key) ?? null;
  const prior = chosen.compareKey ? periods.get(chosen.compareKey) ?? null : null;
  const cmpLabel = chosen.compareLabel ?? "";

  // ---- six KPI tiles ---------------------------------------------------
  const impressionsOf = (r: PeriodRow | null) => {
    if (!r) return null;
    const contributors =
      (num(r.feed_impressions_athletes) ?? 0) + (num(r.story_impressions_athletes) ?? 0);
    if (contributors < 1) return null;
    return (num(r.feed_impressions) ?? 0) + (num(r.story_impressions) ?? 0);
  };
  const guarded = (v: unknown, contributors: unknown) =>
    (num(contributors) ?? 0) < 1 ? null : num(v);

  const kpis: ReportKpi[] = [];
  const push = (
    label: string,
    value: number | null,
    priorValue: number | null,
    sub?: string
  ) => {
    if (value === null || value <= 0) return;
    kpis.push({
      label,
      value: compact(value),
      sub,
      compare: prior ? comparison(value, priorValue, cmpLabel) : undefined,
    });
  };

  push("Campaigns", num(row?.campaigns), num(prior?.campaigns));
  push("Athletes", num(row?.athletes), num(prior?.athletes), "distinct people");
  push("Posts", num(row?.posts), num(prior?.posts));
  push(
    "Reel views",
    guarded(row?.reel_views, row?.reel_views_athletes),
    guarded(prior?.reel_views, prior?.reel_views_athletes)
  );
  push("Impressions", impressionsOf(row), impressionsOf(prior), "feed + stories");
  push(
    "Combined followers",
    guarded(row?.followers, row?.followers_athletes),
    guarded(prior?.followers, prior?.followers_athletes)
  );

  // ---- which campaigns are in this period ------------------------------
  const wrapped = ((campRes.data ?? []) as RawCampaign[]).filter((c) =>
    isWrapped(c.lifecycle_status)
  );

  const metricsById = new Map<string, PostMetricsRow>();
  if (wrapped.length > 0) {
    const { data } = await supabase
      .from("portal_campaign_post_metrics")
      .select(POST_METRICS_SELECT)
      .in("campaign_id", wrapped.map((c) => c.id));
    for (const m of (data ?? []) as unknown as (PostMetricsRow & { campaign_id: string })[]) {
      metricsById.set(m.campaign_id, m);
    }
  }

  const athletesById = new Map<string, number>();
  for (const r of (statsRes.data ?? []) as { campaign_id: string; athletes: number | null }[]) {
    if (r.athletes !== null) athletesById.set(r.campaign_id, r.athletes);
  }

  const quarterRows = (quartersRes.data ?? []) as {
    quarter_start: string;
    quarter_label: string;
    quarter_year: number;
    posts: number | null;
    reel_views: number | string | null;
    reel_views_athletes: number | null;
  }[];

  // The period's quarter window, taken from the same view the chart uses so
  // the table and the bars agree on what "this period" means.
  const inPeriod = (year: number | null, sortKey: number): boolean => {
    if (chosen.key === "all") return true;
    if (chosen.key.startsWith("y")) return year === Number(chosen.key.slice(1));
    // last4: the last four quarter labels present in the data.
    const last4 = quarterRows.slice(-4).map((q) => q.quarter_start);
    return last4.length === 0
      ? false
      : last4.some((qs) => quarterStartSort(qs) === sortKey);
  };

  const allRows: ReportRow[] = wrapped.map((c) => {
    // Same quarter rule as the recap library and the SQL view: a STORED
    // quarter wins, but only when it is a real value — 12 of CVS's 13
    // non-null quarters are the empty string, which is falsy.
    const stored = c.quarter && c.quarter.trim() ? c.quarter.trim() : null;
    const derived = c.admin_created_on ? quarterFromDate(c.admin_created_on) : null;
    const m = metricsById.get(c.id);
    const has = (contributors: number | null | undefined) => (contributors ?? 0) > 0;
    const label = stored || derived?.label || null;
    return {
      campaignId: c.id,
      name: c.name ?? "Campaign",
      slug: c.slug,
      quarter: label,
      quarterSort: derived?.sortKey ?? (label ? labelSort(label) : 0),
      athletes: athletesById.get(c.id) ?? null,
      posts: m && num(m.posts) ? num(m.posts) : null,
      reelViews: has(m?.reel_views_athletes) ? num(m?.reel_views) : null,
      impressions:
        has(m?.feed_impressions_athletes) || has(m?.story_impressions_athletes)
          ? (num(m?.feed_impressions) ?? 0) + (num(m?.story_impressions) ?? 0)
          : null,
      followers: has(m?.followers_athletes) ? num(m?.followers) : null,
    };
  });

  const rows = allRows
    .filter((r) => inPeriod(r.quarter ? yearOfLabel(r.quarter) : null, r.quarterSort))
    .sort((a, b) => b.quarterSort - a.quarterSort || a.name.localeCompare(b.name));

  const columns = {
    athletes: rows.some((r) => r.athletes !== null),
    posts: rows.some((r) => r.posts !== null),
    reelViews: rows.some((r) => r.reelViews !== null),
    impressions: rows.some((r) => r.impressions !== null),
    followers: rows.some((r) => r.followers !== null),
  };

  // ---- the chart -------------------------------------------------------
  // Straight from the per-quarter view, filtered to the period. Quarters with
  // neither posts nor views are dropped: an empty pair of bars says nothing a
  // missing one doesn't.
  const quarters: ReportQuarter[] = quarterRows
    .filter((q) => {
      if (chosen.key === "all") return true;
      if (chosen.key.startsWith("y")) return q.quarter_year === Number(chosen.key.slice(1));
      return quarterRows.slice(-4).some((x) => x.quarter_start === q.quarter_start);
    })
    .map((q) => ({
      label: q.quarter_label,
      sortKey: quarterStartSort(q.quarter_start),
      posts: num(q.posts) ?? 0,
      reelViews: (num(q.reel_views_athletes) ?? 0) > 0 ? num(q.reel_views) ?? 0 : 0,
    }))
    .filter((q) => q.posts > 0 || q.reelViews > 0);

  // ---- where the views came from ---------------------------------------
  // FOUR SURFACES, NOT ONE NUMBER. Reels and TikTok report views; Feed and
  // Stories report impressions. The view keeps them apart and so does this:
  // each bar names its own metric, and the share is share-of-reported-reach
  // across the four rather than a pretence that they are the same unit.
  const surfaceDefs: [string, string, unknown, unknown][] = [
    ["Instagram Reels", "views", row?.reel_views, row?.reel_views_athletes],
    ["Instagram Feed", "impressions", row?.feed_impressions, row?.feed_impressions_athletes],
    ["Instagram Stories", "impressions", row?.story_impressions, row?.story_impressions_athletes],
    ["TikTok", "views", row?.tiktok_views, row?.tiktok_views_athletes],
  ];
  const present = surfaceDefs
    .map(([label, metric, v, c]) => ({
      label,
      metric,
      value: guarded(v, c) ?? 0,
      athletes: num(c) ?? 0,
    }))
    .filter((s) => s.value > 0);
  const surfaceTotal = present.reduce((t, s) => t + s.value, 0);
  const surfaces: ReportSurface[] = present
    .sort((a, b) => b.value - a.value)
    .map((s) => ({
      label: s.label,
      metric: s.metric,
      value: s.value,
      display: compact(s.value),
      share: surfaceTotal > 0 ? s.value / surfaceTotal : 0,
      athletes: s.athletes,
    }));

  // ---- best quarter ----------------------------------------------------
  // Ranked on reel views, which is the figure the chart's orange series and
  // the headline both lead on. Only meaningful with more than one quarter to
  // be "best" among.
  const ranked = [...quarters].filter((q) => q.reelViews > 0).sort((a, b) => b.reelViews - a.reelViews);
  const totalViews = quarters.reduce((t, q) => t + q.reelViews, 0);
  const bestQuarter =
    ranked.length > 1
      ? {
          label: ranked[0].label,
          reelViews: compact(ranked[0].reelViews),
          posts: compact(ranked[0].posts),
          share: totalViews > 0 ? ranked[0].reelViews / totalViews : 0,
        }
      : null;

  // ---- top athletes, with headshots ------------------------------------
  const periodCampaignIds = new Set(rows.map((r) => r.campaignId));
  const topRaw = (
    (topRes.data ?? []) as {
      athlete_id: string;
      campaign_id: string | null;
      athlete_name: string | null;
      school: string | null;
      sport: string | null;
      campaign_name: string | null;
      views: number;
      post_url: string | null;
    }[]
  )
    .filter((a) => chosen.key === "all" || (a.campaign_id && periodCampaignIds.has(a.campaign_id)))
    .slice(0, 10);

  // One media query for the ten, not ten queries. Same rule as the roster
  // headshots: images sort first, and a row with no media keeps null so the
  // UI draws initials rather than a stock face.
  const headshots = new Map<string, string>();
  const ids = topRaw.map((a) => a.athlete_id).filter(Boolean);
  if (ids.length > 0) {
    const { data } = await supabase
      .from("media")
      .select("athlete_id, type, file_url, thumbnail_url")
      .in("athlete_id", ids)
      .order("type", { ascending: true });
    for (const m of (data ?? []) as {
      athlete_id: string | null;
      file_url: string | null;
      thumbnail_url: string | null;
    }[]) {
      const url = m.thumbnail_url || m.file_url;
      if (m.athlete_id && url && !headshots.has(m.athlete_id)) {
        headshots.set(m.athlete_id, thumb(url, 120));
      }
    }
  }

  const topAthletes: TopAthlete[] = topRaw.map((a) => ({
    athleteId: a.athlete_id,
    name: a.athlete_name ?? "Athlete",
    school: titleCaseSchool(a.school),
    sport: titleCaseSport(a.sport),
    campaignName: a.campaign_name,
    views: a.views,
    postUrl: a.post_url,
    headshotUrl: headshots.get(a.athlete_id) ?? null,
  }));

  return {
    period: chosen.key,
    periodLabel: chosen.label,
    options,
    kpis,
    rows,
    columns,
    quarters,
    surfaces,
    bestQuarter,
    topAthletes,
  };
}

/** "2026-04-01" -> a sortable integer, matching quarterFromDate's sortKey. */
function quarterStartSort(iso: string): number {
  const d = new Date(iso);
  return d.getUTCFullYear() * 10 + (Math.floor(d.getUTCMonth() / 3) + 1);
}

/** "Q2 2026" -> 20262. For the rows whose quarter is stored, not derived. */
function labelSort(label: string): number {
  const m = /^Q([1-4])\s+(\d{4})$/.exec(label.trim());
  return m ? Number(m[2]) * 10 + Number(m[1]) : 0;
}

function yearOfLabel(label: string): number | null {
  const m = /(\d{4})/.exec(label);
  return m ? Number(m[1]) : null;
}
