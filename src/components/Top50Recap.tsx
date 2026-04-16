"use client";

import { useState, useMemo } from "react";
import type { Campaign, Athlete, Media } from "@/lib/types";
import { supabaseImageUrl } from "@/lib/supabase-image";
import { fmt, computeStats } from "@/lib/recap-helpers";
import { PostgameLogo } from "./PostgameLogo";
import { SchoolLogo, getFullSchoolName, getSchoolColor } from "./SchoolBadge";

// ── Social Links Helper ──────────────────────────────────────

function getSocialLinks(athlete: Athlete) {
  const links: { platform: string; url: string; icon: "ig" | "tiktok" }[] = [];
  const m = athlete.metrics || {};
  const igPostUrl = m.ig_feed?.post_url || m.ig_reel?.post_url;
  if (igPostUrl) {
    links.push({ platform: "Instagram", url: igPostUrl, icon: "ig" });
  } else if (athlete.ig_handle) {
    links.push({ platform: "Instagram", url: `https://instagram.com/${athlete.ig_handle.replace("@", "")}`, icon: "ig" });
  }
  if (m.tiktok?.post_url) links.push({ platform: "TikTok", url: m.tiktok.post_url, icon: "tiktok" });
  return links;
}

function SocialIcon({ type, className = "" }: { type: "ig" | "tiktok"; className?: string }) {
  if (type === "ig") {
    return (
      <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    );
  }
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.48 6.34 6.34 0 001.87-4.48V8.73a8.19 8.19 0 004.71 1.49V6.79a4.85 4.85 0 01-1-.1z" />
    </svg>
  );
}

// ── Featured Card ────────────────────────────────────────────

function FeaturedCard({
  athlete,
  rank,
  items,
  campaign,
}: {
  athlete: Athlete;
  rank: number;
  items: Media[];
  campaign: Campaign;
}) {
  const color = getSchoolColor(athlete.school);
  const firstMedia = items[0];
  const imgSrc = firstMedia?.thumbnail_url || (firstMedia?.type === "image" ? firstMedia?.file_url : null);
  const links = getSocialLinks(athlete);

  return (
    <div className={rank === 1 ? "col-span-1 md:col-span-1" : ""}>
      <div
        className="relative rounded-2xl overflow-hidden h-[320px] md:h-[420px] border border-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)] group"
        style={{ "--school-color": color } as React.CSSProperties}
      >
        {/* Background image */}
        <div className="absolute inset-0">
          {imgSrc ? (
            <img
              src={supabaseImageUrl(imgSrc, 1200) ?? imgSrc}
              className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast]"
              style={{ objectPosition: "center 20%" }}
              alt={athlete.name}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src.includes("/render/image/public/")) {
                  img.src = img.src.replace("/render/image/public/", "/object/public/").split("?")[0];
                }
              }}
            />
          ) : (
            <div className="w-full h-full bg-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/[0.97] via-black/[0.65] to-transparent" />
        </div>

        {/* Rank badge */}
        <div className="absolute top-3.5 left-3.5 w-10 h-10 rounded-xl bg-brand text-white text-base font-black flex items-center justify-center z-10 shadow-[0_4px_16px_rgba(215,63,9,0.4)]">
          #{rank}
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
          {/* Logo + sport row */}
          <div className="flex items-center gap-2 mb-2.5">
            <div>
              <SchoolLogo school={athlete.school} size={28} />
            </div>
            <span className="px-2.5 py-1 bg-brand/20 text-brand rounded text-[11px] font-extrabold uppercase tracking-wider">
              {athlete.sport}
            </span>
          </div>

          <div className="text-2xl md:text-[28px] font-black uppercase tracking-tight leading-tight">{athlete.name}</div>
          <div className="text-sm md:text-base text-white/40 mt-1 font-medium">{getFullSchoolName(athlete.school)}</div>

          {athlete.notes && (
            <p className="text-sm md:text-base text-white/35 leading-relaxed mt-2 line-clamp-2">{athlete.notes}</p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {athlete.ig_followers ? (
              <span className="flex items-center gap-1.5 text-sm font-bold text-white/40">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                {fmt(athlete.ig_followers)}
              </span>
            ) : null}
            <span className="px-2.5 py-1 bg-white/[0.06] border border-white/[0.08] rounded text-[10px] font-bold text-white/45">
              {athlete.metrics?.campaign_tag || `${campaign.client_name} Top 50`}
            </span>
          </div>

          {/* Links */}
          {links.length > 0 && (
            <div className="flex gap-1.5 mt-3">
              {links.map((link, i) => (
                <a
                  key={i}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                    i === 0
                      ? "bg-brand/15 text-brand hover:bg-brand/30"
                      : "bg-white/[0.08] text-white/50 hover:bg-white/[0.15] hover:text-white"
                  }`}
                >
                  <SocialIcon type={link.icon} className="w-[11px] h-[11px]" />
                  {link.platform === "Instagram" ? "Post" : "TikTok"}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* School color stripe */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] z-20" style={{ background: `linear-gradient(to right, ${color}, transparent)` }} />

        {/* Hover border glow */}
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-[var(--school-color)] transition-colors pointer-events-none z-20" />
      </div>
    </div>
  );
}

// ── Roster Card ──────────────────────────────────────────────

function RosterCard({
  athlete,
  rank,
  items,
  campaign,
}: {
  athlete: Athlete;
  rank: number;
  items: Media[];
  campaign: Campaign;
}) {
  const color = getSchoolColor(athlete.school);
  const firstMedia = items[0];
  const thumbSrc = firstMedia?.thumbnail_url || (firstMedia?.type === "image" ? firstMedia?.file_url : null);
  const links = getSocialLinks(athlete);

  return (
    <div
      className="flex items-center gap-4 md:gap-5 py-5 md:py-6 pr-6 bg-white/[0.02] border border-white/[0.05] rounded-xl transition-all duration-200 overflow-hidden hover:bg-white/[0.04] group"
      style={{ "--school-color": color, borderColor: "rgba(255,255,255,0.05)" } as React.CSSProperties}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)")}
    >
      {/* School color bar */}
      <div className="w-[3px] self-stretch flex-shrink-0 opacity-35 group-hover:opacity-100 transition-opacity" style={{ background: color }} />

      {/* Rank */}
      <div className="text-lg font-black text-white/15 w-10 text-center flex-shrink-0">#{rank}</div>

      {/* Photo */}
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#111] border border-white/[0.05]">
        {thumbSrc ? (
          <img
            src={supabaseImageUrl(thumbSrc, 100) ?? thumbSrc}
            className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast]"
            style={{ objectPosition: "center 20%" }}
            alt={athlete.name}
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes("/render/image/public/")) {
                img.src = img.src.replace("/render/image/public/", "/object/public/").split("?")[0];
              }
            }}
          />
        ) : (
          <div className="w-full h-full bg-[#111]" />
        )}
      </div>

      {/* School logo */}
      <SchoolLogo school={athlete.school} size={48} />

      {/* Identity: sport stacked above name */}
      <div className="flex-shrink-0 w-[240px] md:w-[320px] min-w-0">
        <span className="inline-block px-3 py-1 bg-brand/12 text-brand rounded text-sm font-extrabold uppercase tracking-wider mb-1.5">
          {athlete.sport}
        </span>
        <div className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight truncate">{athlete.name}</div>
        <div className="text-base text-white/30 font-medium truncate">{getFullSchoolName(athlete.school)}</div>
      </div>

      {/* Notes */}
      <div className="flex-1 min-w-0 hidden md:block">
        <p className="text-lg text-white/35 leading-relaxed line-clamp-2">{athlete.notes || "Elite collegiate athlete and brand partner."}</p>
        <div className="flex gap-1 mt-2">
          <span className="px-3 py-1 bg-white/[0.05] border border-white/[0.06] rounded text-sm font-bold text-white/40">{athlete.metrics?.campaign_tag || `${campaign.client_name} Top 50`}</span>
        </div>
      </div>

      {/* Right: followers + links */}
      <div className="flex items-center gap-4 flex-shrink-0 ml-auto">
        {athlete.ig_followers ? (
          <span className="hidden md:flex items-center gap-1.5 text-lg font-bold text-white/30 whitespace-nowrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.5"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            {fmt(athlete.ig_followers)}
          </span>
        ) : null}
        <div className="flex items-center gap-1">
          {links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-base font-bold text-white/25 px-3 py-2 rounded transition-all hover:bg-white/[0.08] hover:text-white/60 whitespace-nowrap"
            >
              <SocialIcon type={link.icon} className="w-[12px] h-[12px]" />
              <span className="hidden md:inline">{link.platform === "Instagram" ? "Post" : "TikTok"}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Top 50 Component ────────────────────────────────────

export function Top50Recap({
  campaign,
  athletes,
  media,
}: {
  campaign: Campaign;
  athletes: Athlete[];
  media: Record<string, Media[]>;
}) {
  const settings = campaign.settings || {};
  const stats = computeStats(athletes);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");

  // Compute unique sports and universities
  const sports = useMemo(() => [...new Set(athletes.map((a) => a.sport).filter(Boolean))].sort(), [athletes]);
  const uniCount = useMemo(() => new Set(athletes.map((a) => a.school)).size, [athletes]);

  // Featured athletes: those with is_featured flag, sorted by featured_order
  const top3 = useMemo(() => {
    const featured = athletes.filter((a: any) => a.is_featured);
    if (featured.length > 0) {
      return featured.sort((a: any, b: any) => (a.featured_order || 0) - (b.featured_order || 0));
    }
    // Fallback: first 3 by sort_order if no one is featured
    return athletes.slice(0, 3);
  }, [athletes]);

  const rest = useMemo(() => {
    const featuredIds = new Set(top3.map((a) => a.id));
    return athletes.filter((a) => !featuredIds.has(a.id));
  }, [athletes, top3]);

  // Filter roster
  const filteredRest = useMemo(() => {
    let list = rest;
    if (sportFilter !== "all") {
      list = list.filter((a) => a.sport === sportFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.school.toLowerCase().includes(q) ||
          (a.sport || "").toLowerCase().includes(q) ||
          (a.notes || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rest, sportFilter, search]);

  // Filter featured too
  const filteredTop3 = useMemo(() => {
    if (sportFilter === "all" && !search.trim()) return top3;
    let list = top3;
    if (sportFilter !== "all") list = list.filter((a) => a.sport === sportFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(q) || a.school.toLowerCase().includes(q));
    }
    return list;
  }, [top3, sportFilter, search]);

  return (
    <div className="recap-container min-h-screen bg-[#050505] text-white font-sans">

      {/* ── TOP BAR ───────────────────────────────────────── */}
      <div className="px-6 md:px-12 py-3.5 border-b border-white/[0.06] flex items-center justify-between sticky top-0 z-50 bg-[#050505]/90 backdrop-blur-xl">
        <PostgameLogo size="sm" className="opacity-50" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">
          Top 50 Athletes
        </span>
      </div>

      {/* ── HERO ──────────────────────────────────────────── */}
      <div className="relative px-6 md:px-12 pt-12 md:pt-16 pb-10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(215,63,9,0.08)_0%,transparent_60%)]" />
        <div className="relative z-10 flex items-start justify-between">
          {/* Left side - title and stats */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="px-4 py-2 bg-brand text-white rounded-md text-[11px] font-black uppercase tracking-widest">
                Top 50
              </span>
              {settings.quarter && (
                <span className="px-3 py-2 bg-white/[0.06] border border-white/10 rounded-md text-[11px] font-bold uppercase tracking-widest text-white/50">
                  {settings.quarter}
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-[64px] font-black uppercase tracking-tight leading-[1.05] mb-4">
              The <span className="text-brand">Top 50</span>
              <br />Athletes
            </h1>

            {settings.description && (
              <p className="text-lg md:text-xl text-white/35 max-w-xl leading-relaxed">{settings.description}</p>
            )}

            <div className="flex gap-9 mt-8">
              <div><div className="text-4xl md:text-[40px] font-black">{stats.athleteCount}</div><div className="text-xs font-bold uppercase tracking-widest text-white/30 mt-0.5">Athletes</div></div>
              <div><div className="text-4xl md:text-[40px] font-black">{uniCount}</div><div className="text-xs font-bold uppercase tracking-widest text-white/30 mt-0.5">Universities</div></div>
              <div><div className="text-4xl md:text-[40px] font-black">{sports.length}</div><div className="text-xs font-bold uppercase tracking-widest text-white/30 mt-0.5">Sports</div></div>
            </div>
          </div>

          {/* Right side - brand logo + year */}
          <div className="hidden md:flex flex-col items-end gap-4">
            {(settings.brand_logo_url || campaign.client_logo_url) && (
              <img
                src={settings.brand_logo_url || campaign.client_logo_url}
                alt={campaign.client_name || "Brand"}
                className="h-24 lg:h-32 object-contain opacity-80"
              />
            )}
            <div className="text-[80px] lg:text-[120px] font-black text-white/[0.06] leading-none tracking-tighter">
              {settings.quarter?.match(/\d{4}/)?.[0] || new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER BAR ────────────────────────────────────── */}
      <div className="px-6 md:px-12 py-4 border-t border-white/[0.06] flex items-center gap-2.5 flex-wrap sticky top-[47px] z-40 bg-[#050505]/92 backdrop-blur-xl">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search athletes..."
            className="pl-10 pr-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-base font-medium outline-none w-56 placeholder:text-white/20 focus:border-brand/50"
          />
        </div>
        <button
          onClick={() => setSportFilter("all")}
          className={`px-4 py-2.5 rounded-md text-sm font-bold uppercase tracking-wide transition-all ${
            sportFilter === "all" ? "bg-brand border-brand text-white" : "bg-white/[0.04] border border-white/[0.08] text-white/35 hover:border-white/20 hover:text-white/70"
          }`}
        >
          All
        </button>
        {sports.map((s) => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            className={`px-4 py-2.5 rounded-md text-sm font-bold uppercase tracking-wide transition-all ${
              sportFilter === s ? "bg-brand border-brand text-white" : "bg-white/[0.04] border border-white/[0.08] text-white/35 hover:border-white/20 hover:text-white/70"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* ── FEATURED ATHLETES ─────────────────────────────── */}
      {filteredTop3.length > 0 && (
        <div className="px-6 md:px-12 pt-7 pb-10">
          <div className="text-base font-extrabold uppercase tracking-[3px] text-white/25 mb-4">Featured Athletes</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5" style={{ gridTemplateColumns: filteredTop3.length >= 3 ? "1.3fr 1fr 1fr" : undefined }}>
            {filteredTop3.map((a, i) => (
              <FeaturedCard key={a.id} athlete={a} rank={i + 1} items={media[a.id] || []} campaign={campaign} />
            ))}
          </div>
        </div>
      )}

      {/* ── DIVIDER ───────────────────────────────────────── */}
      <div className="mx-6 md:mx-12 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ── FULL ROSTER ───────────────────────────────────── */}
      <div className="px-6 md:px-12 pt-9 pb-16">
        <div className="text-base font-extrabold uppercase tracking-[3px] text-white/25 mb-4">Full Roster</div>
        <div className="flex flex-col gap-1">
          {filteredRest.map((a, i) => (
            <RosterCard key={a.id} athlete={a} rank={i + 4} items={media[a.id] || []} campaign={campaign} />
          ))}
        </div>
        {filteredRest.length === 0 && (
          <div className="text-center py-16 text-white/20 text-sm">No athletes match your search.</div>
        )}
      </div>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <div className="recap-footer-area px-6 md:px-12 py-10 border-t border-white/[0.06]">
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
          <span className="text-[9px] text-white/15 font-bold uppercase tracking-[4px]">
            Powered by Postgame
          </span>
        </div>
      </div>
    </div>
  );
}
