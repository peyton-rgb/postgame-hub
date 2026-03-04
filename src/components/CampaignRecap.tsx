"use client";

import { useState, useRef, useCallback } from "react";
import type { Campaign, Athlete, Media, VisibleSections } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number | undefined): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

function pct(n: number | undefined): string {
  if (n == null) return "0%";
  return n.toFixed(2) + "%";
}

function computeStats(athletes: Athlete[]) {
  const schools = new Set(athletes.map((a) => a.school));
  const sports = new Set(athletes.map((a) => a.sport));

  let totalPosts = 0;
  let totalImpressions = 0;
  let totalEngagements = 0;
  let totalEngRateSum = 0;
  let engRateCount = 0;
  let igFeedPosts = 0;
  let igReelPosts = 0;
  let tiktokPosts = 0;
  let totalReach = 0;

  for (const a of athletes) {
    const m = a.metrics || {};
    if (m.ig_feed?.post_url) {
      igFeedPosts++;
      totalPosts++;
    }
    if (m.ig_reel?.post_url) {
      igReelPosts++;
      totalPosts++;
    }
    if (m.tiktok?.post_url) {
      tiktokPosts++;
      totalPosts++;
    }

    totalImpressions += (m.ig_feed?.impressions || 0) + (m.ig_story?.impressions || 0) + (m.ig_reel?.views || 0) + (m.tiktok?.views || 0);
    totalEngagements += (m.ig_feed?.total_engagements || 0) + (m.ig_reel?.total_engagements || 0) + (m.tiktok?.total_engagements || 0);
    totalReach += (m.ig_feed?.reach || 0) + (a.ig_followers || 0);

    const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
    if (rates.length > 0) {
      totalEngRateSum += rates.reduce((s, r) => s + r, 0) / rates.length;
      engRateCount++;
    }
  }

  const avgEngRate = engRateCount > 0 ? totalEngRateSum / engRateCount : 0;

  return {
    athleteCount: athletes.length,
    schoolCount: schools.size,
    sportCount: sports.size,
    totalPosts,
    totalImpressions,
    totalEngagements,
    avgEngRate,
    igFeedPosts,
    igReelPosts,
    tiktokPosts,
    totalReach,
  };
}

function getTopPerformers(athletes: Athlete[], count = 5) {
  return [...athletes]
    .map((a) => {
      const m = a.metrics || {};
      const rates = [m.ig_feed?.engagement_rate, m.ig_reel?.engagement_rate, m.tiktok?.engagement_rate].filter((r): r is number => r != null && r > 0);
      const best = rates.length > 0 ? Math.max(...rates) : 0;
      return { ...a, bestEngRate: best };
    })
    .filter((a) => a.bestEngRate > 0)
    .sort((a, b) => b.bestEngRate - a.bestEngRate)
    .slice(0, count);
}

// ── Masonry Card (v2 — overlay at top) ───────────────────────

function MasonryCard({ athlete, items }: { athlete: Athlete; items: Media[] }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const current = items[slideIdx];
  const isVideo = current?.type === "video";
  const displaySrc = current?.thumbnail_url || (current?.type !== "video" ? current?.file_url : null);

  // Forward mousemove to video element so browser keeps native controls visible
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
          <img src={displaySrc} className="w-full block" draggable={false} alt={athlete.name} />
        ) : isVideo ? (
          <div className="w-full aspect-[4/5] bg-black flex items-center justify-center" onClick={() => setPlaying(true)}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        ) : (
          <div className="w-full aspect-[4/5] bg-black flex items-center justify-center">
            <span className="text-[10px] text-white/30 font-black uppercase">No media</span>
          </div>
        )}

        {isVideo && !playing && (
          <div onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center cursor-pointer z-[2]">
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
            </div>
          </div>
        )}

        {/* Creator overlay — top of card so it never blocks video controls */}
        <div className="absolute top-0 left-0 right-0 z-[2] px-3 pt-2.5 pb-5 bg-gradient-to-b from-black/85 to-transparent">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase text-white truncate">{athlete.name}</div>
            <div className="text-[9px] text-white/55 font-semibold flex items-center gap-1.5">
              {athlete.school}
              {athlete.ig_followers ? <span className="text-white/40">· {fmt(athlete.ig_followers)}</span> : null}
              <span className="px-1 py-px rounded text-[7px] font-bold uppercase bg-brand text-white">{athlete.sport}</span>
            </div>
          </div>
        </div>

        {/* Type badge — bottom-right so it doesn't overlap the top overlay */}
        <span className="absolute bottom-2 right-2 z-[3] px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-black/65 text-white backdrop-blur">
          {athlete.post_type}
        </span>

        {/* Carousel arrows — visible on hover, work during video playback */}
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

        {/* Dot indicators — hidden during video playback so they don't block controls */}
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
  media,
}: {
  campaign: Campaign;
  athletes: Athlete[];
  media: Record<string, Media[]>;
}) {
  const [filter, setFilter] = useState("all");
  const settings = campaign.settings || {};
  const vis: VisibleSections = settings.visible_sections || {};
  const show = (key: keyof VisibleSections) => vis[key] !== false;

  const stats = computeStats(athletes);
  const topPerformers = getTopPerformers(athletes);
  const cols = settings.columns || 4;

  const filtered = athletes.filter((a) => {
    if (filter === "all") return true;
    if (filter === "photo") return a.post_type !== "IG Reel";
    return a.post_type === "IG Reel";
  });

  const contentTypes = [
    stats.igFeedPosts > 0 && "IG Feed",
    stats.igReelPosts > 0 && "Reels",
    stats.tiktokPosts > 0 && "TikTok BTS",
  ].filter(Boolean).join(", ");

  const rosterAthletes = [...athletes].sort((a, b) => (b.ig_followers || 0) - (a.ig_followers || 0));

  return (
    <div className="recap-container min-h-screen bg-black text-white font-sans">

      {/* ── POSTGAME TOP BAR ───────────────────────────────── */}
      <div className="px-6 md:px-12 py-3 border-b border-white/5 flex items-center justify-between">
        <span className="text-[11px] md:text-xs font-black uppercase tracking-[3px] text-white/40">
          POSTGAME
        </span>
        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/20">
          Campaign Recap
        </span>
      </div>

      {/* ── SECTION 1: HERO HEADER ─────────────────────────── */}
      <div className="relative px-6 md:px-12 pt-8 md:pt-10 pb-8 md:pb-10 bg-gradient-to-b from-white/[0.04] to-black">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            {/* Brand logo + badges */}
            <div className="flex items-center gap-3 mb-4">
              {settings.brand_logo_url && (
                <img src={settings.brand_logo_url} className="h-8 md:h-14 object-contain" alt={campaign.client_name} />
              )}
              {!settings.brand_logo_url && campaign.client_logo_url && (
                <img src={campaign.client_logo_url} className="h-6 md:h-10 object-contain" alt={campaign.client_name} />
              )}
              {settings.quarter && (
                <span className="px-2.5 py-1.5 bg-white/[0.06] border border-white/10 rounded text-[10px] font-bold uppercase tracking-wider text-white/60">
                  {settings.quarter}
                </span>
              )}
              {settings.campaign_type && (
                <span className="px-2.5 py-1.5 bg-white/[0.06] border border-white/10 rounded text-[10px] font-bold uppercase tracking-wider text-white/60">
                  {settings.campaign_type}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-4xl font-black uppercase leading-tight mb-3">
              {campaign.name}
            </h1>

            {settings.description && (
              <p className="text-sm md:text-base text-white/50 max-w-lg leading-relaxed mb-4">
                {settings.description.slice(0, 200)}
                {(settings.description?.length || 0) > 200 ? "..." : ""}
              </p>
            )}

            {/* Tag pills */}
            {settings.tags && settings.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {settings.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand text-white">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px bg-white/10 rounded-lg overflow-hidden flex-shrink-0">
            {[
              { value: stats.athleteCount, label: "ATHLETES" },
              { value: stats.schoolCount, label: "SCHOOLS" },
              { value: stats.sportCount, label: "SPORTS" },
              { value: settings.quarter || "—", label: "YEAR" },
            ].map((s) => (
              <div key={s.label} className="bg-black px-4 md:px-6 py-3 md:py-4 text-center min-w-[80px]">
                <div className="text-lg md:text-xl font-black text-brand">{s.value}</div>
                <div className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-white/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: CAMPAIGN BRIEF ──────────────────────── */}
      {show("brief") && settings.description && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/10">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wide mb-8">Campaign Brief</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            <div className="text-sm md:text-base text-white/50 leading-relaxed whitespace-pre-line">
              {settings.description}
            </div>
            <div className="space-y-0">
              {[
                { label: "BRAND", value: campaign.client_name },
                { label: "CAMPAIGN", value: `${campaign.name}` },
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
                <div key={row.label} className="flex items-baseline py-2.5 border-b border-white/[0.06]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 w-32 flex-shrink-0">{row.label}</span>
                  <span className="text-sm font-semibold text-white/70">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION 3: CAMPAIGN METRICS ────────────────────── */}
      {show("metrics") && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/10">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wide mb-8">Campaign Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { value: stats.totalPosts, label: "TOTAL POSTS", format: false },
              { value: stats.totalImpressions, label: "TOTAL IMPRESSIONS", format: true },
              { value: stats.totalEngagements, label: "TOTAL ENGAGEMENTS", format: true },
              { value: stats.avgEngRate, label: "AVG ENGAGEMENT RATE", format: false, isPct: true },
            ].map((m) => (
              <div key={m.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 md:p-6 text-center">
                <div className="text-xl md:text-3xl font-black text-white mb-2">
                  {m.isPct ? pct(m.value) : m.format ? fmt(m.value) : m.value}
                </div>
                <div className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-white/40">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 4: PLATFORM BREAKDOWN ──────────────────── */}
      {show("platform_breakdown") && (
        <div className="px-6 md:px-12 py-8 border-t border-white/10">
          <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Platform Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "IG FEED", value: stats.igFeedPosts, suffix: "POSTS" },
              { label: "IG REELS/BTS", value: stats.igReelPosts, suffix: "POSTS" },
              { label: "TIKTOK", value: stats.tiktokPosts > 0 ? stats.tiktokPosts : null, suffix: stats.tiktokPosts > 0 ? "POSTS" : "DATA TRACKED" },
            ].map((p) => (
              <div key={p.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 md:p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">{p.label}</div>
                <div className="text-xl md:text-2xl font-black">{p.value ?? "Data"}</div>
                <div className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-white/30 mt-1">{p.suffix}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 5: TOP PERFORMERS (Podium with media cards) ── */}
      {show("top_performers") && topPerformers.length > 0 && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/10">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wide mb-8">Top Performers by Engagement Rate</h2>

          {/* Desktop: side-by-side with #1 elevated */}
          <div className="hidden md:flex items-end justify-center gap-3">
            {topPerformers.map((a, i) => {
              const items = media[a.id] || [];
              const thumb = items[0]?.thumbnail_url || (items[0]?.type !== "video" ? items[0]?.file_url : null);
              const isFirst = i === 0;
              return (
                <div
                  key={a.id}
                  className={`relative rounded-xl overflow-hidden border border-white/10 flex-1 max-w-[220px] transition-all ${
                    isFirst ? "h-[340px]" : "h-[280px]"
                  }`}
                >
                  {thumb ? (
                    <img src={thumb} className="absolute inset-0 w-full h-full object-cover" alt={a.name} />
                  ) : (
                    <div className="absolute inset-0 bg-black" />
                  )}
                  {/* Rank badge */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-brand text-white text-sm font-black flex items-center justify-center z-10">
                    {i + 1}
                  </div>
                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-10">
                    <div className="text-sm font-black uppercase truncate">{a.name}</div>
                    <div className="text-[10px] text-white/50 mb-1">{a.school} &middot; {a.sport}</div>
                    <div className="text-lg font-black text-brand">{pct(a.bestEngRate)}</div>
                    <div className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Engagement Rate</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: #1 full-width, rest in 2-col grid */}
          <div className="md:hidden grid grid-cols-2 gap-2">
            {topPerformers.map((a, i) => {
              const items = media[a.id] || [];
              const thumb = items[0]?.thumbnail_url || (items[0]?.type !== "video" ? items[0]?.file_url : null);
              const isFirst = i === 0;
              return (
                <div
                  key={a.id}
                  className={`relative rounded-xl overflow-hidden border border-white/10 ${
                    isFirst ? "col-span-2 h-[260px]" : "h-[200px]"
                  }`}
                >
                  {thumb ? (
                    <img src={thumb} className="absolute inset-0 w-full h-full object-cover" alt={a.name} />
                  ) : (
                    <div className="absolute inset-0 bg-black" />
                  )}
                  <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-brand text-white text-xs font-black flex items-center justify-center z-10">
                    {i + 1}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent z-10">
                    <div className="text-xs font-black uppercase truncate">{a.name}</div>
                    <div className="text-[10px] text-white/50">{a.school}</div>
                    <div className="text-base font-black text-brand">{pct(a.bestEngRate)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 6: CONTENT GALLERY ─────────────────────── */}
      {show("content_gallery") && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
              <h2 className="text-lg md:text-xl font-black uppercase">Content Gallery</h2>
              <div className="flex gap-2">
                {["all", "photo", "video"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase ${
                      filter === f ? "bg-brand text-white" : "border border-white/15 text-white/40"
                    }`}
                  >
                    {f === "all" ? "All" : f === "photo" ? "Photos" : "Videos"}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[10px] md:text-xs text-white/30 font-semibold">
              {filtered.length} athletes · Feed, Reels & BTS
            </span>
          </div>
          <div data-masonry style={{ columnCount: cols, columnGap: 8 }} className="bg-black border border-white/10 rounded-xl p-2">
            {filtered.map((a) => (
              <MasonryCard key={a.id} athlete={a} items={media[a.id] || []} />
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 7: CAMPAIGN ROSTER ─────────────────────── */}
      {show("roster") && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/10">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wide mb-8">Campaign Roster</h2>
          <div className="space-y-1">
            {rosterAthletes.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 md:gap-4 py-3 px-3 md:px-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <span className="text-sm font-black text-white/30 w-6 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black uppercase">{a.name}</div>
                  <div className="text-[10px] text-white/40">{a.school}</div>
                </div>
                <span className="hidden md:inline px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-brand/15 text-brand">
                  {a.sport}
                </span>
                <span className="text-sm font-bold text-white/50 w-16 text-right">
                  {a.ig_followers ? fmt(a.ig_followers) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <div className="recap-footer-area px-6 md:px-12 py-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-[2px] text-white/30">
              POSTGAME
            </span>
          </div>
          <div className="flex items-center gap-3">
            {settings.brand_logo_url && (
              <img src={settings.brand_logo_url} className="h-5 object-contain opacity-50" alt="" />
            )}
            <span className="text-white/30">
              &copy; {new Date().getFullYear()} {campaign.client_name}
            </span>
          </div>
        </div>
        <div className="text-center mt-4">
          <span className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
            Powered by Postgame
          </span>
        </div>
      </div>
    </div>
  );
}
