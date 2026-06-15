"use client";

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import type { Campaign, Athlete, Media, VisibleSections, HeroMetricOverrideKey, CollabGroup } from "@/lib/types";
import { supabaseImageUrl } from "@/lib/supabase-image";
import { fmt, pct, formatEngagementRate, dollar, computeStatsWithOverrides, getTopPerformers, getTopPerformersByImpressions, getPostUrl, getBestEngRate, getTotalImpressions, getTotalEngagements, getCollabEngRate, type TopPerformerEntry } from "@/lib/recap-helpers";
import { PostgameLogo } from "./PostgameLogo";
import { TopPerformerMedia } from "./TopPerformerMedia";
import PostgameCalendar from "./PostgameCalendar";
// TEMP: Future Opportunities pulled until finalized — uncomment to restore
// import FutureOpportunities from "./FutureOpportunities";
import AssetModal, { type PortalAthlete, type PortalPost, type SideMetrics, type Collaborator } from "@/app/portal/[token]/library/AssetModal";
// Replaced react-masonry-css with a local shortest-column-next implementation
// (see BalancedMasonry below). react-masonry-css distributes sequentially,
// which left uneven column bottoms and a lot of dead space.

// Estimate a card's height relative to width=1, so we can place each
// card in whichever column is currently shortest.
function estimateCardHeightRatio(athleteIdx: number, hasVideo: boolean): number {
  // Mirrors the ratio logic inside MasonryCard: deterministic by cardIndex.
  const photoRatios = [1, 16 / 9, 5 / 4];      // 1/1, 9/16, 4/5 → h/w
  const videoRatios = [16 / 9, 5 / 4];         // 9/16, 4/5 → h/w
  const list = hasVideo ? videoRatios : photoRatios;
  return list[athleteIdx % list.length];
}

// Split items into N columns using shortest-column-next. Returns an array
// of columns, each containing { item, originalIndex } — originalIndex is
// preserved so MasonryCard can use it as cardIndex for consistent ratios.
function distributeShortestFirst<T>(
  items: T[],
  columnCount: number,
  heightOf: (item: T, idx: number) => number,
): Array<Array<{ item: T; originalIndex: number }>> {
  const cols: Array<Array<{ item: T; originalIndex: number }>> = Array.from(
    { length: columnCount },
    () => [],
  );
  const heights = new Array(columnCount).fill(0);
  items.forEach((item, idx) => {
    let shortestCol = 0;
    for (let c = 1; c < columnCount; c++) {
      if (heights[c] < heights[shortestCol]) shortestCol = c;
    }
    cols[shortestCol].push({ item, originalIndex: idx });
    heights[shortestCol] += heightOf(item, idx);
  });
  return cols;
}

// ── Rich Text Helper ─────────────────────────────────────────

/**
 * Returns true only if the given HTML string would produce visible content.
 *
 * Strips all tags, decodes the few HTML entities most likely to appear as
 * whitespace placeholders (&nbsp;), and trims. Returns false for null /
 * undefined / "" / "<p></p>" / "<p><br></p>" / "<p>&nbsp;</p>" and similar
 * empty-but-not-truly-empty shapes the TipTap editor produces. Media tags
 * (<img>, <iframe>) are treated as visible even without text.
 */
function hasRichTextContent(html: string | null | undefined): boolean {
  if (!html) return false;
  // Images and iframes are visible content on their own.
  if (/<(img|iframe)\b/i.test(html)) return true;
  const stripped = html
    .replace(/<[^>]*>/g, "")           // drop tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
  return stripped.length > 0;
}

// ── Masonry Card ─────────────────────────────────────────────

const DEFAULT_RATIOS = ["1/1", "9/16", "4/5"] as const;
const VIDEO_SAFE_RATIOS = ["9/16", "4/5"] as const;

// Single source of truth for "does this athlete have a reel?" — shared by the
// gallery card's content tag and (Phase 2) the modal's open-on-reel logic, so
// the card and the modal can never disagree. True when the athlete has an
// uploaded video OR reel metrics in their JSONB.
function athleteHasReel(athlete: Athlete, items: Media[]): boolean {
  const m = athlete.metrics;
  const reelMetrics =
    !!(m?.ig_reel && Object.keys(m.ig_reel).length > 0) ||
    !!(m?.ig_reel_2 && Object.keys(m.ig_reel_2).length > 0);
  const hasVideo = items.some((it) => it.type === "video");
  return reelMetrics || hasVideo;
}

// Shared collab→modal mappers, used by BOTH the collab-card popup
// (buildCollabPortalAthlete) and the collab-reel tabs appended to a solo
// athlete's popup (buildRecapPortalAthlete) — same pooled mapping, no duplication.
function mapCollabMetrics(group: CollabGroup): SideMetrics | null {
  const gm = group.metrics;
  const pooled: SideMetrics = {};
  if (typeof gm.impressions === "number") pooled.impressions = gm.impressions;
  if (typeof gm.views === "number") pooled.views = gm.views;
  if (typeof gm.likes === "number") pooled.likes = gm.likes;
  if (typeof gm.comments === "number") pooled.comments = gm.comments;
  if (typeof gm.totalEngagements === "number") pooled.total_engagements = gm.totalEngagements;
  if (group.combinedEngagementRate > 0) pooled.engagement_rate = group.combinedEngagementRate;
  return Object.keys(pooled).length ? pooled : null;
}

function collabCollaborators(group: CollabGroup, roster: Athlete[]): Collaborator[] {
  const byId = new Map(roster.map((a) => [a.id, a] as const));
  const byName = new Map(roster.map((a) => [a.name, a] as const));
  return group.athleteNames.map((nm, i) => {
    const id = group.athleteIds[i];
    const a = (id ? byId.get(id) : undefined) || byName.get(nm) || null;
    return {
      name: nm,
      igHandle: a?.ig_handle || null,
      school: a?.school || null,
      sport: a?.sport || null,
      igFollowers:
        a && typeof a.ig_followers === "number" && a.ig_followers > 0 ? a.ig_followers : null,
    };
  });
}

// Convert a recap Athlete + its media into the shape the shared portal
// AssetModal consumes. Mirrors the portal's server-side derivation
// (library/page.tsx): a Feed post (images + ig_feed metrics) and a Reel post
// (video + ig_reel metrics), plus Post-2 slots when present. Media is shared
// across a type's posts — the recap stores one image set / one video per
// athlete, exactly as the old card's Post 1/2 toggle behaved.
//
// `reelPostIndex` is the index the recap passes as AssetModal's startPostIndex so
// the modal opens on the Reel; -1 when the athlete is feed-only. By construction
// reelPostIndex >= 0 iff athleteHasReel() is true, so the card tag and the modal
// can never disagree.
function buildRecapPortalAthlete(
  athlete: Athlete,
  items: Media[],
  campaignName: string,
  // Collab reels this athlete appears in (reel-type groups) + their pooled media.
  // Appended as extra Reel tabs; default [] keeps every existing caller unchanged.
  collabReels: { group: CollabGroup; items: Media[] }[] = [],
  roster: Athlete[] = [],
): { portalAthlete: PortalAthlete; reelPostIndex: number } {
  const images = items
    .filter((m) => m.type === "image")
    .map((m) => ({ fileUrl: m.file_url, thumb: m.thumbnail_url || m.file_url }));
  const videoItem = items.find((m) => m.type === "video");
  const video = videoItem
    ? { fileUrl: videoItem.file_url, poster: videoItem.thumbnail_url || null }
    : null;

  // Copy a metrics block through, filling the modal's legacy `engagement_rate`
  // key from the best available rate (followers/impressions) so newer-template
  // campaigns still render an Eng. Rate tile. Recap-side only — the portal's own
  // data is untouched.
  const side = (block: Record<string, any> | undefined): SideMetrics | null => {
    if (!block || Object.keys(block).length === 0) return null;
    const out: SideMetrics = { ...block };
    if (out.engagement_rate == null) {
      const f = typeof block.engagement_rate_followers === "number" ? block.engagement_rate_followers : 0;
      const i = typeof block.engagement_rate_impressions === "number" ? block.engagement_rate_impressions : 0;
      const best = Math.max(f, i);
      if (best > 0) out.engagement_rate = best;
    }
    return out;
  };

  const m = athlete.metrics || {};
  const feed1 = side(m.ig_feed);
  const reel1 = side(m.ig_reel);
  const feed2 = side(m.ig_feed_2);
  const reel2 = side(m.ig_reel_2);

  const posts: PortalPost[] = [];
  if (images.length > 0 || feed1) {
    posts.push({ key: `${athlete.id}:feed1`, kind: "feed", label: "Feed", rowId: athlete.id, images, video: null, metrics: feed1, postUrl: (feed1?.post_url as string) || athlete.post_url || null });
  }
  if (video || reel1) {
    posts.push({ key: `${athlete.id}:reel1`, kind: "reel", label: "Reel", rowId: athlete.id, images: [], video, metrics: reel1, postUrl: (reel1?.post_url as string) || athlete.post_url || null });
  }
  if (feed2) {
    posts.push({ key: `${athlete.id}:feed2`, kind: "feed", label: "Feed", rowId: athlete.id, images, video: null, metrics: feed2, postUrl: (feed2.post_url as string) || null });
  }
  if (reel2) {
    posts.push({ key: `${athlete.id}:reel2`, kind: "reel", label: "Reel", rowId: athlete.id, images: [], video, metrics: reel2, postUrl: (reel2.post_url as string) || null });
  }

  // Number labels per type only when there's more than one of that type.
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

  // Computed on the athlete's OWN posts only (above) so feed-only athletes still
  // open on Feed — appended collab reels never change the default-open tab.
  const reelPostIndex = posts.findIndex((p) => p.kind === "reel");

  // Surface each collab reel this athlete is in. When the collab matches one of
  // the athlete's OWN reel posts (same url), upgrade that post in place — fill in
  // the collab's video if it has none, and attach the pooled "Also in this reel"
  // collaborator list — so it isn't duplicated as a separate tab. Otherwise append
  // it as an extra Reel tab: the collab's video, the SAME pooled metrics the collab
  // card uses, and an "Also in this reel" list of all participants (incl. this
  // athlete). Per-post collaborators keep the pooled note off the athlete's own tabs.
  collabReels.forEach(({ group, items: gItems }, i) => {
    const v = gItems.find((m) => m.type === "video");
    const collabVideo = v ? { fileUrl: v.file_url, poster: v.thumbnail_url || null } : null;

    // Match this collab against the athlete's own reel posts by url (the group's
    // url or any of its source urls). If one matches, upgrade it instead of
    // pushing a duplicate tab.
    const groupUrls = new Set(
      [group.url, ...group.sources.map((s) => s.url)].filter(Boolean) as string[],
    );
    const existing = posts.find(
      (p) => p.kind === "reel" && p.postUrl != null && groupUrls.has(p.postUrl),
    );
    if (existing) {
      if (!existing.video) existing.video = collabVideo;
      existing.collaborators = collabCollaborators(group, roster);
      existing.collaboratorsLabel = "Also in this reel";
      return;
    }

    posts.push({
      key: `${group.id}:collabreel`,
      kind: "reel",
      label: collabReels.length > 1 ? `Collab Reel ${i + 1}` : "Collab Reel",
      rowId: group.id,
      images: [],
      video: collabVideo,
      metrics: mapCollabMetrics(group),
      postUrl: group.url || null,
      collaborators: collabCollaborators(group, roster),
      collaboratorsLabel: "Also in this reel",
    });
  });

  const portalAthlete: PortalAthlete = {
    id: athlete.id,
    name: athlete.name,
    campaignId: athlete.campaign_id,
    campaignName,
    posts,
    school: athlete.school || null,
    sport: athlete.sport || null,
    igHandle: athlete.ig_handle || null,
    igFollowers: typeof athlete.ig_followers === "number" && athlete.ig_followers > 0 ? athlete.ig_followers : null,
  };
  return { portalAthlete, reelPostIndex };
}

// Map a collab group + its pooled media into the shared AssetModal shape: ONE
// pooled post (kind reel when the media has a video, reusing the solo modal's
// default-to-reel + muted autoplay), the group's shared metrics mapped to the
// modal's SideMetrics keys, and a per-athlete collaborators[] list (followers
// are per-person, looked up from the roster). reelPostIndex follows the same
// rule as solo so View More opens on the reel when there is one.
function buildCollabPortalAthlete(
  group: CollabGroup,
  items: Media[],
  roster: Athlete[],
  campaignName: string,
): { portalAthlete: PortalAthlete; reelPostIndex: number } {
  const images = items
    .filter((m) => m.type === "image")
    .map((m) => ({ fileUrl: m.file_url, thumb: m.thumbnail_url || m.file_url }));
  const videoItem = items.find((m) => m.type === "video");
  const video = videoItem
    ? { fileUrl: videoItem.file_url, poster: videoItem.thumbnail_url || null }
    : null;

  // ONE pooled metric set — do NOT fabricate per-athlete splits.
  const metrics = mapCollabMetrics(group);

  const kind: "feed" | "reel" = video ? "reel" : "feed";
  const post: PortalPost = {
    key: `${group.id}:pooled`,
    kind,
    label: kind === "reel" ? "Reel" : "Feed",
    rowId: group.id,
    images: kind === "feed" ? images : [],
    video: kind === "reel" ? video : null,
    metrics,
    postUrl: group.url || null,
  };

  // Title mirrors the card: stacked last names.
  const lastNames = group.athleteNames
    .map((nm) => nm.trim().split(/\s+/).pop() || nm)
    .join(" · ");

  const collaborators = collabCollaborators(group, roster);

  const campaignId = roster.find((a) => group.athleteIds.includes(a.id))?.campaign_id || "";

  const portalAthlete: PortalAthlete = {
    id: group.id,
    name: lastNames,
    campaignId,
    campaignName,
    posts: [post],
    school: null,
    sport: null,
    igHandle: null,
    igFollowers: null,
    collaborators,
  };
  const reelPostIndex = kind === "reel" ? 0 : -1;
  return { portalAthlete, reelPostIndex };
}

// ── Best-in-Class Card shell ─────────────────────────────────
//
// Shared chrome for the gallery's solo and collab cards: a hero image fills the
// card with a name block top-left (an optional marker above it) and a
// content-type tag top-right over a dark fade, and a full-width orange
// "View More" button below. NO metrics live on the card — those are in the
// reused portal AssetModal. AthleteCard and CollabCard both render this; the
// differences a collab needs (the COLLAB marker, stacked names, collab has-reel
// signal) come in as props.
function BestInClassCard({
  items: rawItems,
  activeFilter,
  cardIndex,
  hasReel,
  alt,
  marker,
  title,
  subtitle,
  onViewMore,
  borderColor = "#2a2a30",
}: {
  items: Media[];
  activeFilter: string;
  cardIndex: number;
  hasReel: boolean;
  alt: string;
  marker?: ReactNode;
  title?: string;
  subtitle: string;
  onViewMore?: () => void;
  borderColor?: string;
}) {
  const hasVideo = rawItems.some((m) => m.type === "video");

  // Hero = best available still: prefer a photo (honoring the photo filter),
  // else fall back to a reel's poster frame.
  const filteredItems =
    activeFilter === "photo" ? rawItems.filter((m) => m.type === "image") : rawItems;
  const coverImage =
    filteredItems.find((m) => m.type === "image") || rawItems.find((m) => m.type === "image");
  const heroVideo = rawItems.find((m) => m.type === "video");
  const heroSrc =
    coverImage?.thumbnail_url || coverImage?.file_url || heroVideo?.thumbnail_url || null;

  const defaultRatio = hasVideo
    ? VIDEO_SAFE_RATIOS[cardIndex % VIDEO_SAFE_RATIOS.length]
    : DEFAULT_RATIOS[cardIndex % DEFAULT_RATIOS.length];
  const [cardRatio, setCardRatio] = useState<string>(defaultRatio);

  // Landscape hero -> 16/9 (mirrors the old card's orientation probe).
  useEffect(() => {
    if (hasVideo) {
      const vid = rawItems.find((m) => m.type === "video");
      if (!vid) return;
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        if (video.videoWidth > video.videoHeight * 1.2) setCardRatio("16/9");
      };
      video.src = vid.file_url;
    } else {
      const cover = rawItems.find((m) => m.type === "image");
      if (!cover) return;
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > img.naturalHeight * 1.2) setCardRatio("16/9");
      };
      img.src = cover.file_url;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bebas = "var(--font-bebas-neue), 'Bebas Neue', sans-serif";

  return (
    <div
      className="break-inside-avoid mb-2 rounded-lg overflow-hidden"
      style={{ background: "#141418", border: `1px solid ${borderColor}` }}
    >
      <div className="relative overflow-hidden">
        {heroSrc ? (
          <img
            src={supabaseImageUrl(heroSrc, 1200) ?? heroSrc}
            className="w-full block object-cover [image-rendering:-webkit-optimize-contrast]"
            style={{ aspectRatio: cardRatio, objectPosition: "center 20%" }}
            draggable={false}
            alt={alt}
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes("/render/image/public/")) {
                img.src = img.src.replace("/render/image/public/", "/object/public/").split("?")[0];
              }
            }}
          />
        ) : (
          <div
            className="w-full bg-black flex items-center justify-center"
            style={{ aspectRatio: cardRatio }}
          >
            <span className="text-[10px] text-white/45 font-black uppercase">No media</span>
          </div>
        )}

        {/* Top overlay — name block (left) + content-type tag (right) over a dark fade */}
        <div
          className="absolute top-0 left-0 right-0 z-[2] flex items-start justify-between gap-2"
          style={{
            padding: "12px 14px 40px",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 45%, transparent 100%)",
          }}
        >
          <div className="min-w-0">
            {marker}
            {title ? (
              <div
                style={{
                  fontFamily: bebas,
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: 1,
                  color: "#fff",
                  lineHeight: 1,
                  marginBottom: 3,
                }}
              >
                {title}
              </div>
            ) : null}
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
              {subtitle}
            </div>
          </div>
          <span
            className="flex items-center gap-1 flex-shrink-0 rounded-full"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              padding: "4px 9px",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: "#fff",
              whiteSpace: "nowrap",
            }}
          >
            {hasReel ? (
              <>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="#fff">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Photos + Video
              </>
            ) : (
              <>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Photos
              </>
            )}
          </span>
        </div>

        {/* Bottom overlay — scrim + frosted light-glass "View More" over the photo */}
        <div
          className="absolute bottom-0 left-0 right-0 z-[2]"
          style={{
            padding: "48px 12px 12px",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.42) 48%, transparent 100%)",
          }}
        >
          <button
            onClick={onViewMore}
            className="w-full cursor-pointer rounded-full bg-white/[0.13] hover:bg-white/20 transition-colors"
            style={{
              border: "1px solid rgba(255,255,255,0.28)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              color: "#fff",
              fontFamily: bebas,
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              padding: "9px 14px",
            }}
          >
            View More
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Best-in-Class Athlete Card (solo) ────────────────────────
function AthleteCard({
  athlete,
  items: rawItems,
  activeFilter,
  cardIndex,
  onViewMore,
}: {
  athlete: Athlete;
  items: Media[];
  activeFilter: string;
  cardIndex: number;
  onViewMore?: () => void;
}) {
  return (
    <BestInClassCard
      items={rawItems}
      activeFilter={activeFilter}
      cardIndex={cardIndex}
      hasReel={athleteHasReel(athlete, rawItems)}
      alt={athlete.name}
      title={athlete.name}
      subtitle={`${athlete.school} · ${athlete.sport}`}
      onViewMore={onViewMore}
    />
  );
}

// ── Best-in-Class Collab Card ────────────────────────────────
//
// Same shell as the solo card, with the differences a multi-athlete post needs:
// an orange "COLLAB · N ATHLETES" marker, a title of stacked last names, and the
// shared school - sport beneath. Full names/handles/per-athlete followers live in
// the popup (Phase 2), not on the card.
function CollabCard({
  group,
  items: rawItems,
  activeFilter,
  athletes,
  cardIndex,
  onViewMore,
}: {
  group: CollabGroup;
  items: Media[];
  activeFilter: string;
  athletes: Athlete[];
  cardIndex: number;
  onViewMore?: () => void;
}) {
  const n = group.athleteNames.length;
  const lastNames = group.athleteNames
    .map((nm) => nm.trim().split(/\s+/).pop() || nm)
    .join(" · ");
  const firstAthlete = athletes.find((a) => a.name === group.athleteNames[0]) ?? null;
  const subtitle = firstAthlete ? `${firstAthlete.school} · ${firstAthlete.sport}` : "";
  // Collab has-a-reel: a video in the pooled media, or any non-feed (reel/tiktok)
  // source. Mirrors athleteHasReel's intent for a multi-athlete post.
  const hasReel =
    rawItems.some((m) => m.type === "video") ||
    group.sources.some((s) => s.platform !== "ig_feed");

  const marker = (
    <div className="flex items-center gap-1.5" style={{ marginBottom: 6 }}>
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D73F09"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#D73F09" }}>
        Collab · {n} {n === 1 ? "Athlete" : "Athletes"}
      </span>
    </div>
  );

  return (
    <BestInClassCard
      items={rawItems}
      activeFilter={activeFilter}
      cardIndex={cardIndex}
      hasReel={hasReel}
      alt={lastNames}
      marker={marker}
      subtitle={subtitle}
      onViewMore={onViewMore}
      borderColor="rgba(215,63,9,0.4)"
    />
  );
}

// ── Export as PowerPoint button ───────────────────────────────

function ExportPptxButton({ slug, campaignName }: { slug: string; campaignName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/recap/${slug}/pptx`);
      if (!res.ok) {
        const msg = await res.json().catch(() => ({ error: "Export failed." }));
        throw new Error(msg.error || `Export failed (${res.status})`);
      }
      // Pull filename out of Content-Disposition if the server provided one
      const disp = res.headers.get("Content-Disposition") || "";
      const match = disp.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `${campaignName.replace(/\s+/g, "-")}-Recap.pptx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Export failed.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      title={error || "Download a fully editable PowerPoint version of this recap"}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-[10px] md:text-xs font-bold uppercase tracking-wider transition-colors border ${
        loading
          ? "bg-white/[0.04] border-white/10 text-white/40 cursor-wait"
          : error
          ? "bg-red-500/10 border-red-500/40 text-red-300"
          : "bg-white/[0.06] border-white/[0.15] text-white/80 hover:bg-[#D73F09] hover:border-[#D73F09] hover:text-white"
      }`}
    >
      {loading ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
          </svg>
          Building…
        </>
      ) : error ? (
        <>Export failed — retry</>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export PowerPoint
        </>
      )}
    </button>
  );
}

// ── Main Recap Component ──────────────────────────────────────

// A single flat event-content tile — image or click-to-play video with a
// download button. No athlete chrome (event media is athlete-less). Used by
// the gallery-first Event Content section.
function EventMediaCard({ item }: { item: Media }) {
  const [playing, setPlaying] = useState(false);
  const isVideo = item.type === "video";
  const displaySrc = item.thumbnail_url || (!isVideo ? item.file_url : null);

  const handleDownload = async () => {
    if (!item.file_url) return;
    try {
      const res = await fetch(item.file_url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `event-${item.id}.${isVideo ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(item.file_url, "_blank");
    }
  };

  return (
    <div className="break-inside-avoid mb-2 rounded-lg overflow-hidden group relative" style={{ background: "#141418", border: "1px solid #2a2a30" }}>
      <div className="relative overflow-hidden">
        {isVideo && playing ? (
          <video src={item.file_url} autoPlay controls playsInline className="w-full block" onEnded={() => setPlaying(false)} />
        ) : displaySrc ? (
          <img
            src={supabaseImageUrl(displaySrc, 1200) ?? displaySrc}
            className="w-full block object-cover [image-rendering:-webkit-optimize-contrast]"
            draggable={false}
            alt=""
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes("/render/image/public/")) {
                img.src = img.src.replace("/render/image/public/", "/object/public/").split("?")[0];
              }
            }}
          />
        ) : isVideo ? (
          <div className="w-full aspect-square bg-black flex items-center justify-center" onClick={() => setPlaying(true)}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        ) : (
          <div className="w-full aspect-square bg-black flex items-center justify-center">
            <span className="text-[10px] text-white/45 font-black uppercase">No media</span>
          </div>
        )}

        {isVideo && !playing && displaySrc && (
          <div onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center cursor-pointer z-[2]">
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
            </div>
          </div>
        )}

        {!playing && (
          <div className="absolute top-0 left-0 right-0 z-[2] px-3 pt-2.5 pb-4 bg-gradient-to-b from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex justify-end">
              <button onClick={(e) => { e.stopPropagation(); handleDownload(); }} className="w-6 h-6 rounded bg-black/50 backdrop-blur flex items-center justify-center hover:bg-brand transition-colors" title="Download">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Full-bleed autoplaying hero for a landscape event video. Muted+loop by
// default (so autoplay is allowed); click the video or the button to unmute.
function EventHeroVideo({ item }: { item: Media }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play().catch(() => {});
  };
  return (
    <div className="relative w-full bg-black">
      <video
        ref={videoRef}
        src={item.file_url}
        autoPlay
        muted
        loop
        playsInline
        onClick={toggleMute}
        className="w-full block bg-black cursor-pointer"
      />
      <button
        onClick={toggleMute}
        className="absolute bottom-4 right-4 z-[2] w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        )}
      </button>
    </div>
  );
}

// Event Content body: landscape videos play full-bleed at the top; images and
// portrait videos stay in the flat gallery. Orientation is probed client-side
// (rows store no dimensions); a video isn't placed until known (no flash), and
// a metadata failure falls back to the gallery.
function EventContent({ eventMedia }: { eventMedia: Media[] }) {
  const [orientation, setOrientation] = useState<Record<string, "landscape" | "portrait">>({});

  const videos = eventMedia.filter((m) => m.type === "video");
  const videoIdsKey = videos.map((v) => v.id).join(",");

  useEffect(() => {
    let cancelled = false;
    const probes: HTMLVideoElement[] = [];
    for (const v of videos) {
      if (!v.file_url) {
        setOrientation((p) => ({ ...p, [v.id]: "portrait" })); // safe fallback
        continue;
      }
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.muted = true;
      probe.onloadedmetadata = () => {
        if (cancelled) return;
        setOrientation((p) => ({
          ...p,
          [v.id]: probe.videoWidth >= probe.videoHeight ? "landscape" : "portrait",
        }));
      };
      probe.onerror = () => {
        if (cancelled) return;
        setOrientation((p) => ({ ...p, [v.id]: "portrait" })); // safe fallback → gallery
      };
      probe.src = v.file_url;
      probes.push(probe);
    }
    return () => {
      cancelled = true;
      for (const p of probes) { p.onloadedmetadata = null; p.onerror = null; p.src = ""; }
    };
  }, [videoIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const landscapeVideos = videos.filter((v) => orientation[v.id] === "landscape");
  // Gallery: images always, plus videos confirmed portrait. Pending (unknown)
  // videos are held back until classified. Original order preserved.
  const galleryItems = eventMedia.filter(
    (m) => m.type !== "video" || orientation[m.id] === "portrait"
  );

  return (
    <>
      {landscapeVideos.length > 0 && (
        <div className="-mx-6 md:-mx-12 -mt-10 md:-mt-12 mb-8 space-y-1">
          {landscapeVideos.map((v) => (
            <EventHeroVideo key={v.id} item={v} />
          ))}
        </div>
      )}
      <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-6">Event Content</h2>
      {galleryItems.length > 0 && (
        <div className="bg-[#0a0a0a] border border-white/[0.15] rounded-xl p-2">
          <div className="columns-2 md:columns-3 lg:columns-4 gap-2 [column-fill:_balance]">
            {galleryItems.map((m) => (
              <EventMediaCard key={m.id} item={m} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SpotlightCarousel({ photos, name, igHandle, igFollowers, school, sport }: {
  photos: { id: string; url: string; alt: string }[];
  name: string; igHandle?: string | null; igFollowers?: number | null;
  school?: string | null; sport?: string | null;
}) {
  const [center, setCenter] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = photos.length;
  useEffect(() => {
    if (n <= 1 || paused) return;
    const t = setInterval(() => setCenter((c) => (c + 1) % n), 3500);
    return () => clearInterval(t);
  }, [n, paused]);
  const slot = (i: number): React.CSSProperties => {
    const base: React.CSSProperties = { position: "absolute", left: "50%", top: "50%", width: 248,
      transition: "transform .85s cubic-bezier(.22,.61,.36,1), opacity .85s ease, filter .85s ease" };
    if (n === 1 || i === center) return { ...base, transform: "translate(-50%,-50%) scale(1)", opacity: 1, zIndex: 3 };
    const left = (center - 1 + n) % n, right = (center + 1) % n;
    if (i === left)  return { ...base, transform: "translate(-50%,-50%) translateX(-150px) scale(.78)", opacity: .8, filter: "brightness(.82)", zIndex: 1 };
    if (i === right) return { ...base, transform: "translate(-50%,-50%) translateX(150px) scale(.78)", opacity: .8, filter: "brightness(.82)", zIndex: 1 };
    return { ...base, transform: "translate(-50%,-50%) scale(.6)", opacity: 0, zIndex: 0 };
  };
  return (
    <div className="mt-8 w-full flex flex-col gap-[18px]">
      <div className="relative h-[400px] overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {photos.map((p, i) => (
          <div key={p.id} style={slot(i)} className="rounded-[20px] overflow-hidden border border-white/[0.14] bg-white/[0.04] shadow-[0_24px_48px_rgba(0,0,0,0.55)]">
            <img src={p.url} alt={p.alt} className="block w-full h-full object-cover aspect-[4/5]" />
          </div>
        ))}
        {n > 1 && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-1 flex gap-[7px] z-[5]">
            {photos.map((_, i) => (
              <span key={i} className={`h-[7px] rounded-full transition-all duration-300 ${i === center ? "w-[18px] bg-[#D73F09]" : "w-[7px] bg-white/20"}`} />
            ))}
          </div>
        )}
      </div>
      <div className="bg-white/[0.07] border border-white/[0.1] rounded-[20px] backdrop-blur-md px-5 py-[18px] shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
        <div className="text-3xl font-black uppercase tracking-wide leading-none">{name}</div>
        {igHandle && (
          <a href={`https://www.instagram.com/${igHandle}/`} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5 text-sm text-[#D73F09] hover:underline">@{igHandle}</a>
        )}
        <div className="h-px bg-white/[0.1] my-3" />
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-white/90">{[school, sport].filter(Boolean).join(" · ")}</span>
          {igFollowers != null && (
            <span className="text-xs text-white/60 whitespace-nowrap"><b className="text-lg font-black tracking-wide text-white/90">{fmt(igFollowers)}</b> followers</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function CampaignRecap({
  campaign,
  athletes,
  allAthletes,
  media,
  collabGroups = [],
  eventMedia = [],
}: {
  campaign: Campaign;
  athletes: Athlete[];
  allAthletes?: Athlete[];
  media: Record<string, Media[]>;
  collabGroups?: CollabGroup[];
  eventMedia?: Media[];
}) {
  const [filter, setFilter] = useState("all");
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  // Best-in-Class "View More" opens the reused portal metrics modal for one
  // athlete, defaulting to their Reel tab (startPostIndex) when they have one.
  const [modalData, setModalData] = useState<{ portalAthlete: PortalAthlete; startPostIndex: number } | null>(null);
  const openAthleteModal = (a: Athlete, items: Media[]) => {
    // Collab REELS this athlete appears in (reel-type groups only). A collab that
    // matches one of the athlete's OWN reel posts upgrades that post in place (see
    // buildRecapPortalAthlete); the rest are appended as extra "Collab Reel" tabs.
    // Card tag / athleteHasReel are untouched.
    const collabReels = collabGroups
      .filter((g) => (g.platform === "ig_reel" || g.platform === "tiktok") && g.athleteIds.includes(a.id))
      .map((g) => ({ group: g, items: collabMediaItems(g) }));
    const { portalAthlete, reelPostIndex } = buildRecapPortalAthlete(a, items, campaign.name, collabReels, fullRoster);
    setModalData({ portalAthlete, startPostIndex: reelPostIndex >= 0 ? reelPostIndex : 0 });
  };
  const openCollabModal = (group: CollabGroup, items: Media[]) => {
    const { portalAthlete, reelPostIndex } = buildCollabPortalAthlete(group, items, fullRoster, campaign.name);
    setModalData({ portalAthlete, startPostIndex: reelPostIndex >= 0 ? reelPostIndex : 0 });
  };
  const [topPerformerMode, setTopPerformerMode] = useState<"engagement" | "impressions">("engagement");
  const [activeSection, setActiveSection] = useState<string>("");
  const settings = campaign.settings || {};
  const vis: VisibleSections = settings.visible_sections || {};
  const show = (key: keyof VisibleSections) => vis[key] !== false;
  const isEvent = settings.campaign_type === "event";
  const hiddenCols = new Set(settings.hidden_columns || []);
  const showCol = (key: string) => !hiddenCols.has(key);
  const hiddenCards = new Set(settings.hidden_platform_cards || []);
  const showCard = (key: string) => !hiddenCards.has(key);

  // Section refs for scroll navigation
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Full roster for metrics, top performers, roster, hero stats
  // Gallery athletes for Content Gallery only
  const fullRoster = allAthletes || athletes;

  const stats = computeStatsWithOverrides(fullRoster, campaign, collabGroups);
  // Per-platform URL set for fast "is this post a collab?" lookup in the roster.
  const collabUrlSet = new Set<string>();
  for (const g of collabGroups) for (const k of g.rawUrlKeys) collabUrlSet.add(k);
  const isCollabUrl = (platform: "ig_feed" | "ig_reel" | "tiktok", url: string | null | undefined) =>
    !!url && collabUrlSet.has(`${platform}|${url}`);
  // Names of all athletes participating in any collab group. Collab athletes
  // render in bracket blocks above the solo roster table — not as individual
  // rows — so we filter them out of the solo list below.
  const collabAthleteNameSet = new Set<string>();
  for (const g of collabGroups) for (const n of g.athleteNames) collabAthleteNameSet.add(n);
  // Pick the media list for a collab group. Prefer media uploaded directly
  // against the collab group (keyed by g.id); fall back to media uploaded
  // against any participating athlete so legacy campaigns without
  // collab-specific media still render. Used by both Top Performers and
  // Content Gallery sections.
  const collabMediaItems = (g: CollabGroup): Media[] => {
    const own = media[g.id];
    if (own && own.length) return own;
    for (const id of g.athleteIds) {
      const items = media[id];
      if (items && items.length) return items;
    }
    return [];
  };
  const topPerformers: TopPerformerEntry[] = topPerformerMode === "engagement"
    ? getTopPerformers(fullRoster, collabGroups)
    : getTopPerformersByImpressions(fullRoster, collabGroups);
  const cols = settings.columns || 4;

  // Build nav tabs dynamically based on visible sections + data availability
  const hasKpi = settings.kpi_targets && (settings.kpi_targets.athlete_quantity || settings.kpi_targets.content_units || settings.kpi_targets.posts || settings.kpi_targets.impressions || settings.kpi_targets.engagements || settings.kpi_targets.engagement_rate || settings.kpi_targets.cpm || settings.kpi_targets.other_kpis);
  const navTabs = [
    isEvent && eventMedia.length > 0 && { key: "event_content", label: "Event Content" },
    show("brief") && { key: "brief", label: "Recap" },
    show("key_takeaways") && hasRichTextContent(settings.key_takeaways) && { key: "key_takeaways", label: "Takeaways" },
    show("kpi_targets") && hasKpi && { key: "kpi_targets", label: "KPIs" },
    show("metrics") && { key: "metrics", label: "Metrics" },
    show("top_performers") && topPerformers.length > 0 && { key: "top_performers", label: "Top Performers" },
    show("content_gallery") && { key: "content_gallery", label: "Best In Class" },
    show("roster") && { key: "roster", label: "Roster" },
    { key: "timeline", label: "Timeline" },
  ].filter(Boolean) as { key: string; label: string }[];

  // Scroll to section. The Postgame Calendar lives OUTSIDE this component
  // (it's appended after CampaignRecap in src/app/recap/[slug]/page.tsx),
  // so we can't reach it through sectionRefs — we look it up by DOM id.
  const scrollToSection = (key: string) => {
    if (key === "timeline") {
      const cal = document.getElementById("postgame-calendar");
      if (cal) {
        const navHeight = 48;
        const top = cal.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top, behavior: "smooth" });
      }
      return;
    }
    const el = sectionRefs.current[key];
    if (el) {
      const navHeight = 48;
      const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  // Intersection observer for active section tracking
  const navTabKeys = navTabs.map((t) => t.key).join(",");
  useEffect(() => {
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const key = entry.target.getAttribute("data-section");
          if (key) setActiveSection(key);
        }
      }
    };
    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "-60px 0px -70% 0px",
      threshold: 0,
    });
    for (const key of navTabKeys.split(",")) {
      const el = sectionRefs.current[key];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [navTabKeys]);

  // Gallery filter uses actual uploaded media types (not CSV post_type)
  // Photo filter: only show athletes that have images, and exclude video items in MasonryCard
  const filtered = athletes.filter((a) => {
    const items = media[a.id] || [];
    if (items.length === 0) return false;
    if (filter === "all") return true;
    if (filter === "photo") return items.some((m) => m.type === "image");
    return items.some((m) => m.type === "video");
  });

  // Detect athletes with landscape videos to render them as full-width cards above masonry
  const [wideAthleteIds, setWideAthleteIds] = useState<Set<string>>(new Set());
  // Roster expand/collapse for campaigns with >50 athletes
  const [rosterExpanded, setRosterExpanded] = useState(false);
  useEffect(() => {
    const detected = new Set<string>();
    let pending = 0;
    athletes.forEach((a) => {
      const vid = (media[a.id] || []).find((m) => m.type === "video");
      if (!vid) return;
      pending++;
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        if (video.videoWidth > video.videoHeight * 1.2) detected.add(a.id);
        pending--;
        if (pending === 0 && detected.size > 0) setWideAthleteIds(new Set(detected));
      };
      video.onerror = () => { pending--; if (pending === 0 && detected.size > 0) setWideAthleteIds(new Set(detected)); };
      video.src = vid.file_url;
    });
  }, [athletes, media]);

  // wideAthleteIds feeds per-card grid-column: span 2 in the Best In Class
  // grid below. No bucket split — every athlete renders in a single grid.

  const autoContentTypes = [
    stats.igFeedPosts > 0 && "IG Feed",
    stats.igReelPosts > 0 && "Reels",
    stats.tiktokPosts > 0 && "TikTok BTS",
  ].filter(Boolean).join(", ");
  const contentTypes = campaign.settings?.content_type || autoContentTypes;

  // Athlete spotlight card (Campaign Overview, right column). Data-driven via the
  // recap's settings JSON; renders nothing unless a matching athlete is found.
  const spotlightAthleteId = (settings as any).spotlight_athlete_id as string | undefined;
  const spotlightMediaId = (settings as any).spotlight_media_id as string | undefined;
  const spotlightAthlete = spotlightAthleteId
    ? (allAthletes || []).find((a: any) => a.id === spotlightAthleteId)
    : undefined;
  const spotlightItems = spotlightAthlete ? (media[spotlightAthlete.id] || []) : [];
  let spotlightPhotos = spotlightItems
    .filter((m: any) => m.type !== "video" && !m.is_video_thumbnail)
    .map((m: any) => ({ id: m.id as string, url: m.file_url as string, alt: spotlightAthlete!.name }));
  if (spotlightMediaId) {
    spotlightPhotos = [
      ...spotlightPhotos.filter((p) => p.id === spotlightMediaId),
      ...spotlightPhotos.filter((p) => p.id !== spotlightMediaId),
    ];
  }

  // Roster sort: composite of "biggest names" (followers) and "top performers"
  // (total engagements). For each athlete we compute a percentile rank within
  // the campaign on each signal, then average the two. Featured athletes pin
  // to the top regardless of score (sorted by featured_order among themselves).
  // Roster is then sliced to the first 50; the rest live behind an expand button.
  const ROSTER_VISIBLE_COUNT = 10;
  const rosterAthletes = (() => {
    // Exclude collab-ONLY athletes (in a collab group with no solo post of their
    // own) — they render only in the collab bracket. A collab participant who
    // ALSO made a solo post still appears here (showing just their solo metrics).
    // "Solo" = a post_url that isn't one of the collab URLs (collab posts live in
    // the same ig_feed/ig_reel slots, so we test the URL, not slot emptiness).
    const hasSoloPost = (a: any) => {
      const m = a.metrics || {};
      return (
        (!!m.ig_feed?.post_url && !isCollabUrl("ig_feed", m.ig_feed.post_url)) ||
        (!!m.ig_reel?.post_url && !isCollabUrl("ig_reel", m.ig_reel.post_url)) ||
        (!!m.tiktok?.post_url && !isCollabUrl("tiktok", m.tiktok.post_url))
      );
    };
    const list = fullRoster.filter((a) => !collabAthleteNameSet.has(a.name) || hasSoloPost(a));
    if (list.length === 0) return list;

    // Compute total engagements for each athlete (sum across IG Feed + Reel + TikTok)
    const totalEngagementsFor = (a: any) => {
      const m = a.metrics || {};
      const f = Number(m.ig_feed?.total_engagements) || 0;
      const r = Number(m.ig_reel?.total_engagements) || 0;
      const t = Number(m.tiktok?.total_engagements) || 0;
      return f + r + t;
    };

    // Build percentile-rank lookups: rank position / (n - 1) → 0..1 score.
    // Athletes with the same value get the same rank (averaged).
    const percentileRank = (values: number[]): Map<number, number> => {
      const sorted = [...new Set(values)].sort((a, b) => a - b);
      const map = new Map<number, number>();
      sorted.forEach((v, i) => {
        map.set(v, sorted.length === 1 ? 1 : i / (sorted.length - 1));
      });
      return map;
    };

    const followerVals = list.map((a) => Number(a.ig_followers) || 0);
    const engagementVals = list.map(totalEngagementsFor);
    const followerRanks = percentileRank(followerVals);
    const engagementRanks = percentileRank(engagementVals);

    const scoreFor = (a: any) => {
      const fScore = followerRanks.get(Number(a.ig_followers) || 0) ?? 0;
      const eScore = engagementRanks.get(totalEngagementsFor(a)) ?? 0;
      return (fScore + eScore) / 2;
    };

    // Split: featured athletes go on top, sorted by featured_order then score.
    // Everyone else sorts by composite score descending.
    const featured = list.filter((a: any) => a.is_featured);
    const nonFeatured = list.filter((a: any) => !a.is_featured);

    featured.sort((a: any, b: any) => {
      const ao = a.featured_order ?? 9999;
      const bo = b.featured_order ?? 9999;
      if (ao !== bo) return ao - bo;
      return scoreFor(b) - scoreFor(a);
    });
    nonFeatured.sort((a, b) => scoreFor(b) - scoreFor(a));

    return [...featured, ...nonFeatured];
  })();

  const rosterIsTruncated = rosterAthletes.length > ROSTER_VISIBLE_COUNT;
  const visibleRosterAthletes = rosterExpanded || !rosterIsTruncated
    ? rosterAthletes
    : rosterAthletes.slice(0, ROSTER_VISIBLE_COUNT);
  const hiddenRosterCount = rosterAthletes.length - ROSTER_VISIBLE_COUNT;

  return (
    <div className="recap-container min-h-screen bg-[#111111] text-white font-sans">

      {/* ── POSTGAME TOP BAR ───────────────────────────────── */}
      <div className="px-6 md:px-12 py-3 border-b border-white/[0.12] flex items-center justify-between">
        <PostgameLogo size="sm" className="opacity-60" />
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/50">
            Campaign Recap
          </span>
          <ExportPptxButton slug={campaign.slug} campaignName={campaign.name} />
        </div>
      </div>

      {/* ── STICKY SECTION NAV ────────────────────────────── */}
      {navTabs.length > 1 && (
        <div className="sticky top-0 z-50 bg-[#111111]/92 backdrop-blur-md border-b border-white/[0.10]">
          <div className="flex justify-center gap-0 overflow-x-auto scrollbar-hide">
            {navTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => scrollToSection(tab.key)}
                className={`px-5 md:px-7 py-3.5 text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap border-b-2 ${
                  activeSection === tab.key
                    ? "text-white border-[#D73F09]"
                    : "text-white/45 border-transparent hover:text-white/80 hover:border-white/20"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 1: HERO HEADER ─────────────────────────── */}
      <div className="relative px-6 md:px-12 pt-10 md:pt-14 pb-10 md:pb-14 bg-gradient-to-b from-white/[0.08] to-transparent">
        <div className="flex flex-col items-center text-center gap-6">
          {/* Brand logo — big, no container. Wendy's gets a slightly larger
              size because their round wordmark needs more room to breathe. */}
          {(() => {
            const isWendys = campaign.client_name?.toLowerCase().includes("wendy");
            const primarySize = isWendys ? "h-32 md:h-48" : "h-24 md:h-36";
            const fallbackSize = isWendys ? "h-28 md:h-44" : "h-20 md:h-32";
            if (settings.brand_logo_url) {
              return <img src={settings.brand_logo_url} className={`${primarySize} object-contain`} alt={campaign.client_name} />;
            }
            if (campaign.client_logo_url) {
              return <img src={campaign.client_logo_url} className={`${fallbackSize} object-contain`} alt={campaign.client_name} />;
            }
            return null;
          })()}

          <h1 className="text-3xl md:text-5xl font-black uppercase leading-tight">
            {campaign.name}
          </h1>

          {/* Tag pill */}
          <div className="flex items-center gap-3">
            <span className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-[#D73F09] text-white">
              NIL Campaign
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 0: EVENT CONTENT (gallery-first) ──────────── */}
      {isEvent && eventMedia.length > 0 && (
        <div ref={(el) => { sectionRefs.current["event_content"] = el; }} data-section="event_content" className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <EventContent eventMedia={eventMedia} />
        </div>
      )}

      {/* ── SECTION 2: CAMPAIGN OVERVIEW ─────────────────────── */}
      {show("brief") && (
        <div ref={(el) => { sectionRefs.current["brief"] = el; }} data-section="brief" className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-8">Campaign Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            <div>
              {hasRichTextContent(settings.description) && (
                <div
                  className="prose prose-invert max-w-none text-base md:text-lg text-white/70 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: settings.description as string }}
                />
              )}
            </div>
            <div className="space-y-0">
              {[
                { label: "CAMPAIGN NAME", value: campaign.name },
                { label: "TIMEFRAME", value: settings.quarter },
                { label: "PLATFORM(S)", value: settings.platform },
                { label: "CONTENT TYPE", value: contentTypes },
                { label: "CAMPAIGN TYPE", value: settings.campaign_type },
              ].filter((r) => r.value).map((row) => (
                <div key={row.label} className="flex items-baseline py-3 border-b border-white/[0.12]">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70 w-40 flex-shrink-0">{row.label}</span>
                  <span className="text-base font-semibold text-white/90">{row.value}</span>
                </div>
              ))}
              {spotlightAthlete && spotlightPhotos.length > 0 && (
                <SpotlightCarousel
                  photos={spotlightPhotos}
                  name={spotlightAthlete.name}
                  igHandle={spotlightAthlete.ig_handle}
                  igFollowers={spotlightAthlete.ig_followers}
                  school={spotlightAthlete.school}
                  sport={spotlightAthlete.sport}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KEY TAKEAWAYS ─────────────────────────────────── */}
      {show("key_takeaways") && hasRichTextContent(settings.key_takeaways) && (
        <div ref={(el) => { sectionRefs.current["key_takeaways"] = el; }} data-section="key_takeaways" className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-6">Key Takeaways</h2>
          <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6 md:p-8">
            <div
              className="prose prose-invert max-w-none text-sm md:text-base text-white/90 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: settings.key_takeaways as string }}
            />
          </div>
        </div>
      )}

      {/* ── KPI TARGETS ───────────────────────────────────── */}
      {show("kpi_targets") && (() => {
        const t = settings.kpi_targets || {};
        const hasBudget = settings.budget != null && settings.budget > 0;
        const hasAnyTarget = t.athlete_quantity || t.content_units || t.posts || t.impressions || t.engagements || t.engagement_rate || t.other_kpis;
        if (!hasAnyTarget && !hasBudget) return null;

        console.log("Budget data:", { budget: settings.budget, impressions: settings.total_impressions });

        const actualCpm = hasBudget && settings.total_impressions && settings.total_impressions > 0
          ? (settings.budget! / settings.total_impressions) * 1000
          : null;

        const kpiRows: { label: string; target: number | null; actual: number | null; isPercent?: boolean; isDollar?: boolean; isCpm?: boolean }[] = [];

        // Budget first (standalone, no target)
        if (hasBudget) kpiRows.push({ label: "Budget", target: null, actual: settings.budget!, isDollar: true });
        // KPI target rows
        if (t.athlete_quantity != null) kpiRows.push({ label: "Athletes", target: t.athlete_quantity, actual: stats.athleteCount });
        if (t.content_units != null) kpiRows.push({ label: "Content Units", target: t.content_units, actual: null });
        if (t.posts != null) kpiRows.push({ label: "Posts", target: t.posts, actual: stats.totalPosts });
        if (t.impressions != null) kpiRows.push({ label: "Impressions", target: t.impressions, actual: stats.totalImpressions });
        if (t.engagements != null) kpiRows.push({ label: "Engagements", target: t.engagements, actual: stats.totalEngagements });
        if (t.engagement_rate != null) kpiRows.push({ label: "Engagement Rate", target: t.engagement_rate, actual: stats.avgEngRate, isPercent: true });
        // Actual CPM last (auto-calculated, no target)
        if (actualCpm != null || t.cpm != null) kpiRows.push({ label: "Actual CPM", target: t.cpm ?? null, actual: actualCpm, isDollar: true, isCpm: true });

        if (kpiRows.length === 0) return null;

        return (
          <div ref={(el) => { sectionRefs.current["kpi_targets"] = el; }} data-section="kpi_targets" className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-8">Campaign KPI Targets</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiRows.map((row) => {
                const pctOfGoal = row.actual != null && row.target != null && row.target > 0 ? (row.actual / row.target) * 100 : null;
                const color = row.isCpm
                  ? (row.actual == null || row.target == null ? "text-gray-400"
                    : row.actual <= row.target ? "text-emerald-400"
                    : row.actual <= row.target * 1.10 ? "text-amber-400"
                    : "text-red-400")
                  : (pctOfGoal == null ? "text-gray-400" : pctOfGoal >= 100 ? "text-emerald-400" : pctOfGoal >= 80 ? "text-amber-400" : "text-red-400");
                const formatVal = (n: number | null) => {
                  if (n == null) return "\u2014";
                  if (row.isPercent) return pct(n);
                  if (row.isDollar) return dollar(n);
                  return fmt(n);
                };

                return (
                  <div key={row.label} className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-4 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">{row.label}</div>
                    {row.target != null && (
                      <div className="text-xs text-white/60 mb-1">Target: <span className="text-white/80 font-bold">{formatVal(row.target)}</span></div>
                    )}
                    <div className={`text-2xl font-black ${row.target != null ? color : "text-white"}`}>{formatVal(row.actual)}</div>
                    {pctOfGoal != null && !row.isCpm && (
                      <div className={`text-[10px] font-bold mt-1 ${color}`}>{Math.round(pctOfGoal)}% of goal</div>
                    )}
                  </div>
                );
              })}
            </div>
            {t.other_kpis && (
              <div className="mt-4 bg-white/[0.06] border border-white/[0.15] rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">Other KPIs</div>
                <div className="text-sm text-white/80 whitespace-pre-line">{t.other_kpis}</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── SECTION 3: CAMPAIGN METRICS ────────────────────── */}
      {show("metrics") && (
        <div ref={(el) => { sectionRefs.current["metrics"] = el; }} data-section="metrics" className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-8">Campaign Metrics</h2>

          {/* Summary rows */}
          <div className="mb-8">
            {(() => {
              const hiddenHeroes = settings.hidden_heroes || [];
              const row1 = [
                { key: "athlete_count" as const,       value: stats.athleteCount,             label: "ATHLETES" },
                { key: "school_count" as const,        value: stats.schoolCount,              label: "COLLEGES" },
                { key: "sport_count" as const,         value: stats.sportCount,               label: "SPORTS" },
                { key: "total_posts" as const,         value: stats.totalPosts,               label: "TOTAL POSTS" },
              ].filter(m => !hiddenHeroes.includes(m.key)) as { key: HeroMetricOverrideKey | null; value: string | number; label: string }[];

              const row2 = [
                { key: "combined_followers" as const,  value: fmt(stats.combinedFollowers),   label: "TOTAL FOLLOWERS" },
                { key: "total_impressions" as const,   value: fmt(stats.totalImpressions),    label: "TOTAL IMPRESSIONS" },
                { key: "total_engagements" as const,   value: fmt(stats.totalEngagements),    label: "TOTAL ENGAGEMENTS" },
                ...(stats.igFeedPosts > 0 || stats.igReelPosts > 0 ? [{ key: "ig_avg_engagement_rate" as const, value: formatEngagementRate(stats.igAvgEngRate), label: "IG AVG ENG RATE" }] : []),
                ...(stats.tiktokPosts > 0 ? [{ key: "tiktok_avg_engagement_rate" as const, value: formatEngagementRate(stats.tiktokAvgEngRate), label: "TIKTOK AVG ENG RATE" }] : []),
                ...(stats.clicks.link_clicks > 0 ? [{ key: "total_clicks" as const, value: fmt(stats.clicks.link_clicks), label: "CLICKS" }] : []),
                ...((stats.clicks.orders || stats.sales.conversions) > 0 ? [{ key: "total_orders" as const, value: fmt(stats.clicks.orders || stats.sales.conversions), label: "ORDERS" }] : []),
                ...((stats.clicks.salesAmount || stats.sales.revenue) > 0 ? [{ key: "total_sales" as const, value: dollar(stats.clicks.salesAmount || stats.sales.revenue), label: "SALES" }] : []),
              ].filter(m => m.key === null || !hiddenHeroes.includes(m.key)) as { key: HeroMetricOverrideKey | null; value: string | number; label: string }[];

              const renderBox = (m: { key: HeroMetricOverrideKey | null; value: string | number; label: string }) => {
                const isOverridden = m.key != null && stats.overriddenKeys.has(m.key);
                return (
                  <div key={m.label} className="bg-white/[0.07] border border-white/[0.15] rounded-xl p-5 md:p-8 text-center flex-1 min-w-[140px] max-w-[220px] relative">
                    {isOverridden && (
                      <span
                        title="This value was manually adjusted"
                        aria-label="manually adjusted"
                        className="absolute top-2 right-2 text-[10px] text-amber-400/80"
                      >
                        ✎
                      </span>
                    )}
                    <div className="text-2xl md:text-4xl font-black text-white mb-2">{m.value}</div>
                    <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/70">{m.label}</div>
                  </div>
                );
              };

              return (
                <>
                  <div className="flex flex-wrap justify-center gap-3 mb-3">
                    {row1.map(renderBox)}
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {row2.map(renderBox)}
                  </div>
                </>
              );
            })()}
          </div>

          {/* Per-platform breakdown */}
          {show("platform_breakdown") && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* IG Feed card — merges Stories as sub-section when TikTok is present */}
            {stats.igFeedPosts > 0 && showCard("ig_feed") && (
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-brand"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>IG Feed</h3>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Total Posts", value: String(stats.igFeedPosts), raw: stats.igFeedPosts, col: "ig_feed_post_url" },
                    { label: "Reach", value: fmt(stats.igFeed.reach), raw: stats.igFeed.reach, col: "ig_feed_reach" },
                    { label: "Impressions", value: fmt(stats.igFeed.impressions), raw: stats.igFeed.impressions, col: "ig_feed_impressions" },
                    { label: "Likes", value: fmt(stats.igFeed.likes), raw: stats.igFeed.likes, col: "ig_feed_likes" },
                    { label: "Comments", value: fmt(stats.igFeed.comments), raw: stats.igFeed.comments, col: "ig_feed_comments" },
                    { label: "Shares", value: fmt(stats.igFeed.shares), raw: stats.igFeed.shares, col: "ig_feed_shares" },
                    { label: "Reposts", value: fmt(stats.igFeed.reposts), raw: stats.igFeed.reposts, col: "ig_feed_reposts" },
                    { label: "Total Engagements", value: fmt(stats.igFeed.engagements), raw: stats.igFeed.engagements, col: "ig_feed_total" },
                    { label: "Avg Engagement Rate", value: stats.igFeed.engRateCount > 0 ? formatEngagementRate(stats.igFeed.engRateSum / stats.igFeed.engRateCount) : "\u2014", raw: stats.igFeed.engRateCount, col: "ig_feed_rate" },
                  ].filter((row) => row.raw > 0 && showCol(row.col)).map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
                {/* Stories sub-section merged into Feed card when TikTok is present */}
                {stats.tiktokPosts > 0 && (stats.igStory.count > 0 || stats.igStory.impressions > 0) && showCard("ig_stories") && (
                  <div className="mt-4 pt-4 border-t border-dashed border-white/[0.15]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#D73F09]/75 mb-2">IG Stories</div>
                    <div className="space-y-0">
                      {[
                        { label: "Story Count", value: fmt(stats.igStory.count), col: "ig_story_count" },
                        { label: "Total Story Impressions", value: fmt(stats.igStory.impressions), col: "ig_story_impressions" },
                      ].filter((row) => showCol(row.col)).map((row) => (
                        <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                          <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                          <span className="text-base font-bold text-white/90">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* IG Reels card */}
            {stats.igReelPosts > 0 && showCard("ig_reels") && (
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-brand"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="8" y1="2" x2="12" y2="8"/><line x1="16" y1="2" x2="12" y2="8"/><polygon points="10,12 10,18 16,15" fill="currentColor" stroke="none"/></svg>IG Reels</h3>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Total Posts", value: String(stats.igReelPosts), raw: stats.igReelPosts, col: "ig_reel_post_url" },
                    { label: "Views", value: fmt(stats.igReel.views), raw: stats.igReel.views, col: "ig_reel_views" },
                    { label: "Likes", value: fmt(stats.igReel.likes), raw: stats.igReel.likes, col: "ig_reel_likes" },
                    { label: "Comments", value: fmt(stats.igReel.comments), raw: stats.igReel.comments, col: "ig_reel_comments" },
                    { label: "Shares", value: fmt(stats.igReel.shares), raw: stats.igReel.shares, col: "ig_reel_shares" },
                    { label: "Reposts", value: fmt(stats.igReel.reposts), raw: stats.igReel.reposts, col: "ig_reel_reposts" },
                    { label: "Total Engagements", value: fmt(stats.igReel.engagements), raw: stats.igReel.engagements, col: "ig_reel_total" },
                    { label: "Avg Engagement Rate", value: stats.igReel.engRateCount > 0 ? formatEngagementRate(stats.igReel.engRateSum / stats.igReel.engRateCount) : "\u2014", raw: stats.igReel.engRateCount, col: "ig_reel_rate" },
                  ].filter((row) => row.raw > 0 && showCol(row.col)).map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TikTok card */}
            {stats.tiktokPosts > 0 && showCard("tiktok") && (
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-brand"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.89 2.89 2.89 0 0 1 2.88-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.77a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.18z"/></svg>TikTok</h3>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Views", value: fmt(stats.tiktok.views), raw: stats.tiktok.views, col: "tiktok_views" },
                    { label: "Likes", value: fmt(stats.tiktok.likes), raw: stats.tiktok.likes, col: "tiktok_likes" },
                    { label: "Comments", value: fmt(stats.tiktok.comments), raw: stats.tiktok.comments, col: "tiktok_comments" },
                    { label: "Likes + Comments", value: fmt(stats.tiktok.likes_comments), raw: stats.tiktok.likes > 0 ? 0 : stats.tiktok.likes_comments, col: "tiktok_likes_comments" },
                    { label: "Saves + Shares", value: fmt(stats.tiktok.saves_shares), raw: stats.tiktok.saves_shares, col: "tiktok_saves_shares" },
                    { label: "Total Engagements", value: fmt(stats.tiktok.engagements), raw: stats.tiktok.engagements, col: "tiktok_total" },
                    { label: "Avg Engagement Rate", value: stats.tiktok.engRateCount > 0 ? formatEngagementRate(stats.tiktok.engRateSum / stats.tiktok.engRateCount) : "\u2014", raw: stats.tiktok.engRateCount, col: "tiktok_rate" },
                  ].filter((row) => row.raw > 0 && showCol(row.col)).map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* IG Stories standalone card — only when TikTok is NOT present */}
            {stats.tiktokPosts === 0 && (stats.igStory.count > 0 || stats.igStory.impressions > 0) && (
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2 text-brand"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>IG Stories</h3>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Story Count", value: fmt(stats.igStory.count), col: "ig_story_count" },
                    { label: "Total Story Impressions", value: fmt(stats.igStory.impressions), col: "ig_story_impressions" },
                  ].filter((row) => showCol(row.col)).map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Sales breakdown */}
          {stats.hasSales && show("sales") && (
            <div className="mt-6 max-w-md">
              <div className="bg-white/[0.06] border border-emerald-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-black uppercase tracking-wider">Sales</h3>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/[0.06] rounded-lg p-3 text-center">
                    <div className="text-xl md:text-2xl font-black text-emerald-400">{fmt(stats.sales.conversions)}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-1">Conversions</div>
                  </div>
                  <div className="bg-white/[0.06] rounded-lg p-3 text-center">
                    <div className="text-xl md:text-2xl font-black text-emerald-400">{dollar(stats.sales.revenue)}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-1">Revenue</div>
                  </div>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Avg Conversion Rate", value: stats.sales.conversion_rate_count > 0 ? pct(stats.sales.conversion_rate_sum / stats.sales.conversion_rate_count) : "—" },
                    { label: "Avg Cost Per Acquisition", value: stats.sales.cost_per_acquisition_count > 0 ? dollar(stats.sales.cost_per_acquisition_sum / stats.sales.cost_per_acquisition_count) : "—" },
                    { label: "Avg ROAS", value: stats.sales.roas_count > 0 ? (stats.sales.roas_sum / stats.sales.roas_count).toFixed(2) + "x" : "—" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 5: TOP PERFORMERS ─────────────────────── */}
      {show("top_performers") && topPerformers.length > 0 && (
        <div ref={(el) => { sectionRefs.current["top_performers"] = el; }} data-section="top_performers" className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 mb-8">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide">Top Performers</h2>
            <div className="flex gap-2">
              {(["engagement", "impressions"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTopPerformerMode(mode)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${
                    topPerformerMode === mode ? "bg-brand text-white" : "border border-white/15 text-white/70"
                  }`}
                >
                  {mode === "engagement" ? "Engagement Rate" : "Impressions"}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop: all same size, #1 highlighted in orange */}
          <div className="hidden md:flex items-end justify-center gap-4">
            {topPerformers.map((entry, i) => {
              const metricValue = topPerformerMode === "engagement" ? formatEngagementRate(entry.bestEngRate) : fmt(entry.totalImpressions);
              const metricLabel = topPerformerMode === "engagement" ? "Engagement Rate" : "Impressions";

              if (entry.kind === "collab") {
                const items = collabMediaItems(entry);
                const names = entry.athleteNames;
                const primaryNames = names.slice(0, 2).join(" + ");
                const remaining = Math.max(0, names.length - 2);
                const nameLabel = remaining > 0 ? `${primaryNames} + ${remaining} more` : primaryNames;
                return (
                  <div key={`collab-${entry.id}`} className="flex-1 max-w-[280px]">
                    <div className="text-center mb-2">
                      <div className="text-2xl font-black text-brand">{metricValue}</div>
                      <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">{metricLabel}</div>
                      {topPerformerMode === "engagement" && entry.bestPlatform && (
                        <div className="text-[10px] text-white/40 font-medium mt-0.5">{entry.bestPlatform}</div>
                      )}
                    </div>
                    <div className="relative rounded-xl overflow-hidden h-[380px] border-2 border-brand shadow-[0_0_25px_rgba(215,63,9,0.3)]">
                      {items.length > 0 ? (
                        <TopPerformerMedia items={items} name={nameLabel} />
                      ) : (
                        <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
                          <span className="text-xs text-white/35 font-bold uppercase">No content</span>
                        </div>
                      )}
                      <div className="absolute top-3 left-3 w-9 h-9 rounded-full text-white text-base font-black flex items-center justify-center z-10 bg-brand">
                        {i + 1}
                      </div>
                    </div>
                    <div className="mt-3 px-1 text-center">
                      <div className="text-base font-black uppercase truncate">{nameLabel}</div>
                      <div className="mt-1">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-brand text-white tracking-wider">Collab</span>
                      </div>
                      <div className="text-xs text-white/70 mt-1">{fmt(entry.combinedFollowers)} combined followers</div>
                      {entry.url && (
                        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-white/50 hover:text-brand transition-colors">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          View Post
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              const a = entry;
              const items = media[a.id] || [];
              return (
                <div key={a.id} className="flex-1 max-w-[280px]">
                  {/* Number above image */}
                  <div className="text-center mb-2">
                    <div className="text-2xl font-black text-brand">{metricValue}</div>
                    <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">{metricLabel}</div>
                    {topPerformerMode === "engagement" && a.bestPlatform && (
                      <div className="text-[10px] text-white/40 font-medium mt-0.5">{a.bestPlatform}</div>
                    )}
                  </div>
                  <div className="relative rounded-xl overflow-hidden h-[380px] border-2 border-brand shadow-[0_0_25px_rgba(215,63,9,0.3)]">
                    {items.length > 0 ? (
                      <TopPerformerMedia items={items} name={a.name} />
                    ) : (
                      <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
                        <span className="text-xs text-white/35 font-bold uppercase">No content</span>
                      </div>
                    )}
                    {/* Rank badge */}
                    <div className="absolute top-3 left-3 w-9 h-9 rounded-full text-white text-base font-black flex items-center justify-center z-10 bg-brand">
                      {i + 1}
                    </div>
                  </div>
                  <div className="mt-3 px-1 text-center">
                    <div className="text-base font-black uppercase truncate">{a.name}</div>
                    <div className="text-xs text-white/70">{a.school} &middot; {a.sport}</div>
                    {a.ig_handle && (
                      <a href={`https://instagram.com/${a.ig_handle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-white/50 hover:text-brand transition-colors">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                        @{a.ig_handle}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: #1 full-width + orange highlight, rest 2-col */}
          <div className="md:hidden grid grid-cols-2 gap-3">
            {topPerformers.map((entry, i) => {
              const isFirst = i === 0;
              const metricValue = topPerformerMode === "engagement" ? formatEngagementRate(entry.bestEngRate) : fmt(entry.totalImpressions);
              const metricLabel = topPerformerMode === "engagement" ? "Engagement Rate" : "Impressions";

              if (entry.kind === "collab") {
                const items = collabMediaItems(entry);
                const names = entry.athleteNames;
                const primaryNames = names.slice(0, 2).join(" + ");
                const remaining = Math.max(0, names.length - 2);
                const nameLabel = remaining > 0 ? `${primaryNames} + ${remaining} more` : primaryNames;
                return (
                  <div key={`collab-${entry.id}`} className={isFirst ? "col-span-2" : ""}>
                    <div className="text-center mb-1.5">
                      <div className={`${isFirst ? "text-xl" : "text-lg"} font-black text-brand`}>{metricValue}</div>
                      <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">{metricLabel}</div>
                      {topPerformerMode === "engagement" && entry.bestPlatform && (
                        <div className="text-[10px] text-white/40 font-medium mt-0.5">{entry.bestPlatform}</div>
                      )}
                    </div>
                    <div className={`relative rounded-xl overflow-hidden border-2 border-brand shadow-[0_0_20px_rgba(215,63,9,0.3)] ${isFirst ? "h-[280px]" : "h-[220px]"}`}>
                      {items.length > 0 ? (
                        <TopPerformerMedia items={items} name={nameLabel} />
                      ) : (
                        <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
                          <span className="text-xs text-white/35 font-bold uppercase">No content</span>
                        </div>
                      )}
                      <div className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full text-white text-sm font-black flex items-center justify-center z-10 bg-brand">
                        {i + 1}
                      </div>
                    </div>
                    <div className="mt-2.5 px-1 text-center">
                      <div className="text-sm font-black uppercase truncate">{nameLabel}</div>
                      <div className="mt-1">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-brand text-white tracking-wider">Collab</span>
                      </div>
                      <div className="text-xs text-white/70 mt-1">{fmt(entry.combinedFollowers)} combined followers</div>
                      {entry.url && (
                        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[10px] text-white/50 hover:text-brand transition-colors">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          View Post
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              const a = entry;
              const items = media[a.id] || [];
              return (
                <div key={a.id} className={isFirst ? "col-span-2" : ""}>
                  {/* Number above image */}
                  <div className="text-center mb-1.5">
                    <div className={`${isFirst ? "text-xl" : "text-lg"} font-black text-brand`}>{metricValue}</div>
                    <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">{metricLabel}</div>
                    {topPerformerMode === "engagement" && a.bestPlatform && (
                      <div className="text-[10px] text-white/40 font-medium mt-0.5">{a.bestPlatform}</div>
                    )}
                  </div>
                  <div className={`relative rounded-xl overflow-hidden border-2 border-brand shadow-[0_0_20px_rgba(215,63,9,0.3)] ${isFirst ? "h-[280px]" : "h-[220px]"}`}>
                    {items.length > 0 ? (
                      <TopPerformerMedia items={items} name={a.name} />
                    ) : (
                      <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
                        <span className="text-xs text-white/35 font-bold uppercase">No content</span>
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full text-white text-sm font-black flex items-center justify-center z-10 bg-brand">
                      {i + 1}
                    </div>
                  </div>
                  <div className="mt-2.5 px-1 text-center">
                    <div className="text-sm font-black uppercase truncate">{a.name}</div>
                    <div className="text-xs text-white/70">{a.school}</div>
                    {a.ig_handle && (
                      <a href={`https://instagram.com/${a.ig_handle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[10px] text-white/50 hover:text-brand transition-colors">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                        @{a.ig_handle}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 6: CONTENT GALLERY ─────────────────────── */}
      {show("content_gallery") && (
        <div ref={(el) => { sectionRefs.current["content_gallery"] = el; }} data-section="content_gallery" className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 mb-6">
            <h2 className="text-xl md:text-2xl font-black uppercase">Best In Class Content</h2>
            <div className="flex gap-2">
              {["all", "photo", "video"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-xs font-bold uppercase ${
                    filter === f ? "bg-brand text-white" : "border border-white/15 text-white/70"
                  }`}
                >
                  {f === "all" ? "All" : f === "photo" ? "Photos" : "Videos"}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-[#0a0a0a] border border-white/[0.15] rounded-xl p-2">
            {(() => {
              type GalleryEntry =
                | { kind: "solo"; athlete: Athlete; items: Media[] }
                | { kind: "collab"; group: CollabGroup; items: Media[] };

              const collabEntries: GalleryEntry[] = collabGroups
                .map((g) => ({ kind: "collab" as const, group: g, items: collabMediaItems(g) }))
                .filter(({ items }) => {
                  if (filter === "all") return true;
                  if (filter === "photo") return items.some((m) => m.type === "image");
                  return items.some((m) => m.type === "video");
                });

              const soloEntries: GalleryEntry[] = filtered.map((a) => ({
                kind: "solo" as const,
                athlete: a,
                items: media[a.id] || [],
              }));

              const allEntries: GalleryEntry[] = [...collabEntries, ...soloEntries];

              const GALLERY_VISIBLE_COUNT = 10;
              const galleryIsTruncated = allEntries.length > GALLERY_VISIBLE_COUNT;
              const visibleEntries = galleryExpanded || !galleryIsTruncated
                ? allEntries
                : allEntries.slice(0, GALLERY_VISIBLE_COUNT);

              const distributed = distributeShortestFirst(
                visibleEntries,
                cols,
                (entry, i) => estimateCardHeightRatio(i, entry.items.some((m) => m.type === "video")),
              );
              return (
                <>
                  <div className="balanced-masonry">
                    {distributed.map((colItems, colIdx) => (
                      <div key={colIdx} className="balanced-masonry_col">
                        {colItems.map(({ item: entry, originalIndex }) => (
                          entry.kind === "collab" ? (
                            <CollabCard
                              key={`collab-${entry.group.id}`}
                              group={entry.group}
                              items={entry.items}
                              activeFilter={filter}
                              athletes={fullRoster}
                              cardIndex={originalIndex}
                              onViewMore={() => openCollabModal(entry.group, entry.items)}
                            />
                          ) : (
                            <AthleteCard
                              key={entry.athlete.id}
                              athlete={entry.athlete}
                              items={entry.items}
                              activeFilter={filter}
                              cardIndex={originalIndex}
                              onViewMore={() => openAthleteModal(entry.athlete, entry.items)}
                            />
                          )
                        ))}
                      </div>
                    ))}
                  </div>
                  {galleryIsTruncated && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => setGalleryExpanded((v) => !v)}
                        className="px-6 py-3 rounded-full border border-white/[0.20] bg-white/[0.04] hover:bg-white/[0.10] hover:border-white/[0.35] transition-all text-sm font-bold uppercase tracking-wider text-white inline-flex items-center gap-2"
                      >
                        {galleryExpanded ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                            Collapse Gallery
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                            Expand to Full Gallery
                            <span className="ml-1 text-[10px] font-black text-white/50">+{allEntries.length - GALLERY_VISIBLE_COUNT}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <style jsx global>{`
            .balanced-masonry {
              display: flex;
              gap: 8px;
              width: 100%;
            }
            .balanced-masonry_col {
              flex: 1 1 0;
              min-width: 0;
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            /* Collapse to 2 columns under 768px, 1 column under 480px —
               matches the old breakpointCols behaviour. */
            @media (max-width: 767px) {
              .balanced-masonry { flex-wrap: wrap; }
              .balanced-masonry_col {
                flex: 1 1 calc(50% - 4px);
              }
            }
            @media (max-width: 479px) {
              .balanced-masonry_col {
                flex: 1 1 100%;
              }
            }
          `}</style>
        </div>
      )}

      {/* ── SECTION 7: CAMPAIGN ROSTER ─────────────────────── */}
      {show("roster") && (
        <div ref={(el) => { sectionRefs.current["roster"] = el; }} data-section="roster" className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-8">Campaign Roster</h2>

          {(() => {
            const hasAnyImpressions = fullRoster.some(a => getTotalImpressions(a) > 0);
            const hasAnyEngagements = fullRoster.some(a => getTotalEngagements(a) > 0);
            const hasAnyEngRate = fullRoster.some(a => getBestEngRate(a) > 0);
            const hasAnyFeedUrl = fullRoster.some(a => a.metrics?.ig_feed?.post_url);
            const hasAnyReelUrl = fullRoster.some(a => a.metrics?.ig_reel?.post_url);
            const hasAnyFollowers = fullRoster.some(a => a.ig_followers && a.ig_followers > 0);
            const bebas = "var(--font-bebas-neue), 'Bebas Neue', sans-serif";

            const collabBracketTitle = (group: CollabGroup) => {
              const first = fullRoster.find((a) => a.name === group.athleteNames[0]);
              return first ? `${first.school} ${first.sport} Collab Post` : "Collab Post";
            };

            // Uppercase platform label for collab totals badges ("IG FEED", "IG REEL").
            const platName = (p: "ig_feed" | "ig_reel" | "tiktok") =>
              p === "ig_feed" ? "IG Feed" : p === "ig_reel" ? "IG Reel" : "TikTok";

            const renderBracketHeader = (group: CollabGroup, compact: boolean) => {
              const schoolSport = collabBracketTitle(group).replace(/ Collab Post$/, "");
              return (
                <div style={{ background: "rgba(215,63,9,0.07)", borderBottom: "1px solid rgba(215,63,9,0.2)", padding: compact ? "10px 12px" : "10px 16px" }}>
                  <span style={{ fontFamily: bebas, fontSize: compact ? 18 : 22, fontWeight: 700, letterSpacing: 1.5, color: "#ffffff" }}>{schoolSport}</span>
                  <span style={{
                    display: "inline-block",
                    marginLeft: 12,
                    verticalAlign: "middle",
                    color: "#D73F09",
                    background: "rgba(215,63,9,0.15)",
                    border: "1px solid rgba(215,63,9,0.4)",
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}>COLLAB POST</span>
                </div>
              );
            };

            // Shared column grid so every roster table (collab cards + Individual
            // Posts) lines up — gating mirrors the thead <th> exactly. Used with
            // tableLayout:"fixed" on each table. Long content wraps, never truncates.
            const rosterColgroup = (
              <colgroup>
                <col style={{ width: "4%" }} />
                <col style={{ width: "14%" }} />
                {showCol("school") && <col style={{ width: "21%" }} />}
                {showCol("sport") && <col style={{ width: "10%" }} />}
                {showCol("ig_handle") && <col style={{ width: "15%" }} />}
                {showCol("ig_followers") && hasAnyFollowers && <col style={{ width: "8%" }} />}
                {showCol("ig_feed_impressions") && hasAnyImpressions && <col style={{ width: "8%" }} />}
                {showCol("ig_feed_total") && hasAnyEngagements && <col style={{ width: "8%" }} />}
                {showCol("ig_feed_rate") && hasAnyEngRate && <col style={{ width: "7%" }} />}
                {stats.hasClicks && show("clicks") && showCol("clicks_link_clicks") && <col style={{ width: "6%" }} />}
                {stats.hasClicks && show("clicks") && showCol("clicks_orders") && <col style={{ width: "6%" }} />}
                {stats.hasClicks && show("clicks") && showCol("clicks_sales") && <col style={{ width: "6%" }} />}
                {hasAnyFeedUrl && <col style={{ width: "2.5%" }} />}
                {hasAnyReelUrl && <col style={{ width: "2.5%" }} />}
              </colgroup>
            );

            const renderBracketDesktop = (group: CollabGroup) => {
              const rows = group.athleteNames
                .map((name) => fullRoster.find((x) => x.name === name))
                .filter((a): a is typeof fullRoster[number] => !!a);
              const feedSource = group.sources.find((s) => s.platform === "ig_feed");
              const reelSource = group.sources.find((s) => s.platform === "ig_reel");
              return (
                <div key={group.id} style={{ border: "1.5px solid rgba(215,63,9,0.5)", borderLeft: "3px solid #D73F09", borderRadius: 12, overflow: "hidden", marginBottom: 28, background: "rgba(15,15,18,0.5)" }}>
                  {renderBracketHeader(group, false)}
                  <table className="w-full text-left" style={{ tableLayout: "fixed" }}>
                    {rosterColgroup}
                    <thead>
                      <tr className="border-b border-white/[0.15]">
                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 w-10">#</th>
                        <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Athlete</th>
                        {showCol("school") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">School</th>}
                        {showCol("sport") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Sport</th>}
                        {showCol("ig_handle") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">IG Handle</th>}
                        {showCol("ig_followers") && hasAnyFollowers && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Followers</th>}
                        {showCol("ig_feed_impressions") && hasAnyImpressions && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Impressions</th>}
                        {showCol("ig_feed_total") && hasAnyEngagements && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Engagements</th>}
                        {showCol("ig_feed_rate") && hasAnyEngRate && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Eng. Rate</th>}
                        {stats.hasClicks && show("clicks") && showCol("clicks_link_clicks") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Clicks</th>}
                        {stats.hasClicks && show("clicks") && showCol("clicks_orders") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Orders</th>}
                        {stats.hasClicks && show("clicks") && showCol("clicks_sales") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Sales</th>}
                        {hasAnyFeedUrl && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-center">Post</th>}
                        {hasAnyReelUrl && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-center">Reel</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((a, idx) => {
                        const isLast = idx === rows.length - 1;
                        const rowStyle = {
                          background: "rgba(215,63,9,0.03)",
                          borderBottom: isLast ? "none" : "1px solid rgba(215,63,9,0.07)",
                        } as const;
                        return (
                          <tr key={a.id} style={rowStyle}>
                            <td className="px-3 py-3 w-10" style={{ color: "rgba(215,63,9,0.25)", fontSize: 10, fontWeight: 900 }}>{idx + 1}</td>
                            <td className="px-3 py-3" style={{ color: "#e8e5e0", fontWeight: 700, textTransform: "uppercase", fontSize: 12 }}>{a.name}</td>
                            {showCol("school") && <td className="px-3 py-3 text-sm text-white/70">{a.school}</td>}
                            {showCol("sport") && <td className="px-3 py-3"><span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-brand/15 text-brand">{a.sport}</span></td>}
                            {showCol("ig_handle") && <td className="px-3 py-3 text-sm">{a.ig_handle ? (
                              <a href={`https://instagram.com/${a.ig_handle}`} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-brand transition-colors inline-flex items-center gap-1">@{a.ig_handle}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></a>
                            ) : "\u2014"}</td>}
                            {showCol("ig_followers") && hasAnyFollowers && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</td>}
                            {showCol("ig_feed_impressions") && hasAnyImpressions && <td className="px-3 py-3 text-right" style={{ color: "rgba(215,63,9,0.7)", fontSize: 14, lineHeight: 1 }}>{"\u2193"}</td>}
                            {showCol("ig_feed_total") && hasAnyEngagements && <td className="px-3 py-3 text-right" style={{ color: "rgba(215,63,9,0.7)", fontSize: 14, lineHeight: 1 }}>{"\u2193"}</td>}
                            {showCol("ig_feed_rate") && hasAnyEngRate && <td className="px-3 py-3 text-right" style={{ color: "rgba(215,63,9,0.7)", fontSize: 14, lineHeight: 1 }}>{"\u2193"}</td>}
                            {stats.hasClicks && show("clicks") && showCol("clicks_link_clicks") && <td className="px-3 py-3 text-sm font-bold text-white/35 text-right">{"\u2014"}</td>}
                            {stats.hasClicks && show("clicks") && showCol("clicks_orders") && <td className="px-3 py-3 text-sm font-bold text-white/35 text-right">{"\u2014"}</td>}
                            {stats.hasClicks && show("clicks") && showCol("clicks_sales") && <td className="px-3 py-3 text-sm font-bold text-white/35 text-right">{"\u2014"}</td>}
                            {hasAnyFeedUrl && (
                              <td className="px-3 py-3 text-center">
                                {feedSource ? (
                                  <a href={feedSource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand/15 text-brand hover:bg-brand/30 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                  </a>
                                ) : (
                                  <span className="text-white/35">&mdash;</span>
                                )}
                              </td>
                            )}
                            {hasAnyReelUrl && (
                              <td className="px-3 py-3 text-center">
                                {reelSource ? (
                                  <a href={reelSource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                  </a>
                                ) : (
                                  <span className="text-white/35">&mdash;</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {group.sources.map((s, si) => {
                        const isFeed = s.platform === "ig_feed";
                        const totalVal = isFeed ? (s.metrics.impressions ?? 0) : (s.metrics.views ?? 0);
                        const numStyle = { color: "#D73F09", fontWeight: 700, fontSize: 13, fontFamily: bebas } as const;
                        return (
                          <tr key={`${group.id}-tot-${si}`} style={{
                            background: "rgba(215,63,9,0.08)",
                            borderTop: si === 0 ? "1px solid rgba(215,63,9,0.3)" : "1px solid rgba(215,63,9,0.15)",
                          }}>
                            <td className="px-3 py-3 w-10" />
                            <td className="px-3 py-3">
                              <span style={{ display: "inline-block", color: "#fff", background: "#D73F09", padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{platName(s.platform).toUpperCase()}</span>
                            </td>
                            {showCol("school") && <td className="px-3 py-3" />}
                            {showCol("sport") && <td className="px-3 py-3" />}
                            {showCol("ig_handle") && <td className="px-3 py-3" />}
                            {showCol("ig_followers") && hasAnyFollowers && <td className="px-3 py-3 text-right" style={numStyle}>{fmt(group.combinedFollowers)}</td>}
                            {showCol("ig_feed_impressions") && hasAnyImpressions && <td className="px-3 py-3 text-right" style={numStyle}>{fmt(totalVal)}</td>}
                            {showCol("ig_feed_total") && hasAnyEngagements && <td className="px-3 py-3 text-right" style={numStyle}>{fmt(s.metrics.totalEngagements ?? 0)}</td>}
                            {showCol("ig_feed_rate") && hasAnyEngRate && <td className="px-3 py-3 text-right" style={numStyle}>{formatEngagementRate(s.combinedEngagementRate)}</td>}
                            {stats.hasClicks && show("clicks") && showCol("clicks_link_clicks") && <td className="px-3 py-3" />}
                            {stats.hasClicks && show("clicks") && showCol("clicks_orders") && <td className="px-3 py-3" />}
                            {stats.hasClicks && show("clicks") && showCol("clicks_sales") && <td className="px-3 py-3" />}
                            {hasAnyFeedUrl && (
                              <td className="px-3 py-3 text-center">
                                {isFeed ? (
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand/15 text-brand hover:bg-brand/30 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                  </a>
                                ) : (
                                  <span className="text-white/35">&mdash;</span>
                                )}
                              </td>
                            )}
                            {hasAnyReelUrl && (
                              <td className="px-3 py-3 text-center">
                                {s.platform === "ig_reel" ? (
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                  </a>
                                ) : (
                                  <span className="text-white/35">&mdash;</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            };

            const renderBracketMobile = (group: CollabGroup) => {
              const rows = group.athleteNames
                .map((name) => fullRoster.find((x) => x.name === name))
                .filter((a): a is typeof fullRoster[number] => !!a);
              return (
                <div key={group.id} style={{ border: "1.5px solid rgba(215,63,9,0.5)", borderLeft: "3px solid #D73F09", borderRadius: 12, overflow: "hidden", marginBottom: 28, background: "rgba(15,15,18,0.5)" }}>
                  {renderBracketHeader(group, true)}
                  {rows.map((a, idx) => {
                    const isLast = idx === rows.length - 1;
                    return (
                      <div key={a.id} className="flex items-center" style={{
                        background: "rgba(215,63,9,0.03)",
                        borderBottom: isLast ? "none" : "1px solid rgba(215,63,9,0.07)",
                        padding: "10px 12px",
                        gap: 10,
                      }}>
                        <span style={{ color: "rgba(215,63,9,0.45)", fontSize: 10, fontWeight: 900, width: 16, textAlign: "right" }}>{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#e8e5e0" }}>{a.name}</div>
                          {a.ig_handle && (
                            <a href={`https://instagram.com/${a.ig_handle}`} target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-brand transition-colors" style={{ fontSize: 10 }}>@{a.ig_handle}</a>
                          )}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</span>
                      </div>
                    );
                  })}
                  {group.sources.map((s, si) => {
                    const isFeed = s.platform === "ig_feed";
                    const totalVal = isFeed ? (s.metrics.impressions ?? 0) : (s.metrics.views ?? 0);
                    const totalLabel = isFeed ? "Impressions" : "Views";
                    const stat = (value: string, label: string) => (
                      <div>
                        <div style={{ fontFamily: bebas, fontSize: 15, color: "#D73F09", lineHeight: 1 }}>{value}</div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 3 }}>{label}</div>
                      </div>
                    );
                    return (
                      <div key={`${group.id}-mtot-${si}`} style={{
                        background: "rgba(215,63,9,0.08)",
                        borderTop: si === 0 ? "1px solid rgba(215,63,9,0.3)" : "1px solid rgba(215,63,9,0.15)",
                        padding: "12px", display: "flex", flexDirection: "column", gap: 8,
                      }}>
                        <span style={{ alignSelf: "flex-start", color: "#fff", background: "#D73F09", padding: "4px 10px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>{platName(s.platform).toUpperCase()}</span>
                        <div className="flex" style={{ gap: 16, flexWrap: "wrap" }}>
                          {stat(formatEngagementRate(s.combinedEngagementRate), "Combined ER")}
                          {stat(fmt(totalVal), totalLabel)}
                          {stat(fmt(s.metrics.totalEngagements ?? 0), "Engagements")}
                          {stat(fmt(group.combinedFollowers), "Combined Followers")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            };

            // One bracket per TEAM (athlete-id set). detectCollabGroups emits one
            // group PER PLATFORM, so a team that posted both a feed and a reel
            // (e.g. UF Softball) arrives as two groups with the same athlete set.
            // Merge those into a single group whose `sources` union every platform
            // (ordered feed → reel → tiktok) — renderBracket already renders one
            // totals row per source, so the athletes list once with a metrics row
            // stacked per platform. Single-platform teams keep their lone row.
            const platformRank: Record<"ig_feed" | "ig_reel" | "tiktok", number> = { ig_feed: 0, ig_reel: 1, tiktok: 2 };
            const mergedCollabGroups: CollabGroup[] = (() => {
              const bySet = new Map<string, CollabGroup>();
              for (const g of collabGroups) {
                const key = [...g.athleteIds].sort().join("|");
                const existing = bySet.get(key);
                if (existing) {
                  existing.sources = [...existing.sources, ...g.sources];
                } else {
                  bySet.set(key, { ...g, sources: [...g.sources] });
                }
              }
              const out = Array.from(bySet.values());
              for (const g of out) {
                g.sources = [...g.sources].sort((a, b) => platformRank[a.platform] - platformRank[b.platform]);
              }
              return out;
            })();

            const divider = (
              <div className="flex items-center" style={{ gap: 12, margin: "20px 0" }}>
                <div className="flex-1" style={{ height: 1, background: "#141416" }} />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#2a2a2e" }}>Individual Posts</span>
                <div className="flex-1" style={{ height: 1, background: "#141416" }} />
              </div>
            );

            return (<>
          {/* Desktop: collab brackets, divider, solo athlete table */}
          <div className="hidden md:block overflow-x-auto">
            {mergedCollabGroups.length > 0 && (
              <>
                {mergedCollabGroups.map(renderBracketDesktop)}
                {divider}
              </>
            )}
            {visibleRosterAthletes.length > 0 && (
              <table className="w-full text-left" style={{ tableLayout: "fixed" }}>
                {rosterColgroup}
                <thead>
                  <tr className="border-b border-white/[0.15]">
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 w-10">#</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Athlete</th>
                    {showCol("school") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">School</th>}
                    {showCol("sport") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Sport</th>}
                    {showCol("ig_handle") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">IG Handle</th>}
                    {showCol("ig_followers") && hasAnyFollowers && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Followers</th>}
                    {showCol("ig_feed_impressions") && hasAnyImpressions && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Impressions</th>}
                    {showCol("ig_feed_total") && hasAnyEngagements && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Engagements</th>}
                    {showCol("ig_feed_rate") && hasAnyEngRate && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Eng. Rate</th>}
                    {stats.hasClicks && show("clicks") && showCol("clicks_link_clicks") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Clicks</th>}
                    {stats.hasClicks && show("clicks") && showCol("clicks_orders") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Orders</th>}
                    {stats.hasClicks && show("clicks") && showCol("clicks_sales") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Sales</th>}
                    {hasAnyFeedUrl && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-center">Post</th>}
                    {hasAnyReelUrl && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-center">Reel</th>}
                  </tr>
                </thead>
                <tbody>
                  {visibleRosterAthletes.flatMap((a, i) => {
                    const m = a.metrics || {};
                    const feedUrl = m.ig_feed?.post_url || null;
                    const reelUrl = m.ig_reel?.post_url || null;
                    // A second post is real only if it has a non-empty post_url. A post
                    // always has a URL; bare metric fields (e.g. a leaked ER% in
                    // ig_feed_2.impressions) must NOT fabricate a "Post 2" sub-row.
                    const realPost2 = (s?: { post_url?: string }) =>
                      typeof s?.post_url === "string" && s.post_url.trim() !== "";
                    const hasReel2 = realPost2(m.ig_reel_2);
                    const hasFeed2 = realPost2(m.ig_feed_2);
                    const hasTiktok2 = realPost2(m.tiktok_2);
                    const hasAnyPost2 = hasReel2 || hasFeed2 || hasTiktok2;

                    // Visual grouping for multi-post athletes (styling only): a solid
                    // orange bar runs down the athlete row + its sub-rows, and small
                    // "2 reels"/"2 feed"/"2 tiktoks" pills sit next to the name. Pill
                    // style mirrors MetricsSpreadsheet.tsx so editor + recap match.
                    const accentBar: React.CSSProperties = { boxShadow: "inset 3px 0 0 #D73F09" };
                    const post2Pills = [
                      hasFeed2 && "2 feed",
                      hasReel2 && "2 reels",
                      hasTiktok2 && "2 tiktoks",
                    ].filter(Boolean) as string[];

                    const mainRow = (
                    <tr key={a.id} className="border-b border-white/[0.10] hover:bg-white/[0.04]">
                      <td className="px-3 py-3 text-sm font-black text-white/45" style={hasAnyPost2 ? accentBar : undefined}>{i + 1}</td>
                      <td className="px-3 py-3 text-sm font-black uppercase">
                        {a.name}
                        {post2Pills.map((p) => (
                          <span key={p} className="ml-1.5 inline-block align-middle px-1.5 py-px rounded-full bg-[#D73F09]/15 text-[#D73F09] text-[9px] font-bold uppercase tracking-wide leading-tight">{p}</span>
                        ))}
                      </td>
                      {showCol("school") && <td className="px-3 py-3 text-sm text-white/70">{a.school}</td>}
                      {showCol("sport") && <td className="px-3 py-3">
                        <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-brand/15 text-brand">
                          {a.sport}
                        </span>
                      </td>}
                      {showCol("ig_handle") && <td className="px-3 py-3 text-sm">{a.ig_handle ? (
                        <a href={`https://instagram.com/${a.ig_handle}`} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-brand transition-colors inline-flex items-center gap-1">@{a.ig_handle}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></a>
                      ) : "\u2014"}</td>}
                      {showCol("ig_followers") && hasAnyFollowers && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</td>}
                      {showCol("ig_feed_impressions") && hasAnyImpressions && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{fmt(getTotalImpressions(a))}</td>}
                      {showCol("ig_feed_total") && hasAnyEngagements && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{fmt(getTotalEngagements(a))}</td>}
                      {showCol("ig_feed_rate") && hasAnyEngRate && <td className="px-3 py-3 text-sm font-bold text-brand text-right">{getBestEngRate(a) > 0 ? formatEngagementRate(getBestEngRate(a)) : "\u2014"}</td>}
                      {stats.hasClicks && show("clicks") && showCol("clicks_link_clicks") && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{m.clicks?.link_clicks ? fmt(m.clicks.link_clicks) : "\u2014"}</td>}
                      {stats.hasClicks && show("clicks") && showCol("clicks_orders") && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{m.clicks?.orders ? fmt(m.clicks.orders) : "\u2014"}</td>}
                      {stats.hasClicks && show("clicks") && showCol("clicks_sales") && <td className="px-3 py-3 text-sm font-bold text-emerald-400 text-right">{m.clicks?.sales ? dollar(m.clicks.sales) : "\u2014"}</td>}
                      {hasAnyFeedUrl && (
                        <td className="px-3 py-3 text-center">
                          {feedUrl ? (
                            <a href={feedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand/15 text-brand hover:bg-brand/30 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          ) : (
                            <span className="text-white/35">&mdash;</span>
                          )}
                        </td>
                      )}
                      {hasAnyReelUrl && (
                        <td className="px-3 py-3 text-center">
                          {reelUrl ? (
                            <a href={reelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            </a>
                          ) : (
                            <span className="text-white/35">&mdash;</span>
                          )}
                        </td>
                      )}
                    </tr>
                    );

                    if (!hasAnyPost2) return [mainRow];

                    // Build Post 1 + Post 2 sub-rows for each platform that has a second post.
                    // Sub-rows are desktop-only (hidden md:table-row) and show per-post metrics.
                    const subRowBg: React.CSSProperties = { background: "rgba(215,63,9,0.06)" };

                    type PostSlotData = { label: string; impressions?: number; engagements?: number; erFol?: number; erImp?: number; url?: string | null; };
                    const slots: PostSlotData[] = [];

                    if (hasReel2) {
                      slots.push({ label: "Reel Post 1", impressions: m.ig_reel?.views, engagements: m.ig_reel?.total_engagements, erFol: m.ig_reel?.engagement_rate_followers, erImp: m.ig_reel?.engagement_rate_impressions, url: m.ig_reel?.post_url });
                      slots.push({ label: "Reel Post 2", impressions: m.ig_reel_2?.views, engagements: m.ig_reel_2?.total_engagements, erFol: m.ig_reel_2?.engagement_rate_followers, erImp: m.ig_reel_2?.engagement_rate_impressions, url: m.ig_reel_2?.post_url });
                    }
                    if (hasFeed2) {
                      slots.push({ label: "Feed Post 1", impressions: m.ig_feed?.impressions, engagements: m.ig_feed?.total_engagements, erFol: m.ig_feed?.engagement_rate_followers, erImp: m.ig_feed?.engagement_rate_impressions, url: m.ig_feed?.post_url });
                      slots.push({ label: "Feed Post 2", impressions: m.ig_feed_2?.impressions, engagements: m.ig_feed_2?.total_engagements, erFol: m.ig_feed_2?.engagement_rate_followers, erImp: m.ig_feed_2?.engagement_rate_impressions, url: m.ig_feed_2?.post_url });
                    }
                    if (hasTiktok2) {
                      slots.push({ label: "TikTok Post 1", impressions: m.tiktok?.views, engagements: m.tiktok?.total_engagements, erFol: m.tiktok?.engagement_rate_followers, erImp: m.tiktok?.engagement_rate_impressions, url: m.tiktok?.post_url });
                      slots.push({ label: "TikTok Post 2", impressions: m.tiktok_2?.views, engagements: m.tiktok_2?.total_engagements, erFol: m.tiktok_2?.engagement_rate_followers, erImp: m.tiktok_2?.engagement_rate_impressions, url: m.tiktok_2?.post_url });
                    }

                    const subRows = slots.map((slot) => {
                      const er = Math.max(slot.erFol ?? 0, slot.erImp ?? 0);
                      const isFeed = slot.label.startsWith("Feed");
                      const isReel = slot.label.startsWith("Reel");
                      return (
                        <tr key={`${a.id}-${slot.label}`} className="hidden md:table-row border-b border-white/[0.06]" style={subRowBg}>
                          <td className="px-3 py-2" style={accentBar} />
                          <td className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#D73F09]">↳ {slot.label}</td>
                          {showCol("school") && <td className="px-3 py-2" />}
                          {showCol("sport") && <td className="px-3 py-2" />}
                          {showCol("ig_handle") && <td className="px-3 py-2" />}
                          {showCol("ig_followers") && hasAnyFollowers && <td className="px-3 py-2" />}
                          {showCol("ig_feed_impressions") && hasAnyImpressions && <td className="px-3 py-2 text-right text-sm text-white/90">{slot.impressions ? fmt(slot.impressions) : "\u2014"}</td>}
                          {showCol("ig_feed_total") && hasAnyEngagements && <td className="px-3 py-2 text-right text-sm text-white/90">{slot.engagements ? fmt(slot.engagements) : "\u2014"}</td>}
                          {showCol("ig_feed_rate") && hasAnyEngRate && <td className="px-3 py-2 text-right text-sm text-white/90">{er > 0 ? formatEngagementRate(er) : "\u2014"}</td>}
                          {stats.hasClicks && show("clicks") && showCol("clicks_link_clicks") && <td className="px-3 py-2" />}
                          {stats.hasClicks && show("clicks") && showCol("clicks_orders") && <td className="px-3 py-2" />}
                          {stats.hasClicks && show("clicks") && showCol("clicks_sales") && <td className="px-3 py-2" />}
                          {hasAnyFeedUrl && (
                            <td className="px-3 py-2 text-center">
                              {isFeed && slot.url ? (
                                <a href={slot.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand/10 text-brand hover:bg-brand/25 transition-colors">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              ) : null}
                            </td>
                          )}
                          {hasAnyReelUrl && (
                            <td className="px-3 py-2 text-center">
                              {isReel ? (
                                slot.url ? (
                                  <a href={slot.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-white/30">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                  </span>
                                )
                              ) : null}
                            </td>
                          )}
                          {hasTiktok2 && (
                            <td className="px-3 py-2 text-center">
                              {slot.label.startsWith("TikTok") ? (
                                slot.url ? (
                                  <a href={slot.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-white/30">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                  </span>
                                )
                              ) : null}
                            </td>
                          )}
                        </tr>
                      );
                    });

                    return [mainRow, ...subRows];
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Mobile: collab brackets, divider, solo athlete cards */}
          <div className="md:hidden">
            {mergedCollabGroups.length > 0 && (
              <>
                {mergedCollabGroups.map(renderBracketMobile)}
                {divider}
              </>
            )}
            <div className="space-y-1">
              {visibleRosterAthletes.map((a, i) => {
                const m = a.metrics || {};
                const feedUrl = m.ig_feed?.post_url || null;
                const reelUrl = m.ig_reel?.post_url || null;
                return (
                <div key={a.id} className="flex items-center gap-3 py-3 px-3 rounded-lg bg-white/[0.05] border border-white/[0.10]">
                  <span className="text-sm font-black text-white/45 w-6 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black uppercase">{a.name}</div>
                    <div className="text-xs text-white/70">{a.school} &middot; {a.sport}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {showCol("ig_followers") && hasAnyFollowers && <div className="text-sm font-bold text-white/70">{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</div>}
                    {showCol("ig_feed_rate") && hasAnyEngRate && getBestEngRate(a) > 0 && (
                      <div className="text-xs font-bold text-brand">{formatEngagementRate(getBestEngRate(a))}</div>
                    )}
                    {stats.hasClicks && show("clicks") && (
                      (showCol("clicks_link_clicks") && m.clicks?.link_clicks) ||
                      (showCol("clicks_orders") && m.clicks?.orders) ||
                      (showCol("clicks_sales") && m.clicks?.sales)
                    ) && (
                      <div className="flex gap-2 justify-end mt-0.5">
                        {showCol("clicks_link_clicks") && m.clicks?.link_clicks ? <span className="text-[10px] text-white/50">{fmt(m.clicks.link_clicks)} clicks</span> : null}
                        {showCol("clicks_orders") && m.clicks?.orders ? <span className="text-[10px] text-white/50">{fmt(m.clicks.orders)} orders</span> : null}
                        {showCol("clicks_sales") && m.clicks?.sales ? <span className="text-[10px] font-bold text-emerald-400">{dollar(m.clicks.sales)}</span> : null}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0 items-center">
                    {feedUrl && (
                      <a href={feedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand/15 text-brand hover:bg-brand/30 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    )}
                    {reelUrl && (
                      <a href={reelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                      </a>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
            </>);
          })()}

          {/* Expand / collapse button for campaigns with >50 athletes */}
          {rosterIsTruncated && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setRosterExpanded((v) => !v)}
                className="px-6 py-3 rounded-full border border-white/[0.20] bg-white/[0.04] hover:bg-white/[0.10] hover:border-white/[0.35] transition-all text-sm font-bold uppercase tracking-wider text-white inline-flex items-center gap-2"
              >
                {rosterExpanded ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                    Collapse Roster
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    Expand to See Full Roster
                    <span className="ml-1 text-[10px] font-black text-white/50">+{hiddenRosterCount}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TEMP: Future Opportunities pulled until finalized — uncomment to restore:
      <FutureOpportunities brandName={campaign.client_name} /> */}

      {/* ── POSTGAME CALENDAR (sits above the footer) ──────── */}
      <PostgameCalendar />

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <div className="recap-footer-area px-6 md:px-12 py-8 border-t border-white/[0.15]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <PostgameLogo size="sm" className="opacity-40" />
          <div className="flex items-center gap-3">
            {settings.brand_logo_url && (
              <img src={settings.brand_logo_url} className="h-5 object-contain opacity-50" alt="" />
            )}
            <span className="text-sm text-white/50">
              &copy; {new Date().getFullYear()} {campaign.client_name}
            </span>
          </div>
        </div>
        <div className="text-center mt-4">
          <span className="text-xs text-white/45 font-bold uppercase tracking-widest">
            Powered by Postgame
          </span>
        </div>
      </div>

      {/* Best-in-Class metrics popup — the reused portal AssetModal, one athlete */}
      {modalData ? (
        <AssetModal
          athletes={[modalData.portalAthlete]}
          startIndex={0}
          startPostIndex={modalData.startPostIndex}
          onClose={() => setModalData(null)}
          showToggleHint
        />
      ) : null}
    </div>
  );
}
