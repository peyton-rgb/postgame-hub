import { createServiceSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brandSafe } from "@/lib/brand-safe";
import LibraryGallery, { type LibraryTile, type LibraryCampaign } from "./LibraryGallery";
import type { PortalAthlete, PortalPost } from "./AssetModal";

// Media Library tab for the brand portal. Token-gated exactly like the home
// page (see page.tsx for the service-client rationale). Server-fetches every
// media item across this brand's campaigns, joins athlete + campaign names,
// runs campaign names through brandSafe(), and hands the shaped data to the
// client gallery for interactive filtering/grouping.

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceSupabase();
  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("portal_token", token)
    .single();

  const robots = { index: false, follow: false } as const;
  if (!brand) return { title: "Not Found", robots };
  return {
    title: `${brand.name} — Media Library`,
    description: `Media library for ${brand.name}`,
    robots,
  };
}

export default async function PortalLibraryPage({ params }: Props) {
  const { token } = await params;
  const supabase = createServiceSupabase();

  // Token gate — one brand or 404.
  const { data: brand } = await supabase
    .from("brands")
    .select("id, name")
    .eq("portal_token", token)
    .single();

  if (!brand) notFound();

  // This brand's campaigns, newest first (drives section order).
  const { data: recapsRaw } = await supabase
    .from("campaign_recaps")
    .select("id, name")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const recaps = (recapsRaw || []) as any[];
  const recapIds = recaps.map((r) => r.id);
  const campaignName: Record<string, string> = {};
  for (const r of recaps) campaignName[r.id] = brandSafe(r.name);

  // All media for those campaigns + the athletes (for athlete_id -> name).
  const [{ data: mediaRaw }, { data: athletesRaw }] = recapIds.length
    ? await Promise.all([
        supabase
          .from("media")
          .select("id, campaign_id, athlete_id, type, file_url, thumbnail_url, is_video_thumbnail, sort_order")
          .in("campaign_id", recapIds)
          .order("sort_order", { ascending: true }),
        supabase
          .from("athletes")
          .select("id, name, campaign_id, metrics, post_url, sort_order, school, sport, ig_handle, ig_followers")
          .in("campaign_id", recapIds)
          .order("sort_order", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  const athleteName: Record<string, string> = {};
  for (const a of (athletesRaw || []) as any[]) athleteName[a.id] = a.name;

  // Shape display tiles. Skip poster-frame rows (is_video_thumbnail) so we only
  // show real content, mirroring how the public recap gallery is built.
  const tiles: LibraryTile[] = [];
  for (const m of (mediaRaw || []) as any[]) {
    if (m.is_video_thumbnail) continue;
    if (!campaignName[m.campaign_id]) continue;
    const isVideo = m.type === "video";
    const thumb = m.thumbnail_url || (!isVideo ? m.file_url : null);
    tiles.push({
      id: m.id,
      campaignId: m.campaign_id,
      campaignName: campaignName[m.campaign_id],
      athleteId: m.athlete_id || null,
      athleteName: (m.athlete_id && athleteName[m.athlete_id]) || null,
      kind: isVideo ? "video" : "photo",
      thumb,
      fileUrl: m.file_url,
    });
  }

  // Each athlete row's real content (images + video), keyed by row id.
  const mediaByRow: Record<string, any[]> = {};
  for (const m of (mediaRaw || []) as any[]) {
    if (m.is_video_thumbnail || !m.athlete_id) continue;
    if (!campaignName[m.campaign_id]) continue;
    (mediaByRow[m.athlete_id] ||= []).push(m);
  }

  // An athlete can have MULTIPLE posts in one campaign — stored as multiple
  // `athletes` rows sharing a name in the same campaign (athletes_master is
  // empty, so name-within-campaign is the only grouping key we have). Group the
  // rows, then walk each group (by sort_order, then id) deriving one FEED post
  // and/or one REEL post per row. An older single row with both still yields one
  // feed + one reel post, so single-post athletes behave exactly as before.
  const norm = (s: any) => String(s || "").trim().toLowerCase();
  const groupId = (campaignIdVal: string, name: any) => `${campaignIdVal}|${norm(name)}`;

  const groupRows: Record<string, any[]> = {};
  for (const a of (athletesRaw || []) as any[]) {
    if (!campaignName[a.campaign_id]) continue;
    (groupRows[groupId(a.campaign_id, a.name)] ||= []).push(a);
  }

  const athletesById: Record<string, PortalAthlete> = {};
  const rowToAthlete: Record<string, string> = {}; // media row id -> athlete group id
  for (const gid of Object.keys(groupRows)) {
    const rows = groupRows[gid].slice().sort((x, y) => {
      const sx = x.sort_order ?? Number.MAX_SAFE_INTEGER;
      const sy = y.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (sx !== sy) return sx - sy;
      return String(x.id).localeCompare(String(y.id));
    });

    // Identity = first non-null across the group.
    let igHandle: string | null = null;
    let school: string | null = null;
    let sport: string | null = null;
    let igFollowers: number | null = null;
    for (const row of rows) {
      if (igHandle == null && row.ig_handle) igHandle = row.ig_handle;
      if (school == null && row.school) school = row.school;
      if (sport == null && row.sport) sport = row.sport;
      // Treat 0 as "not tracked" — showing "0 Followers" reads as broken.
      if (igFollowers == null && typeof row.ig_followers === "number" && row.ig_followers > 0)
        igFollowers = row.ig_followers;
    }

    // Derive feed/reel posts per row, in row order.
    const posts: PortalPost[] = [];
    for (const row of rows) {
      const items = mediaByRow[row.id] || [];
      const images = items
        .filter((m) => m.type === "image")
        .map((m) => ({ fileUrl: m.file_url, thumb: m.thumbnail_url || m.file_url }));
      const video = items.find((m) => m.type === "video");
      const mx = (row.metrics || {}) as any;
      const feedMetrics = mx.ig_feed && Object.keys(mx.ig_feed).length ? mx.ig_feed : null;
      const reelMetrics = mx.ig_reel && Object.keys(mx.ig_reel).length ? mx.ig_reel : null;

      if (images.length > 0 || feedMetrics) {
        posts.push({
          key: `${row.id}:feed`,
          kind: "feed",
          label: "Feed",
          rowId: row.id,
          images,
          video: null,
          metrics: feedMetrics,
          postUrl: (feedMetrics && feedMetrics.post_url) || row.post_url || null,
        });
      }
      if (video || reelMetrics) {
        posts.push({
          key: `${row.id}:reel`,
          kind: "reel",
          label: "Reel",
          rowId: row.id,
          images: [],
          video: video ? { fileUrl: video.file_url, poster: video.thumbnail_url || null } : null,
          metrics: reelMetrics,
          postUrl: (reelMetrics && reelMetrics.post_url) || row.post_url || null,
        });
      }
    }
    if (!posts.length) continue;

    // Number per type only when there's more than one of that type.
    const feedTotal = posts.filter((p) => p.kind === "feed").length;
    const reelTotal = posts.filter((p) => p.kind === "reel").length;
    let fi = 0;
    let ri = 0;
    for (const p of posts) {
      if (p.kind === "feed") {
        fi += 1;
        p.label = feedTotal > 1 ? `Feed Post ${fi}` : "Feed";
      } else {
        ri += 1;
        p.label = reelTotal > 1 ? `Reel Post ${ri}` : "Reel";
      }
    }

    const displayName = (rows.find((r) => r.name) || rows[0]).name;
    athletesById[gid] = {
      id: gid,
      name: displayName,
      campaignId: rows[0].campaign_id,
      campaignName: campaignName[rows[0].campaign_id],
      posts,
      school,
      sport,
      igHandle,
      igFollowers,
    };
    for (const row of rows) rowToAthlete[row.id] = gid;
  }

  // Per-campaign list of DISTINCT athletes (by name), in sort order, for the
  // popup's prev/next-athlete navigation.
  const campaignAthletes: Record<string, string[]> = {};
  const seenAthlete = new Set<string>();
  for (const a of (athletesRaw || []) as any[]) {
    if (!campaignName[a.campaign_id]) continue;
    const gid = groupId(a.campaign_id, a.name);
    if (!athletesById[gid] || seenAthlete.has(gid)) continue;
    seenAthlete.add(gid);
    (campaignAthletes[a.campaign_id] ||= []).push(gid);
  }

  // Only campaigns that actually have tiles, in newest-first order.
  const tileCampaignIds = new Set(tiles.map((t) => t.campaignId));
  const campaigns: LibraryCampaign[] = recaps
    .filter((r) => tileCampaignIds.has(r.id))
    .map((r) => ({ id: r.id, name: campaignName[r.id] }));

  return (
    <main className="mx-auto max-w-[1200px] px-6 pt-2 pb-24">
      <LibraryGallery
        campaigns={campaigns}
        tiles={tiles}
        athletesById={athletesById}
        campaignAthletes={campaignAthletes}
        rowToAthlete={rowToAthlete}
      />
    </main>
  );
}
