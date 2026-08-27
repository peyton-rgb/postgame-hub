// Map an athlete + their media into the shape AssetModal consumes.
//
// AssetModal is the portal's modal and the one the current recap already
// opens; v2 reuses it rather than growing a second one. The MAPPING has to be
// written here because CampaignRecap's own buildRecapPortalAthlete is private
// to that file and that file is protected — so this mirrors its structure
// deliberately, with one difference noted below.
//
// NOT carried yet: the collab-reel tabs the v1 mapper appends. Those need
// collabCollaborators and mapCollabMetrics, both also private to
// CampaignRecap. A collab still opens its participants' own feed and reel
// tabs; it just does not gain the extra pooled "Collab Reel" tab. Worth
// closing, but it needs those two helpers lifting somewhere shared first.
import {
  engagementRateByImpressions,
  type EngagementBlock,
} from "@/lib/recap-helpers";
import type {
  PortalAthlete,
  PortalPost,
  SideMetrics,
} from "@/app/portal/[token]/library/AssetModal";
import type { Athlete, Media } from "@/lib/types";

/**
 * Copy a metrics block through, filling the modal's legacy `engagement_rate`
 * key so it renders an Eng. Rate tile.
 *
 * THE DIFFERENCE FROM v1: it fills that key from engagements ÷ impressions,
 * not from Math.max(followers-rate, impressions-rate). v1's modal shows the
 * max-based figure, which is right for v1 because its page does too. A v2
 * modal showing a different rate from the v2 page it opened out of would be
 * the exact inconsistency the whole engagement-rate change was about.
 */
function side(
  block: Record<string, unknown> | undefined,
  denominator: "impressions" | "views",
): SideMetrics | null {
  if (!block || Object.keys(block).length === 0) return null;
  const out: SideMetrics = { ...(block as SideMetrics) };
  if (out.engagement_rate == null) {
    const rate = engagementRateByImpressions(block as EngagementBlock, denominator);
    if (rate > 0) out.engagement_rate = rate;
  }
  return out;
}

export interface BuiltPortalAthlete {
  portalAthlete: PortalAthlete;
  /** Index of the first reel post, so the modal can open on it. */
  reelPostIndex: number;
}

export function buildPortalAthlete(
  athlete: Athlete,
  items: Media[],
  campaignName: string,
): BuiltPortalAthlete {
  const images = items
    .filter((m) => m.type === "image")
    .map((m) => ({ fileUrl: m.file_url, thumb: m.thumbnail_url || m.file_url }));
  const videoItem = items.find((m) => m.type === "video");
  const video = videoItem
    ? { fileUrl: videoItem.file_url, poster: videoItem.thumbnail_url || null }
    : null;

  const m = (athlete.metrics || {}) as Record<string, Record<string, unknown> | undefined>;
  const feed1 = side(m.ig_feed, "impressions");
  const reel1 = side(m.ig_reel, "views");
  const feed2 = side(m.ig_feed_2, "impressions");
  const reel2 = side(m.ig_reel_2, "views");

  const posts: PortalPost[] = [];
  const push = (
    key: string,
    kind: "feed" | "reel",
    metrics: SideMetrics | null,
    fallbackUrl: string | null,
  ) => {
    posts.push({
      key: `${athlete.id}:${key}`,
      kind,
      label: kind === "feed" ? "Feed" : "Reel",
      rowId: athlete.id,
      images: kind === "feed" ? images : [],
      video: kind === "reel" ? video : null,
      metrics,
      postUrl: (metrics?.post_url as string) || fallbackUrl,
    });
  };

  if (images.length > 0 || feed1) push("feed1", "feed", feed1, athlete.post_url || null);
  if (video || reel1) push("reel1", "reel", reel1, athlete.post_url || null);
  if (feed2) push("feed2", "feed", feed2, null);
  if (reel2) push("reel2", "reel", reel2, null);

  // Number the tabs per kind, and only when there is more than one of a kind.
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

  return {
    portalAthlete: {
      id: athlete.id,
      name: athlete.name,
      campaignId: athlete.campaign_id,
      campaignName,
      posts,
      school: athlete.school || null,
      sport: athlete.sport || null,
      igHandle: athlete.ig_handle || null,
      igFollowers:
        typeof athlete.ig_followers === "number" && athlete.ig_followers > 0
          ? athlete.ig_followers
          : null,
    },
    reelPostIndex: posts.findIndex((p) => p.kind === "reel"),
  };
}
