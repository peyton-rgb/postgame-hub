// ============================================================
// Brand dashboard data (Phase 3a).
//
// One loader, one typed result. Every tile reads a field off DashboardData and
// renders it — no tile queries.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: every number on the dashboard comes
// from a query or is not shown. No defaults that could be mistaken for data,
// no zero-fills standing in for "we don't know", no dashes where a real value
// belongs. Tiles with no backing data return an explicit empty shape and the
// UI renders their empty state.
//
// COUNTS COME FROM SQL, NOT FROM COUNTING ROWS IN JS. PostgREST caps a
// response at 1000 rows regardless of .limit(), and there are 9,436 athletes —
// an earlier cut of this file fetched them and counted locally, which silently
// reported 92 athletes for a brand that has 1,523. Aggregates live in
// portal_campaign_stats / portal_brand_stats (migration 048). The only athlete
// ROWS fetched are the six the roster actually shows.
//
// WHAT IS AND ISN'T THERE, verified against CVS on 2026-09-09:
//   real      live campaign count, athletes (all-time fallback), latest
//             wrapped photo, latest roster, top posts, campaign cards
//   empty     waiting-on-you (review_sessions has 0 rows database-wide),
//             posts-going-live / deliverables / this-week (their source,
//             athlete_deliverables, has 4 rows database-wide, no platform
//             column and no scheduled-date column)
// Those four are left deliberately unsourced rather than approximated.
//
// Reads use the CALLER's Supabase client, never the service role — the Phase 3
// brief forbids service-role reads under the portal. Campaigns come from the
// portal_campaigns view (migration 046), which cannot expose settings/budget.
// brand_id is passed explicitly into every query even though Phase 2's RLS
// will also enforce it. Belt and braces.
// ============================================================

import { createServerSupabase } from "@/lib/supabase-server";
import { titleCaseSchool, titleCaseSport } from "@/lib/portal/format";
import { campaignFigures } from "@/lib/portal/pages-data";
import { POST_METRICS_SELECT, type PostMetricsRow } from "@/lib/portal/post-metrics";

/** delivered OR closed. Phase 3 brief §2: "delivered (and closed until backfilled)". */
export const WRAPPED_STATUSES = ["delivered", "closed"] as const;

export interface DashboardKpi {
  value: string;
  label: string;
  /** Second line under the label, for qualifying a figure without a bare dot. */
  sub?: string;
}

export interface RosterRow {
  athleteId: string;
  name: string;
  school: string | null;
  sport: string | null;
  headshotUrl: string | null;
  followers: number | null;
  views: number | null;
}

export interface TopPost {
  athleteId: string;
  name: string;
  school: string | null;
  campaignName: string | null;
  views: number;
  postUrl: string | null;
  thumbnailUrl: string | null;
}

export interface CampaignCard {
  id: string;
  name: string;
  slug: string | null;
  live: boolean;
  quarter: string | null;
  /** Second line on a live card: what kind of campaign this is. */
  campaignType: string | null;
  platform: string | null;
  athletes: number;
}

export interface LatestWrapped {
  name: string;
  slug: string | null;
  heroUrl: string | null;
  /** Only figures actually present. An absent figure is omitted, never zeroed. */
  figures: { label: string; value: string }[];
  /** "From post metrics" when the figures were summed rather than set. */
  figuresSource: string | null;
}

export interface RosterTile {
  /** "Live campaign" when an active campaign has athletes, else "Latest roster". */
  title: string;
  campaignName: string;
  /** So "All athletes" can go to THIS campaign's roster, not the directory. */
  campaignSlug: string | null;
  subline: string;
  rows: RosterRow[];
}

export interface DashboardData {
  kpis: DashboardKpi[];
  latestWrapped: LatestWrapped | null;
  roster: RosterTile | null;
  topPosts: TopPost[];
  campaigns: CampaignCard[];
  liveCount: number;
  wrappedCount: number;
  /** Open review sessions on this brand's campaigns. 0 brand-wide today. */
  waitingCount: number;
}

interface CampaignRow {
  id: string;
  name: string | null;
  slug: string | null;
  lifecycle_status: string | null;
  admin_created_on: string | null;
  quarter: string | null;
  campaign_type: string | null;
  platform: string | null;
  kpi_targets: Record<string, unknown> | null;
}

interface StatRow {
  campaign_id: string;
  athletes: number | null;
  schools: number | null;
}

/** Newest first. admin_created_on is a date and is null on some rows. */
function byNewest(a: CampaignRow, b: CampaignRow): number {
  const av = a.admin_created_on ?? "";
  const bv = b.admin_created_on ?? "";
  if (av === bv) return (a.name ?? "").localeCompare(b.name ?? "");
  return av < bv ? 1 : -1;
}

const NO_MATCH = "00000000-0000-0000-0000-000000000000";

export async function loadBrandDashboard(brandId: string): Promise<DashboardData> {
  const supabase = createServerSupabase();

  const [campaignsRes, statsRes, brandStatsRes, topPostsRes] = await Promise.all([
    supabase
      .from("portal_campaigns")
      .select("id, name, slug, lifecycle_status, admin_created_on, quarter, campaign_type, platform, kpi_targets")
      .eq("brand_id", brandId),
    supabase
      .from("portal_campaign_stats")
      .select("campaign_id, athletes, schools")
      .eq("brand_id", brandId),
    supabase
      .from("portal_brand_stats")
      .select("athletes_active, athletes_all_time")
      .eq("brand_id", brandId)
      .maybeSingle(),
    supabase
      .from("portal_top_posts")
      .select("athlete_id, athlete_name, school, campaign_name, views, post_url")
      .eq("brand_id", brandId)
      .order("views", { ascending: false })
      // 6, not 3: the tile is three grid rows tall and three rows left half
      // of it empty.
      .limit(6),
  ]);

  const campaigns = ((campaignsRes.data ?? []) as CampaignRow[]).slice().sort(byNewest);

  const stats = new Map<string, StatRow>();
  for (const s of (statsRes.data ?? []) as StatRow[]) stats.set(s.campaign_id, s);
  const athleteCount = (id: string) => stats.get(id)?.athletes ?? 0;

  // ---- Waiting on you ---------------------------------------------
  // Kept wired to review_sessions per the brief, brand-scoped through
  // campaign_id because review_sessions carries no brand_id. head+count so
  // the count comes from SQL and no rows cross the wire. The table has 0 rows
  // database-wide today, so this is a real 0, not a placeholder.
  //
  // NAME-TWIN: review_sessions.campaign_id REFERENCES brand_campaigns, NOT
  // campaign_recaps. An earlier cut of this passed campaign_recaps ids
  // straight in, which can never match a brand_campaigns key — it would have
  // returned 0 forever, and looked correct today only because the table is
  // empty. The ids have to come from brand_campaigns for this brand.
  // Confirmed in information_schema; same trap as campaign_optins vs
  // optin_campaigns in CLAUDE.md.
  const brandCampaignsRes = await supabase
    .from("brand_campaigns")
    .select("id")
    .eq("brand_id", brandId);
  const brandCampaignIds = ((brandCampaignsRes.data ?? []) as { id: string }[]).map((r) => r.id);

  const waitingRes = await supabase
    .from("review_sessions")
    .select("id", { count: "exact", head: true })
    .in("campaign_id", brandCampaignIds.length ? brandCampaignIds : [NO_MATCH])
    .is("brand_decision", null);
  const waitingCount = waitingRes.count ?? 0;

  const live = campaigns.filter((c) => c.lifecycle_status === "active");
  const wrapped = campaigns.filter(
    (c) => c.lifecycle_status && (WRAPPED_STATUSES as readonly string[]).includes(c.lifecycle_status)
  );

  // ---- KPIs --------------------------------------------------------
  //
  // Athletes: distinct athletes on ACTIVE campaigns. When that is zero — which
  // it is for CVS today, every active campaign having an empty roster — fall
  // back to the all-time distinct count under a label that says so, rather
  // than showing a bare 0 next to a live campaign count.
  const brandStats = (brandStatsRes.data ?? null) as {
    athletes_active: number | null;
    athletes_all_time: number | null;
  } | null;
  const activeAthletes = brandStats?.athletes_active ?? 0;
  const allTimeAthletes = brandStats?.athletes_all_time ?? 0;

  const kpis: DashboardKpi[] = [
    { value: String(live.length), label: "Live campaigns" },
    // "Athletes / all campaigns" rather than "Athletes · all time". The
    // qualifier is what makes the number honest — it is every athlete the
    // brand has ever run with, not a live count — so it gets its own line
    // instead of being crammed after a dot.
    //
    // "all campaigns", not "across all campaigns": at 14px the longer phrase
    // is wider than the figure above it and wrapped to three lines under the
    // KPI. Both sub-labels stay on ONE line (see .pgd-kpi small).
    activeAthletes > 0
      ? { value: String(activeAthletes), label: "Athletes", sub: "live campaigns" }
      : { value: String(allTimeAthletes), label: "Athletes", sub: "all campaigns" },
    // Reach · 14 days is HIDDEN, not zeroed: no verified reach field exists on
    // delivered recaps in a window. The brief says hide it, so it is absent
    // from this array rather than present and empty.
    //
    // POSTS THIS MONTH IS NOW HIDDEN ON THE SAME RULE. It reads
    // athlete_deliverables.posted_at, which is null on every row in that
    // table — so "0" was not a measurement, it was the absence of one wearing
    // a figure's clothes. A brand reading 0 posts this month next to a live
    // campaign concludes their athletes have stopped posting. It comes back
    // the moment posted_at carries dates, which is the only thing that would
    // make it true.
  ];

  // ---- Latest wrapped ---------------------------------------------
  // Most recent wrapped campaign THAT HAS A HERO PHOTO. This is a photo tile;
  // the most recent wrapped campaign overall has no hero media and would
  // render as an empty rectangle.
  const heroRes = await supabase
    .from("media")
    .select("campaign_id, file_url, thumbnail_url, hero_order")
    .in("campaign_id", wrapped.length ? wrapped.map((c) => c.id) : [NO_MATCH])
    .eq("is_hero", true)
    .order("hero_order", { ascending: true });

  const heroByCampaign = new Map<string, string>();
  for (const m of (heroRes.data ?? []) as {
    campaign_id: string;
    file_url: string | null;
    thumbnail_url: string | null;
  }[]) {
    const url = m.file_url || m.thumbnail_url;
    if (url && m.campaign_id && !heroByCampaign.has(m.campaign_id)) {
      heroByCampaign.set(m.campaign_id, url);
    }
  }

  const wrappedWithHero = wrapped.find((c) => heroByCampaign.has(c.id)) ?? null;

  // One row, only when there is a tile to fill. Same fallback rule as the
  // campaign detail page's Results tab — the tile and the page it links to
  // must not disagree about a campaign's numbers.
  const wrappedPostMetrics = wrappedWithHero
    ? ((
        await supabase
          .from("portal_campaign_post_metrics")
          .select(POST_METRICS_SELECT)
          .eq("campaign_id", wrappedWithHero.id)
          .maybeSingle()
      ).data as PostMetricsRow | null)
    : null;

  const latestWrapped: LatestWrapped | null = wrappedWithHero
    ? {
        name: wrappedWithHero.name ?? "Campaign",
        slug: wrappedWithHero.slug,
        heroUrl: heroByCampaign.get(wrappedWithHero.id) ?? null,
        ...campaignFigures(wrappedWithHero.kpi_targets, wrappedPostMetrics, 3),
      }
    : null;

  // ---- Roster ------------------------------------------------------
  // Most recent ACTIVE campaign that has athletes. If none of the active
  // campaigns has any — the case for CVS — fall back to the most recent
  // wrapped campaign with athletes and retitle the tile, so it never claims
  // to be showing a live roster it doesn't have.
  const liveWithAthletes = live.find((c) => athleteCount(c.id) > 0);
  const wrappedWithAthletes = wrapped.find((c) => athleteCount(c.id) > 0);
  const rosterCampaign = liveWithAthletes ?? wrappedWithAthletes ?? null;

  let roster: RosterTile | null = null;
  if (rosterCampaign) {
    // Only the six rows the tile shows — the count comes from SQL above.
    const { data: rosterRows } = await supabase
      .from("athletes")
      .select("id, name, school, sport, ig_followers")
      .eq("campaign_id", rosterCampaign.id)
      .not("name", "is", null)
      .order("ig_followers", { ascending: false, nullsFirst: false })
      // 12, not 6. The reorder gave the roster the full height of rows 1-3,
      // and at 6 rows half the tile was empty. The tile scrolls internally, so
      // over-fetching slightly is cheaper than a visible void — and "as many
      // rows as fit" was the point of locking the grid to the viewport.
      .limit(12);

    const rows = (rosterRows ?? []) as {
      id: string;
      name: string;
      school: string | null;
      sport: string | null;
      ig_followers: number | null;
    }[];

    const [headshots, postViews] = await Promise.all([
      loadHeadshots(supabase, rosterCampaign.id, rows.map((a) => a.id)),
      loadRosterViews(supabase, brandId, rows.map((a) => a.id)),
    ]);

    const stat = stats.get(rosterCampaign.id);
    const nAthletes = stat?.athletes ?? rows.length;
    const nSchools = stat?.schools ?? 0;

    roster = {
      title: liveWithAthletes ? "Live campaign" : "Latest roster",
      campaignName: rosterCampaign.name ?? "Campaign",
      campaignSlug: rosterCampaign.slug,
      subline: [
        rosterCampaign.quarter,
        rosterCampaign.platform,
        `${nAthletes} ${nAthletes === 1 ? "athlete" : "athletes"}`,
        nSchools > 0 ? `${nSchools} ${nSchools === 1 ? "school" : "schools"}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      rows: rows.map((a) => ({
        athleteId: a.id,
        name: a.name,
        // Cased at the data layer, not at each render site, so the filters and
    // the labels can never disagree about a school's spelling.
    school: titleCaseSchool(a.school),
        sport: titleCaseSport(a.sport),
        headshotUrl: headshots.get(a.id) ?? null,
        followers: a.ig_followers,
        views: postViews.get(a.id) ?? null,
      })),
    };
  }

  // ---- Top posts ---------------------------------------------------
  const topRows = (topPostsRes.data ?? []) as {
    athlete_id: string;
    athlete_name: string;
    school: string | null;
    campaign_name: string | null;
    views: number;
    post_url: string | null;
  }[];
  const topThumbs = await loadHeadshots(supabase, null, topRows.map((r) => r.athlete_id));
  const topPosts: TopPost[] = topRows.map((r) => ({
    athleteId: r.athlete_id,
    name: r.athlete_name,
    school: titleCaseSchool(r.school),
    campaignName: r.campaign_name,
    views: r.views,
    postUrl: r.post_url,
    thumbnailUrl: topThumbs.get(r.athlete_id) ?? null,
  }));

  // ---- Campaign cards ---------------------------------------------
  // Three live, then the three most recent wrapped. Taking the first six of
  // [live, ...wrapped] filled the whole row with live campaigns whenever a
  // brand had six or more — CVS has six, so the row showed no wrapped work at
  // all. A fixed 3+3 keeps both halves of the story visible.
  //
  // Short-changed either way: if a brand has fewer than three live, the
  // wrapped side is NOT topped up to fill the row. Fewer cards is honest;
  // padding would imply a campaign mix the brand does not have.
  const cards: CampaignCard[] = [...live.slice(0, 3), ...wrapped.slice(0, 3)].map((c) => ({
    id: c.id,
    name: c.name ?? "Campaign",
    slug: c.slug,
    live: c.lifecycle_status === "active",
    quarter: c.quarter,
    campaignType: c.campaign_type,
    platform: c.platform,
    athletes: athleteCount(c.id),
  }));

  return {
    kpis,
    latestWrapped,
    roster,
    topPosts,
    campaigns: cards,
    liveCount: live.length,
    wrappedCount: wrapped.length,
    waitingCount,
  };
}

/**
 * A picture of each athlete, for headshots and Top posts thumbnails.
 *
 * `athletes` has no headshot column (Phase 3 brief §6 says as much), so this
 * takes the athlete's own media. A missing picture returns nothing and the UI
 * draws an empty circle — never a stock image.
 *
 * DOES NOT FILTER ON type='image', which it used to. That filter is why Top
 * posts rendered three grey squares: all three of CVS's top athletes have
 * media linked to them, and NONE of it is an image — it is video, which
 * carries a thumbnail_url that is a perfectly good still of that athlete.
 * Checked across every CVS athlete-linked row: videos always have a
 * thumbnail_url, images have file_url and no thumbnail. So the URL is
 * `thumbnail_url || file_url` and both types are eligible.
 *
 * Ordered by type ascending so 'image' sorts before 'video' and the
 * first-wins map below prefers a real photo over a video frame.
 */
async function loadHeadshots(
  supabase: ReturnType<typeof createServerSupabase>,
  campaignId: string | null,
  athleteIds: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (athleteIds.length === 0) return out;

  let q = supabase
    .from("media")
    .select("athlete_id, type, file_url, thumbnail_url")
    .in("athlete_id", athleteIds)
    .order("type", { ascending: true });
  if (campaignId) q = q.eq("campaign_id", campaignId);

  const { data } = await q;
  for (const m of (data ?? []) as {
    athlete_id: string | null;
    type: string | null;
    file_url: string | null;
    thumbnail_url: string | null;
  }[]) {
    const url = m.thumbnail_url || m.file_url;
    if (m.athlete_id && url && !out.has(m.athlete_id)) out.set(m.athlete_id, url);
  }
  return out;
}

/**
 * Per-post views for roster rows, from the same guarded view Top posts uses.
 *
 * The roster's Top reel column shows a number ONLY where a verified per-post
 * metric exists. Athletes without one get an empty cell rather than a zero or
 * a dash pretending to be a measurement.
 */
async function loadRosterViews(
  supabase: ReturnType<typeof createServerSupabase>,
  brandId: string,
  athleteIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (athleteIds.length === 0) return out;

  const { data } = await supabase
    .from("portal_top_posts")
    .select("athlete_id, views")
    .eq("brand_id", brandId)
    .in("athlete_id", athleteIds);

  for (const r of (data ?? []) as { athlete_id: string; views: number }[]) {
    const prev = out.get(r.athlete_id);
    if (prev === undefined || r.views > prev) out.set(r.athlete_id, r.views);
  }
  return out;
}

/** 933000 -> "933K", 1100000 -> "1.1M". Used for view and follower counts. */
export { compact as compactNumber } from "@/lib/portal/format";
