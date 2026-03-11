"use client";

import { useState, useRef, useCallback } from "react";
import type { Campaign, Athlete, Media, VisibleSections } from "@/lib/types";
import { fmt, pct, computeStats, getTopPerformers, getPostUrl, getMediaLabel, getBestEngRate, getTotalImpressions, getTotalEngagements } from "@/lib/recap-helpers";
import { PostgameLogo } from "./PostgameLogo";
import { TopPerformerMedia } from "./TopPerformerMedia";

// ── Masonry Card ─────────────────────────────────────────────

function MasonryCard({ athlete, items: rawItems }: { athlete: Athlete; items: Media[] }) {
  const items = [...rawItems].sort((a, b) => (a.type === "video" ? -1 : 1) - (b.type === "video" ? -1 : 1));

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
          <img src={displaySrc} className={`w-full block ${isVideo ? "aspect-[9/16] object-cover" : ""}`} draggable={false} alt={athlete.name} />
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

        {/* Creator overlay — top of card */}
        <div className="absolute top-0 left-0 right-0 z-[2] px-3 pt-2.5 pb-5 bg-gradient-to-b from-black/85 to-transparent">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase text-white truncate">{athlete.name}</div>
              <div className="text-[9px] text-white/55 font-semibold flex items-center gap-1.5">
                {athlete.school}
                {athlete.ig_followers ? <span className="text-white/40">&middot; {fmt(athlete.ig_followers)}</span> : null}
                <span className="px-1 py-px rounded text-[7px] font-bold uppercase bg-brand text-white">{athlete.sport}</span>
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
        <span className="absolute bottom-2 right-2 z-[3] px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-black/65 text-white backdrop-blur">
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
  const settings = campaign.settings || {};
  const vis: VisibleSections = settings.visible_sections || {};
  const show = (key: keyof VisibleSections) => vis[key] !== false;

  // Full roster for metrics, top performers, roster, hero stats
  // Gallery athletes for Content Gallery only
  const fullRoster = allAthletes || athletes;

  const stats = computeStats(fullRoster);
  const topPerformers = getTopPerformers(fullRoster);
  const cols = settings.columns || 4;

  // Gallery filter uses actual uploaded media types (not CSV post_type)
  const filtered = athletes.filter((a) => {
    const items = media[a.id] || [];
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
    <div className="recap-container min-h-screen bg-black text-white font-sans">

      {/* ── POSTGAME TOP BAR ───────────────────────────────── */}
      <div className="px-6 md:px-12 py-3 border-b border-white/5 flex items-center justify-between">
        <PostgameLogo size="sm" className="opacity-50" />
        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-white/20">
          Campaign Recap
        </span>
      </div>

      {/* ── SECTION 1: HERO HEADER ─────────────────────────── */}
      <div className="relative px-6 md:px-12 pt-8 md:pt-10 pb-8 md:pb-10 bg-gradient-to-b from-white/[0.04] to-black">
        <div className="flex flex-col gap-6">
          {/* Brand logo box */}
          {settings.brand_logo_url ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 md:p-6 inline-flex items-center justify-center self-start">
              <img src={settings.brand_logo_url} className="h-12 md:h-20 object-contain" alt={campaign.client_name} />
            </div>
          ) : campaign.client_logo_url ? (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 md:p-6 inline-flex items-center justify-center self-start">
              <img src={campaign.client_logo_url} className="h-10 md:h-16 object-contain" alt={campaign.client_name} />
            </div>
          ) : (
            <div className="bg-white/[0.03] border-2 border-dashed border-white/10 rounded-xl p-5 md:p-6 inline-flex items-center justify-center self-start">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/20">Brand Logo</span>
            </div>
          )}

          {/* Badges row */}
          {(settings.quarter || settings.campaign_type) && (
            <div className="flex items-center gap-3">
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
          )}

          <h1 className="text-2xl md:text-4xl font-black uppercase leading-tight">
            {campaign.name}
          </h1>

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

          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {[
              { value: stats.totalPosts, label: "TOTAL POSTS" },
              { value: fmt(stats.totalImpressions), label: "TOTAL IMPRESSIONS" },
              { value: fmt(stats.totalEngagements), label: "TOTAL ENGAGEMENTS" },
              { value: pct(stats.avgEngRate), label: "AVG ENGAGEMENT RATE" },
            ].map((m) => (
              <div key={m.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4 md:p-6 text-center">
                <div className="text-xl md:text-3xl font-black text-white mb-2">{m.value}</div>
                <div className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest text-white/40">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Per-platform breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.igFeedPosts > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider">IG Feed</h3>
                  <span className="text-[10px] font-bold text-brand">{stats.igFeedPosts} posts</span>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Reach", value: fmt(stats.igFeed.reach) },
                    { label: "Impressions", value: fmt(stats.igFeed.impressions) },
                    { label: "Likes", value: fmt(stats.igFeed.likes) },
                    { label: "Comments", value: fmt(stats.igFeed.comments) },
                    { label: "Total Engagements", value: fmt(stats.igFeed.engagements) },
                    { label: "Avg Engagement Rate", value: stats.igFeed.engRateCount > 0 ? pct(stats.igFeed.engRateSum / stats.igFeed.engRateCount) : "\u2014" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                      <span className="text-[10px] text-white/40 font-semibold">{row.label}</span>
                      <span className="text-sm font-bold text-white/80">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.igReelPosts > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider">IG Reels / BTS</h3>
                  <span className="text-[10px] font-bold text-brand">{stats.igReelPosts} posts</span>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Views", value: fmt(stats.igReel.views) },
                    { label: "Likes", value: fmt(stats.igReel.likes) },
                    { label: "Comments", value: fmt(stats.igReel.comments) },
                    { label: "Total Engagements", value: fmt(stats.igReel.engagements) },
                    { label: "Avg Engagement Rate", value: stats.igReel.engRateCount > 0 ? pct(stats.igReel.engRateSum / stats.igReel.engRateCount) : "\u2014" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                      <span className="text-[10px] text-white/40 font-semibold">{row.label}</span>
                      <span className="text-sm font-bold text-white/80">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.tiktokPosts > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider">TikTok</h3>
                  <span className="text-[10px] font-bold text-brand">{stats.tiktokPosts} posts</span>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Views", value: fmt(stats.tiktok.views) },
                    { label: "Likes + Comments", value: fmt(stats.tiktok.likes_comments) },
                    { label: "Saves + Shares", value: fmt(stats.tiktok.saves_shares) },
                    { label: "Total Engagements", value: fmt(stats.tiktok.engagements) },
                    { label: "Avg Engagement Rate", value: stats.tiktok.engRateCount > 0 ? pct(stats.tiktok.engRateSum / stats.tiktok.engRateCount) : "\u2014" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                      <span className="text-[10px] text-white/40 font-semibold">{row.label}</span>
                      <span className="text-sm font-bold text-white/80">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(stats.igStory.count > 0 || stats.igStory.impressions > 0) && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase tracking-wider">IG Stories</h3>
                </div>
                <div className="space-y-0">
                  {[
                    { label: "Story Count", value: fmt(stats.igStory.count) },
                    { label: "Impressions", value: fmt(stats.igStory.impressions) },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                      <span className="text-[10px] text-white/40 font-semibold">{row.label}</span>
                      <span className="text-sm font-bold text-white/80">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION 5: TOP PERFORMERS ─────────────────────── */}
      {show("top_performers") && topPerformers.length > 0 && (
        <div className="px-6 md:px-12 py-10 md:py-12 border-t border-white/10">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wide mb-8">Top Performers by Engagement Rate</h2>

          {/* Desktop: all same size, #1 highlighted in orange */}
          <div className="hidden md:flex items-end justify-center gap-3">
            {topPerformers.map((a, i) => {
              const items = media[a.id] || [];
              const isFirst = i === 0;
              return (
                <div key={a.id} className="flex-1 max-w-[220px]">
                  <div className={`relative rounded-xl overflow-hidden h-[300px] ${isFirst ? "border-2 border-brand shadow-[0_0_20px_rgba(215,63,9,0.3)]" : "border border-white/10"}`}>
                    {items.length > 0 ? (
                      <TopPerformerMedia items={items} name={a.name} />
                    ) : (
                      <div className="absolute inset-0 bg-black flex items-center justify-center">
                        <span className="text-[10px] text-white/20 font-bold uppercase">No content</span>
                      </div>
                    )}
                    {/* Rank badge */}
                    <div className={`absolute top-3 left-3 w-8 h-8 rounded-full text-white text-sm font-black flex items-center justify-center z-10 ${isFirst ? "bg-brand" : "bg-white/20 backdrop-blur"}`}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="mt-2.5 px-1">
                    <div className="text-sm font-black uppercase truncate">{a.name}</div>
                    <div className="text-[10px] text-white/50 mb-1">{a.school} &middot; {a.sport}</div>
                    <div className={`text-lg font-black ${isFirst ? "text-brand" : "text-white/70"}`}>{pct(a.bestEngRate)}</div>
                    <div className="text-[8px] text-white/40 font-bold uppercase tracking-wider">Engagement Rate</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: #1 full-width + orange highlight, rest 2-col */}
          <div className="md:hidden grid grid-cols-2 gap-2">
            {topPerformers.map((a, i) => {
              const items = media[a.id] || [];
              const isFirst = i === 0;
              return (
                <div key={a.id} className={isFirst ? "col-span-2" : ""}>
                  <div className={`relative rounded-xl overflow-hidden h-[200px] ${isFirst ? "border-2 border-brand shadow-[0_0_20px_rgba(215,63,9,0.3)]" : "border border-white/10"}`}>
                    {items.length > 0 ? (
                      <TopPerformerMedia items={items} name={a.name} />
                    ) : (
                      <div className="absolute inset-0 bg-black flex items-center justify-center">
                        <span className="text-[10px] text-white/20 font-bold uppercase">No content</span>
                      </div>
                    )}
                    <div className={`absolute top-2 left-2 w-7 h-7 rounded-full text-white text-xs font-black flex items-center justify-center z-10 ${isFirst ? "bg-brand" : "bg-white/20 backdrop-blur"}`}>
                      {i + 1}
                    </div>
                  </div>
                  <div className="mt-2 px-1">
                    <div className="text-xs font-black uppercase truncate">{a.name}</div>
                    <div className="text-[10px] text-white/50">{a.school}</div>
                    <div className={`text-base font-black ${isFirst ? "text-brand" : "text-white/70"}`}>{pct(a.bestEngRate)}</div>
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
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5 mb-6">
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

          {/* Desktop: full table with headers */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 w-10">#</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30">Athlete</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30">School</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30">Sport</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30">IG Handle</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 text-right">Followers</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 text-right">Impressions</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 text-right">Engagements</th>
                  <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-wider text-white/30 text-right">Eng. Rate</th>
                </tr>
              </thead>
              <tbody>
                {rosterAthletes.map((a, i) => (
                  <tr key={a.id} className="border-b border-white/[0.06] hover:bg-white/[0.02]">
                    <td className="px-3 py-3 text-sm font-black text-white/30">{i + 1}</td>
                    <td className="px-3 py-3 text-sm font-black uppercase">{a.name}</td>
                    <td className="px-3 py-3 text-sm text-white/50">{a.school}</td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-brand/15 text-brand">
                        {a.sport}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-white/40">{a.ig_handle ? `@${a.ig_handle}` : "\u2014"}</td>
                    <td className="px-3 py-3 text-sm font-bold text-white/50 text-right">{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</td>
                    <td className="px-3 py-3 text-sm font-bold text-white/50 text-right">{fmt(getTotalImpressions(a))}</td>
                    <td className="px-3 py-3 text-sm font-bold text-white/50 text-right">{fmt(getTotalEngagements(a))}</td>
                    <td className="px-3 py-3 text-sm font-bold text-brand text-right">{getBestEngRate(a) > 0 ? pct(getBestEngRate(a)) : "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: compact cards */}
          <div className="md:hidden space-y-1">
            {rosterAthletes.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 py-3 px-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <span className="text-sm font-black text-white/30 w-6 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black uppercase">{a.name}</div>
                  <div className="text-[10px] text-white/40">{a.school} &middot; {a.sport}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-white/50">{a.ig_followers ? fmt(a.ig_followers) : "\u2014"}</div>
                  {getBestEngRate(a) > 0 && (
                    <div className="text-[10px] font-bold text-brand">{pct(getBestEngRate(a))}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <div className="recap-footer-area px-6 md:px-12 py-8 border-t border-white/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <PostgameLogo size="sm" className="opacity-30" />
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
