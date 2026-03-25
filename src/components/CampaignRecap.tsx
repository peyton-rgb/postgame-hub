"use client";

import { useState, useRef, useCallback } from "react";
import type { Campaign, Athlete, Media, VisibleSections } from "@/lib/types";
import { fmt, pct, dollar, computeStats, getTopPerformers, getTopPerformersByImpressions, getPostUrl, getMediaLabel, getBestEngRate, getTotalImpressions, getTotalEngagements } from "@/lib/recap-helpers";
import { PostgameLogo } from "./PostgameLogo";
import { TopPerformerMedia } from "./TopPerformerMedia";

// ── Masonry Card ─────────────────────────────────────────────

function MasonryCard({ athlete, items: rawItems, activeFilter }: { athlete: Athlete; items: Media[]; activeFilter: string }) {
  // When photo filter is active, exclude video items from the carousel
  const filteredItems = activeFilter === "photo" ? rawItems.filter((m) => m.type === "image") : rawItems;
  const items = [...filteredItems].sort((a, b) => (a.type === "video" ? -1 : 1) - (b.type === "video" ? -1 : 1));

  const [slideIdx, setSlideIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = items[slideIdx];
  const isVideo = current?.type === "video";
  const displaySrc = current?.thumbnail_url || (current?.type !== "video" ? current?.file_url : null);
  const postUrl = getPostUrl(athlete);

  const keepControlsVisible = useCallback(() => {
    if (playing && videoRef.current) {
      const rect = videoRef.current.getBoundingClientRect();
      videoRef.current.dispatchEvent(new MouseEvent("mousemove", {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.bottom - 30,
      }));
    }
  }, [playing]);

  const handleDownload = async () => {
    if (!current?.file_url) return;
    try {
      const res = await fetch(current.file_url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${athlete.name.replace(/\s+/g, "-")}-${slideIdx + 1}.${isVideo ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(current.file_url, "_blank");
    }
  };

  return (
    <div
      className="media-card break-inside-avoid mb-2 rounded-lg overflow-hidden bg-black"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={keepControlsVisible}
    >
      <div className="relative overflow-hidden">
        {isVideo && playing ? (
          <video ref={videoRef} src={current.file_url} autoPlay controls playsInline className="w-full block relative z-[1]" onEnded={() => setPlaying(false)} />
        ) : displaySrc ? (
          <img src={displaySrc} className={`w-full block ${isVideo ? "aspect-[9/16] object-cover" : ""}`} draggable={false} alt={athlete.name} loading="lazy" />
        ) : isVideo ? (
          <div className="w-full aspect-[4/5] bg-black flex items-center justify-center" onClick={() => setPlaying(true)}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        ) : (
          <div className="w-full aspect-[4/5] bg-black flex items-center justify-center">
            <span className="text-[10px] text-white/45 font-black uppercase">No media</span>
          </div>
        )}

        {isVideo && !playing && (
          <div onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center cursor-pointer z-[2]">
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
            </div>
          </div>
        )}

        {/* Creator overlay — top of card */}
        <div className="absolute top-0 left-0 right-0 z-[2] px-3 pt-2.5 pb-5 bg-gradient-to-b from-black/85 to-transparent">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black uppercase text-white truncate">{athlete.name}</div>
              <div className="text-[10px] text-white/70 font-semibold flex items-center gap-1.5">
                {athlete.school}
                {athlete.ig_followers ? <span className="text-white/70 inline-flex items-center gap-0.5">&middot; <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>{fmt(athlete.ig_followers)}</span> : null}
                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-brand text-white">{athlete.sport}</span>
              </div>
            </div>
            {/* Download + Link buttons */}
            <div className="flex gap-1 ml-2 flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                className="w-6 h-6 rounded bg-black/50 backdrop-blur flex items-center justify-center hover:bg-brand transition-colors"
                title="Download"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              {postUrl && (
                <a
                  href={postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="w-6 h-6 rounded bg-black/50 backdrop-blur flex items-center justify-center hover:bg-brand transition-colors"
                  title="View Post"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Media type badge — uses actual media type, not CSV post_type */}
        <span className="absolute bottom-2 right-2 z-[3] px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-black/65 text-white backdrop-blur">
          {getMediaLabel(items)}
        </span>

        {/* Carousel arrows */}
        {items.length > 1 && hovered && (
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 z-[20] flex justify-between px-1.5 pointer-events-none">
            <button onClick={(e) => { e.stopPropagation(); setPlaying(false); setSlideIdx((i) => (i <= 0 ? items.length - 1 : i - 1)); }} className="pointer-events-auto w-8 h-8 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center hover:bg-black/90 transition-colors">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); setPlaying(false); setSlideIdx((i) => (i >= items.length - 1 ? 0 : i + 1)); }} className="pointer-events-auto w-8 h-8 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center hover:bg-black/90 transition-colors">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        )}

        {items.length > 1 && !playing && (
          <div className={`absolute bottom-11 left-1/2 -translate-x-1/2 flex gap-1 z-[3] transition-opacity ${hovered ? "opacity-100" : "opacity-0"}`}>
            {items.map((_, i) => (
              <div key={i} onClick={(e) => { e.stopPropagation(); setPlaying(false); setSlideIdx(i); }} className={`w-1.5 h-1.5 rounded-full cursor-pointer ${slideIdx === i ? "bg-white" : "bg-white/35"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Recap Component ──────────────────────────────────────

export function CampaignRecap({
  campaign,
  athletes,
  allAthletes,
  media,
}: {
  campaign: Campaign;
  athletes: Athlete[];
  allAthletes?: Athlete[];
  media: Record<string, Media[]>;
}) {
  const [filter, setFilter] = useState("all");
  const [topPerformerMode, setTopPerformerMode] = useState<"engagement" | "impressions">("engagement");
  const settings = campaign.settings || {};
  const vis: VisibleSections = settings.visible_sections || {};
  const show = (key: keyof VisibleSections) => vis[key] !== false;
  const hiddenCols = new Set(settings.hidden_columns || []);
  const showCol = (key: string) => !hiddenCols.has(key);

  // Full roster for metrics, top performers, roster, hero stats
  // Gallery athletes for Content Gallery only
  const fullRoster = allAthletes || athletes;

  const stats = computeStats(fullRoster);
  const topPerformers = topPerformerMode === "engagement"
    ? getTopPerformers(fullRoster)
    : getTopPerformersByImpressions(fullRoster);
  const cols = settings.columns || 4;

  // Gallery filter uses actual uploaded media types (not CSV post_type)
  // Photo filter: only show athletes that have images, and exclude video items in MasonryCard
  const filtered = athletes.filter((a) => {
    const items = media[a.id] || [];
    if (items.length === 0) return false;
    if (filter === "all") return true;
    if (filter === "photo") return items.some((m) => m.type === "image");
    return items.some((m) => m.type === "video");
  });

  const contentTypes = [
    stats.igFeedPosts > 0 && "IG Feed",
    stats.igReelPosts > 0 && "Reels",
    stats.tiktokPosts > 0 && "TikTok BTS",
  ].filter(Boolean).join(", ");

  // Roster uses full campaign roster, sorted by followers
  const rosterAthletes = [...fullRoster].sort((a, b) => (b.ig_followers || 0) - (a.ig_followers || 0));

  return (
    <div className="recap-container min-h-screen bg-[#111111] text-white font-sans">

      {/* ── POSTGAME TOP BAR ───────────────────────────────── */}
      <div className="px-6 md:px-12 py-3 border-b border-white/[0.12] flex items-center justify-between">
        <PostgameLogo size="sm" className="opacity-60" />
        <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/50">
          Campaign Recap
        </span>
      </div>

      {/* ── SECTION 1: HERO HEADER ─────────────────────────── */}
      <div className="relative px-6 md:px-12 pt-10 md:pt-14 pb-10 md:pb-14 bg-gradient-to-b from-white/[0.08] to-transparent">
        <div className="flex flex-col items-center text-center gap-6">
          {/* Brand logo — big, no container */}
          {settings.brand_logo_url ? (
            <img src={settings.brand_logo_url} className="h-28 md:h-44 object-contain" alt={campaign.client_name} />
          ) : campaign.client_logo_url ? (
            <img src={campaign.client_logo_url} className="h-24 md:h-40 object-contain" alt={campaign.client_name} />
          ) : null}

          <h1 className="text-3xl md:text-5xl font-black uppercase leading-tight">
            {campaign.name}
          </h1>

          {/* Badges row */}
          {(settings.quarter || settings.campaign_type) && (
            <div className="flex items-center gap-3">
              {settings.quarter && (
                <span className="px-3 py-1.5 bg-white/[0.10] border border-white/[0.15] rounded text-xs font-bold uppercase tracking-wider text-white/70">
                  {settings.quarter}
                </span>
              )}
              {settings.campaign_type && (
                <span className="px-3 py-1.5 bg-white/[0.10] border border-white/[0.15] rounded text-xs font-bold uppercase tracking-wider text-white/70">
                  {settings.campaign_type}
                </span>
              )}
            </div>
          )}

          {/* Tag pills */}
          {settings.tags && settings.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {settings.tags.map((tag) => (
                <span key={tag} className="px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider bg-brand text-white">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 2: CAMPAIGN BRIEF ──────────────────────── */}
      {show("brief") && settings.description && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-8">Campaign Brief</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            <div className="text-base md:text-lg text-white/70 leading-relaxed whitespace-pre-line">
              {settings.description}
            </div>
            <div className="space-y-0">
              {[
                { label: "BRAND", value: campaign.client_name },
                { label: "CAMPAIGN", value: campaign.name },
                { label: "QUARTER", value: settings.quarter },
                { label: "TYPE", value: settings.campaign_type },
                { label: "PLATFORM", value: settings.platform },
                { label: "ATHLETES", value: String(stats.athleteCount) },
                { label: "SCHOOLS", value: String(stats.schoolCount) },
                { label: "SPORTS", value: String(stats.sportCount) },
                { label: "TOTAL REACH", value: fmt(stats.totalReach) + "+ Followers" },
                { label: "TOTAL POSTS", value: String(stats.totalPosts) },
                { label: "CONTENT TYPE", value: contentTypes },
              ].filter((r) => r.value).map((row) => (
                <div key={row.label} className="flex items-baseline py-3 border-b border-white/[0.12]">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/70 w-36 flex-shrink-0">{row.label}</span>
                  <span className="text-base font-semibold text-white/90">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KEY TAKEAWAYS ─────────────────────────────────── */}
      {show("key_takeaways") && settings.key_takeaways && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-6">Key Takeaways</h2>
          <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6 md:p-8">
            <div className="text-sm md:text-base text-white/90 leading-relaxed whitespace-pre-line">{settings.key_takeaways}</div>
          </div>
        </div>
      )}

      {/* ── KPI TARGETS ───────────────────────────────────── */}
      {show("kpi_targets") && settings.kpi_targets && (() => {
        const t = settings.kpi_targets;
        const hasAnyTarget = t.athlete_quantity || t.content_units || t.posts || t.impressions || t.engagements || t.engagement_rate || t.cpm || t.other_kpis;
        if (!hasAnyTarget) return null;

        const avgCpm = stats.hasClicks && stats.clicks.cpm_count > 0 ? stats.clicks.cpm_sum / stats.clicks.cpm_count : 0;

        const kpiRows = [
          t.athlete_quantity != null ? { label: "Athletes", target: t.athlete_quantity, actual: stats.athleteCount } : null,
          t.content_units != null ? { label: "Content Units", target: t.content_units, actual: null } : null,
          t.posts != null ? { label: "Posts", target: t.posts, actual: stats.totalPosts } : null,
          t.impressions != null ? { label: "Impressions", target: t.impressions, actual: stats.totalImpressions } : null,
          t.engagements != null ? { label: "Engagements", target: t.engagements, actual: stats.totalEngagements } : null,
          t.engagement_rate != null ? { label: "Engagement Rate", target: t.engagement_rate, actual: stats.avgEngRate, isPercent: true } : null,
          t.cpm != null ? { label: "CPM", target: t.cpm, actual: avgCpm, isDollar: true } : null,
        ].filter(Boolean) as { label: string; target: number; actual: number | null; isPercent?: boolean; isDollar?: boolean }[];

        return (
          <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-8">Campaign KPI Targets</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpiRows.map((row) => {
                const pctOfGoal = row.actual != null && row.target > 0 ? (row.actual / row.target) * 100 : null;
                const color = pctOfGoal == null ? "text-gray-400" : pctOfGoal >= 100 ? "text-emerald-400" : pctOfGoal >= 80 ? "text-amber-400" : "text-red-400";
                const formatVal = (n: number | null) => {
                  if (n == null) return "\u2014";
                  if (row.isPercent) return pct(n);
                  if (row.isDollar) return dollar(n);
                  return fmt(n);
                };

                return (
                  <div key={row.label} className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-4 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">{row.label}</div>
                    <div className="text-xs text-white/60 mb-1">Target: <span className="text-white/80 font-bold">{formatVal(row.target)}</span></div>
                    <div className={`text-2xl font-black ${color}`}>{formatVal(row.actual)}</div>
                    {pctOfGoal != null && (
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
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-8">Campaign Metrics</h2>

          {/* Summary row */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { value: stats.athleteCount, label: "ATHLETES" },
              { value: stats.totalPosts, label: "TOTAL POSTS" },
              { value: fmt(stats.totalImpressions), label: "TOTAL IMPRESSIONS" },
              { value: fmt(stats.totalEngagements), label: "TOTAL ENGAGEMENTS" },
              { value: pct(stats.avgEngRate), label: "AVG ENGAGEMENT RATE" },
              ...(stats.hasSales ? [{ value: dollar(stats.sales.revenue), label: "TOTAL SALES" }] : []),
            ].map((m) => (
              <div key={m.label} className="bg-white/[0.07] border border-white/[0.15] rounded-xl p-5 md:p-8 text-center flex-1 min-w-[140px] max-w-[220px]">
                <div className="text-2xl md:text-4xl font-black text-white mb-2">{m.value}</div>
                <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/70">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Per-platform breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.igFeedPosts > 0 && (
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5"/></svg>IG Feed</h3>
                  <span className="text-xs font-bold text-brand">{stats.igFeedPosts} posts</span>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Reach", value: fmt(stats.igFeed.reach), raw: stats.igFeed.reach },
                    { label: "Impressions", value: fmt(stats.igFeed.impressions), raw: stats.igFeed.impressions },
                    { label: "Likes", value: fmt(stats.igFeed.likes), raw: stats.igFeed.likes },
                    { label: "Comments", value: fmt(stats.igFeed.comments), raw: stats.igFeed.comments },
                    { label: "Shares", value: fmt(stats.igFeed.shares), raw: stats.igFeed.shares },
                    { label: "Reposts", value: fmt(stats.igFeed.reposts), raw: stats.igFeed.reposts },
                    { label: "Total Engagements", value: fmt(stats.igFeed.engagements), raw: stats.igFeed.engagements },
                    { label: "Avg Engagement Rate", value: stats.igFeed.engRateCount > 0 ? pct(stats.igFeed.engRateSum / stats.igFeed.engRateCount) : "\u2014", raw: stats.igFeed.engRateCount },
                  ].filter((row) => row.raw > 0).map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.igReelPosts > 0 && (
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="8" y1="2" x2="12" y2="8"/><line x1="16" y1="2" x2="12" y2="8"/><polygon points="10,12 10,18 16,15" fill="currentColor" stroke="none"/></svg>IG Reels</h3>
                  <span className="text-xs font-bold text-brand">{stats.igReelPosts} posts</span>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Views", value: fmt(stats.igReel.views), raw: stats.igReel.views },
                    { label: "Likes", value: fmt(stats.igReel.likes), raw: stats.igReel.likes },
                    { label: "Comments", value: fmt(stats.igReel.comments), raw: stats.igReel.comments },
                    { label: "Shares", value: fmt(stats.igReel.shares), raw: stats.igReel.shares },
                    { label: "Reposts", value: fmt(stats.igReel.reposts), raw: stats.igReel.reposts },
                    { label: "Total Engagements", value: fmt(stats.igReel.engagements), raw: stats.igReel.engagements },
                    { label: "Avg Engagement Rate", value: stats.igReel.engRateCount > 0 ? pct(stats.igReel.engRateSum / stats.igReel.engRateCount) : "\u2014", raw: stats.igReel.engRateCount },
                  ].filter((row) => row.raw > 0).map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.tiktokPosts > 0 && (
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.89 2.89 2.89 0 0 1 2.88-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.77a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.18z"/></svg>TikTok</h3>
                  <span className="text-xs font-bold text-brand">{stats.tiktokPosts} posts</span>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Views", value: fmt(stats.tiktok.views), raw: stats.tiktok.views },
                    { label: "Likes", value: fmt(stats.tiktok.likes), raw: stats.tiktok.likes },
                    { label: "Comments", value: fmt(stats.tiktok.comments), raw: stats.tiktok.comments },
                    { label: "Likes + Comments", value: fmt(stats.tiktok.likes_comments), raw: stats.tiktok.likes > 0 ? 0 : stats.tiktok.likes_comments },
                    { label: "Saves + Shares", value: fmt(stats.tiktok.saves_shares), raw: stats.tiktok.saves_shares },
                    { label: "Total Engagements", value: fmt(stats.tiktok.engagements), raw: stats.tiktok.engagements },
                    { label: "Avg Engagement Rate", value: stats.tiktok.engRateCount > 0 ? pct(stats.tiktok.engRateSum / stats.tiktok.engRateCount) : "\u2014", raw: stats.tiktok.engRateCount },
                  ].filter((row) => row.raw > 0).map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(stats.igStory.count > 0 || stats.igStory.impressions > 0) && (
              <div className="bg-white/[0.06] border border-white/[0.15] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/></svg>IG Stories</h3>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Story Count", value: fmt(stats.igStory.count) },
                    { label: "Impressions", value: fmt(stats.igStory.impressions) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.10] last:border-0">
                      <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                      <span className="text-base font-bold text-white/90">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sales breakdown */}
          {stats.hasSales && (
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
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
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
            {topPerformers.map((a, i) => {
              const items = media[a.id] || [];
              const isFirst = i === 0;
              const metricValue = topPerformerMode === "engagement" ? pct(a.bestEngRate) : fmt(a.totalImpressions);
              const metricLabel = topPerformerMode === "engagement" ? "Engagement Rate" : "Impressions";
              return (
                <div key={a.id} className="flex-1 max-w-[280px]">
                  {/* Number above image */}
                  <div className="text-center mb-2">
                    <div className="text-2xl font-black text-brand">{metricValue}</div>
                    <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">{metricLabel}</div>
                  </div>
                  <div className={`relative rounded-xl overflow-hidden h-[380px] ${isFirst ? "border-2 border-brand shadow-[0_0_25px_rgba(215,63,9,0.3)]" : "border border-white/[0.12]"}`}>
                    {items.length > 0 ? (
                      <TopPerformerMedia items={items} name={a.name} />
                    ) : (
                      <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
                        <span className="text-xs text-white/35 font-bold uppercase">No content</span>
                      </div>
                    )}
                    {/* Rank badge */}
                    <div className={`absolute top-3 left-3 w-9 h-9 rounded-full text-white text-base font-black flex items-center justify-center z-10 ${isFirst ? "bg-brand" : "bg-white/20 backdrop-blur"}`}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="mt-3 px-1 text-center">
                    <div className="text-base font-black uppercase truncate">{a.name}</div>
                    <div className="text-xs text-white/70">{a.school} &middot; {a.sport}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: #1 full-width + orange highlight, rest 2-col */}
          <div className="md:hidden grid grid-cols-2 gap-3">
            {topPerformers.map((a, i) => {
              const items = media[a.id] || [];
              const isFirst = i === 0;
              const metricValue = topPerformerMode === "engagement" ? pct(a.bestEngRate) : fmt(a.totalImpressions);
              const metricLabel = topPerformerMode === "engagement" ? "Engagement Rate" : "Impressions";
              return (
                <div key={a.id} className={isFirst ? "col-span-2" : ""}>
                  {/* Number above image */}
                  <div className="text-center mb-1.5">
                    <div className={`${isFirst ? "text-xl" : "text-lg"} font-black text-brand`}>{metricValue}</div>
                    <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider">{metricLabel}</div>
                  </div>
                  <div className={`relative rounded-xl overflow-hidden ${isFirst ? "h-[280px] border-2 border-brand shadow-[0_0_20px_rgba(215,63,9,0.3)]" : "h-[220px] border border-white/[0.12]"}`}>
                    {items.length > 0 ? (
                      <TopPerformerMedia items={items} name={a.name} />
                    ) : (
                      <div className="absolute inset-0 bg-[#1a1a1a] flex items-center justify-center">
                        <span className="text-xs text-white/35 font-bold uppercase">No content</span>
                      </div>
                    )}
                    <div className={`absolute top-2.5 left-2.5 w-8 h-8 rounded-full text-white text-sm font-black flex items-center justify-center z-10 ${isFirst ? "bg-brand" : "bg-white/20 backdrop-blur"}`}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="mt-2.5 px-1 text-center">
                    <div className="text-sm font-black uppercase truncate">{a.name}</div>
                    <div className="text-xs text-white/70">{a.school}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 6: CONTENT GALLERY ─────────────────────── */}
      {show("content_gallery") && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 mb-6">
            <h2 className="text-xl md:text-2xl font-black uppercase">Content Gallery</h2>
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
          <div data-masonry style={{ columnCount: cols, columnGap: 8 }} className="bg-[#0a0a0a] border border-white/[0.15] rounded-xl p-2">
            {filtered.map((a) => (
              <MasonryCard key={a.id} athlete={a} items={media[a.id] || []} activeFilter={filter} />
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 7: CAMPAIGN ROSTER ─────────────────────── */}
      {show("roster") && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/[0.15]">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide mb-8">Campaign Roster</h2>

          {/* Desktop: full table with headers */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.15]">
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 w-10">#</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Athlete</th>
                  {showCol("school") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">School</th>}
                  {showCol("sport") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">Sport</th>}
                  {showCol("ig_handle") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50">IG Handle</th>}
                  {showCol("ig_followers") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Followers</th>}
                  {showCol("ig_feed_impressions") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Impressions</th>}
                  {showCol("ig_feed_total") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Engagements</th>}
                  {showCol("ig_feed_rate") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Eng. Rate</th>}
                  {stats.hasClicks && showCol("clicks_link_clicks") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Clicks</th>}
                  {stats.hasClicks && showCol("clicks_orders") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Orders</th>}
                  {stats.hasClicks && showCol("clicks_sales") && <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-right">Sales</th>}
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-center">Post</th>
                  <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-white/50 text-center">Reel</th>
                </tr>
              </thead>
              <tbody>
                {rosterAthletes.map((a, i) => {
                  const m = a.metrics || {};
                  const feedUrl = m.ig_feed?.post_url || null;
                  const reelUrl = m.ig_reel?.post_url || null;
                  return (
                  <tr key={a.id} className="border-b border-white/[0.10] hover:bg-white/[0.04]">
                    <td className="px-3 py-3 text-sm font-black text-white/45">{i + 1}</td>
                    <td className="px-3 py-3 text-sm font-black uppercase">{a.name}</td>
                    {showCol("school") && <td className="px-3 py-3 text-sm text-white/70">{a.school}</td>}
                    {showCol("sport") && <td className="px-3 py-3">
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-brand/15 text-brand">
                        {a.sport}
                      </span>
                    </td>}
                    {showCol("ig_handle") && <td className="px-3 py-3 text-sm">{a.ig_handle ? (
                      <a href={`https://instagram.com/${a.ig_handle}`} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-brand transition-colors inline-flex items-center gap-1">@{a.ig_handle}<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></a>
                    ) : "\u2014"}</td>}
                    {showCol("ig_followers") && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</td>}
                    {showCol("ig_feed_impressions") && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{fmt(getTotalImpressions(a))}</td>}
                    {showCol("ig_feed_total") && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{fmt(getTotalEngagements(a))}</td>}
                    {showCol("ig_feed_rate") && <td className="px-3 py-3 text-sm font-bold text-brand text-right">{getBestEngRate(a) > 0 ? pct(getBestEngRate(a)) : "\u2014"}</td>}
                    {stats.hasClicks && showCol("clicks_link_clicks") && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{m.clicks?.link_clicks ? fmt(m.clicks.link_clicks) : "\u2014"}</td>}
                    {stats.hasClicks && showCol("clicks_orders") && <td className="px-3 py-3 text-sm font-bold text-white/70 text-right">{m.clicks?.orders ? fmt(m.clicks.orders) : "\u2014"}</td>}
                    {stats.hasClicks && showCol("clicks_sales") && <td className="px-3 py-3 text-sm font-bold text-emerald-400 text-right">{m.clicks?.sales ? dollar(m.clicks.sales) : "\u2014"}</td>}
                    <td className="px-3 py-3 text-center">
                      {feedUrl ? (
                        <a href={feedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand/15 text-brand hover:bg-brand/30 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                      ) : (
                        <span className="text-white/35">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {reelUrl ? (
                        <a href={reelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                        </a>
                      ) : (
                        <span className="text-white/35">&mdash;</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: compact cards */}
          <div className="md:hidden space-y-1">
            {rosterAthletes.map((a, i) => {
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
                  {showCol("ig_followers") && <div className="text-sm font-bold text-white/70">{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</div>}
                  {showCol("ig_feed_rate") && getBestEngRate(a) > 0 && (
                    <div className="text-xs font-bold text-brand">{pct(getBestEngRate(a))}</div>
                  )}
                  {stats.hasClicks && (
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
                <div className="flex gap-1.5 flex-shrink-0">
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
      )}

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
    </div>
  );
}
