"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";
import Link from "next/link";
import "@/styles/motion.css";

/* ── Extended deal with joined fields ─────────────────────────── */
type DealRow = Deal & {
  focal_point?: string | null;
  focal_point_tablet?: string | null;
  focal_point_mobile?: string | null;
  zoom_desktop?: number | null;
  zoom_tablet?: number | null;
  zoom_mobile?: number | null;
  brand_id?: string | null;
  source_campaign_id?: string | null;
  campaign_recaps?: { name: string } | null;
  brands?: { logo_primary_url: string | null; logo_white_url?: string | null } | null;
};

/* ── Stats ────────────────────────────────────────────────────── */
const STATS = [
  { num: "394+", label: "Campaigns Run" },
  { num: "100+", label: "Brand Partners" },
  { num: "10K+", label: "Athletes Activated" },
  { num: "4K",   label: "Production Standard" },
];

/* ── Nav links ────────────────────────────────────────────────── */
const NAV_LINKS: [string, string][] = [
  ["Deal Tracker", "/deals"],
  ["Clients", "/clients"],
  ["Campaigns", "/campaigns"],
  ["Services", "/services/elevated"],
  ["About", "/about/team"],
  ["Press", "/press"],
];

export default function DealsPage() {
  const supabase = createBrowserSupabase();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  /* ── Hero carousel ────────────────────────────────────────── */
  const featured = useMemo(() => deals.filter(d => d.featured && d.image_url), [deals]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroFade, setHeroFade] = useState(true);
  const heroTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Featured athletes carousel ───────────────────────────── */
  const [carIdx, setCarIdx] = useState(0);
  const carTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Focal maps (per device) ───────────────────────────────── */
  const [focalMap, setFocalMap] = useState<Record<string, string>>({});
  const [tabletFocalMap, setTabletFocalMap] = useState<Record<string, string>>({});
  const [mobileFocalMap, setMobileFocalMap] = useState<Record<string, string>>({});

  /* ── Zoom maps (per device) ──────────────────────────────── */
  const [zoomMap, setZoomMap] = useState<Record<string, number>>({});
  const [tabletZoomMap, setTabletZoomMap] = useState<Record<string, number>>({});
  const [mobileZoomMap, setMobileZoomMap] = useState<Record<string, number>>({});

  /* ── Responsive ───────────────────────────────────────────── */
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const check = () => { setIsMobile(window.innerWidth < 640); setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isCompact = isMobile || isTablet;

  /* ── Load deals ───────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("*, campaign_recaps(name), brands(logo_primary_url, logo_white_url)")
        .eq("published", true)
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true });
      const rows = (data || []) as DealRow[];
      setDeals(rows);
      const fm: Record<string, string> = {};
      const tfm: Record<string, string> = {};
      const mfm: Record<string, string> = {};
      const zm: Record<string, number> = {};
      const tzm: Record<string, number> = {};
      const mzm: Record<string, number> = {};
      rows.forEach(d => {
        if (d.focal_point) fm[d.id] = d.focal_point;
        if (d.focal_point_tablet) tfm[d.id] = d.focal_point_tablet;
        if (d.focal_point_mobile) mfm[d.id] = d.focal_point_mobile;
        if (d.zoom_desktop != null) zm[d.id] = d.zoom_desktop;
        if (d.zoom_tablet != null) tzm[d.id] = d.zoom_tablet;
        if (d.zoom_mobile != null) mzm[d.id] = d.zoom_mobile;
      });
      setFocalMap(fm);
      setTabletFocalMap(tfm);
      setMobileFocalMap(mfm);
      setZoomMap(zm);
      setTabletZoomMap(tzm);
      setMobileZoomMap(mzm);
      setLoading(false);
    })();
  }, []);

  /* ── Hero auto-advance (5s) ───────────────────────────────── */
  useEffect(() => {
    if (featured.length <= 1) return;
    heroTimer.current = setInterval(() => {
      setHeroFade(false);
      setTimeout(() => {
        setHeroIdx(i => (i + 1) % featured.length);
        setHeroFade(true);
      }, 400);
    }, 5000);
    return () => { if (heroTimer.current) clearInterval(heroTimer.current); };
  }, [featured.length]);

  /* ── Featured carousel auto-advance (4s) ──────────────────── */
  const carPages = Math.max(1, Math.ceil(featured.length / 4));
  useEffect(() => {
    if (carPages <= 1) return;
    carTimer.current = setInterval(() => setCarIdx(i => (i + 1) % carPages), 4000);
    return () => { if (carTimer.current) clearInterval(carTimer.current); };
  }, [carPages]);

  /* ── Helpers ──────────────────────────────────────────────── */
  const curDeal = featured[heroIdx] || null;
  // Per-device focal: use dedicated column if set, else fall back to desktop, else default
  const getFocal = (dealId: string) => {
    if (isMobile) return mobileFocalMap[dealId] || "50% 20%";
    if (isTablet) return tabletFocalMap[dealId] || focalMap[dealId] || "50% 20%";
    return focalMap[dealId] || "50% 25%";
  };
  const getZoom = (dealId: string): number => {
    if (isMobile) return mobileZoomMap[dealId] ?? 1;
    if (isTablet) return tabletZoomMap[dealId] ?? 1;
    return zoomMap[dealId] ?? 1;
  };
  const heroFocalPos = curDeal ? getFocal(curDeal.id) : "50% 25%";
  const heroZoom = curDeal ? getZoom(curDeal.id) : 1;

  const sports = useMemo(() => [...new Set(deals.map(d => d.athlete_sport).filter(Boolean))].sort() as string[], [deals]);
  const colleges = useMemo(() => [...new Set(deals.map(d => d.athlete_school).filter(Boolean))].sort() as string[], [deals]);
  const brandNames = useMemo(() => [...new Set(deals.map(d => d.brand_name).filter(Boolean))].sort(), [deals]);

  const filtered = useMemo(() => {
    return deals.filter(d => {
      if (sportFilter && d.athlete_sport !== sportFilter) return false;
      if (collegeFilter && d.athlete_school !== collegeFilter) return false;
      if (brandFilter && d.brand_name !== brandFilter) return false;
      return true;
    });
  }, [deals, sportFilter, collegeFilter, brandFilter]);

  const hasFilters = sportFilter || collegeFilter || brandFilter;
  function resetFilters() { setSportFilter(""); setCollegeFilter(""); setBrandFilter(""); }

  const goHero = (i: number) => { setHeroFade(false); setTimeout(() => { setHeroIdx(i); setHeroFade(true); }, 300); };

  /* ── Stats count-up on mount ──────────────────────────────── */
  const [campaignsCount, setCampaignsCount] = useState(0);
  const [brandsCount, setBrandsCount] = useState(0);
  const [athletesCount, setAthletesCount] = useState(0);
  useEffect(() => {
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / 1400, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCampaignsCount(Math.round(ease * 394));
      setBrandsCount(Math.round(ease * 100));
      setAthletesCount(Math.round(ease * 10000));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const heroHeight = isMobile ? "100svh" : isTablet ? "clamp(600px,88vh,820px)" : "clamp(700px,92vh,960px)";
  const carCardW = isMobile ? "clamp(150px,42vw,200px)" : isTablet ? "clamp(160px,28vw,220px)" : "248px";
  const carCardH = isMobile ? "clamp(220px,62vw,300px)" : isTablet ? "clamp(240px,42vw,330px)" : "380px";
  const gridCols = isMobile ? "repeat(2,1fr)" : isTablet ? "repeat(3,1fr)" : "repeat(4,1fr)";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", fontFamily: "Arial,sans-serif", fontSize: 16 }}>
        Loading deals...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "Arial,Helvetica,sans-serif" }}>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: isCompact ? "12px 16px" : "16px 48px", background: isMobile ? "#000" : "rgba(10,10,10,0.92)", backdropFilter: isMobile ? undefined : "blur(16px)", boxShadow: isMobile ? "none" : "0 1px 0 rgba(255,255,255,0.08)" }}>
        <a href="/homepage" style={{ fontSize: isCompact ? 18 : 22, fontWeight: 900, color: "#D73F09", textDecoration: "none" }}>POSTGAME</a>
        {!isCompact ? (
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {NAV_LINKS.map(([l, h]) => (
              <a key={l} href={h} style={{ color: h === "/deals" ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</a>
            ))}
            <a href="/contact" style={{ padding: "8px 20px", border: "1.5px solid #D73F09", borderRadius: 8, color: "#D73F09", fontSize: 12, fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>Contact</a>
          </div>
        ) : (
          <button onClick={() => setMenuOpen(o => !o)} style={{ width: 36, height: 36, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)", borderRadius: 8, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: 0 }}>
            <span style={{ width: 16, height: 1.5, background: "#fff", borderRadius: 2, transition: "transform 0.25s", transform: menuOpen ? "translateY(6.5px) rotate(45deg)" : "none" }} />
            <span style={{ width: 16, height: 1.5, background: "#fff", borderRadius: 2, transition: "opacity 0.2s", opacity: menuOpen ? 0 : 1 }} />
            <span style={{ width: 16, height: 1.5, background: "#fff", borderRadius: 2, transition: "transform 0.25s", transform: menuOpen ? "translateY(-6.5px) rotate(-45deg)" : "none" }} />
          </button>
        )}
      </nav>

      {/* ── Slide-out menu (tablet + mobile) ───────────────── */}
      {isCompact && (
        <>
          {/* Overlay */}
          <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 40, opacity: menuOpen ? 1 : 0, pointerEvents: menuOpen ? "auto" : "none", transition: "opacity 0.3s" }} />
          {/* Panel */}
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 260, background: "rgba(8,8,8,0.98)", borderLeft: "1px solid rgba(255,255,255,0.08)", zIndex: 50, transform: menuOpen ? "translateX(0)" : "translateX(100%)", transition: "transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#D73F09" }}>POSTGAME</span>
              <button onClick={() => setMenuOpen(false)} style={{ width: 32, height: 32, border: "none", background: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", padding: 0 }}>✕</button>
            </div>
            {/* Links */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {NAV_LINKS.map(([l, h]) => (
                <a key={l} href={h} onClick={() => setMenuOpen(false)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: h === "/deals" ? "#D73F09" : "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                  {l}<span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>→</span>
                </a>
              ))}
            </div>
            {/* CTA */}
            <div style={{ padding: "14px" }}>
              <a href="/contact" style={{ display: "block", textAlign: "center", padding: "12px 0", background: "#D73F09", borderRadius: 8, color: "#fff", fontSize: 12, fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>Start a Campaign</a>
            </div>
            {/* Socials */}
            <div style={{ padding: "0 14px 20px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Follow Postgame</div>
              <div style={{ display: "flex", gap: 8 }}>
                {/* Instagram */}
                <a href="#instagram" style={{ width: 36, height: 36, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="rgba(255,255,255,0.5)" stroke="none"/></svg>
                </a>
                {/* TikTok */}
                <a href="#tiktok" style={{ width: 36, height: 36, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.27a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.7z"/></svg>
                </a>
                {/* X / Twitter */}
                <a href="#twitter" style={{ width: 36, height: 36, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                {/* LinkedIn */}
                <a href="#linkedin" style={{ width: 36, height: 36, border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.5)"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Immersive Hero ──────────────────────────────────── */}
      {featured.length > 0 && curDeal && (
        <div style={{ position: "relative", height: heroHeight, overflow: "hidden" }}>
          {/* Background image with crossfade */}
          <div style={{ position: "absolute", inset: 0, transition: "opacity 0.6s ease", opacity: heroFade ? 1 : 0 }}>
            <img
              key={heroIdx + "-" + curDeal.id}
              className={heroIdx % 2 === 0 ? "ken-burns-a" : "ken-burns-b"}
              src={curDeal.image_url!}
              alt={curDeal.athlete_name || ""}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: heroFocalPos, transform: heroZoom !== 1 ? `scale(${heroZoom})` : undefined, transformOrigin: heroFocalPos }}
            />
          </div>

          {/* Top black fade — stronger on mobile for title readability */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: isMobile ? 280 : 120, background: isMobile
            ? "linear-gradient(to bottom, #000000 0%, #000000 30%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.4) 75%, transparent 100%)"
            : "linear-gradient(to bottom, #000 0%, transparent 100%)", zIndex: 7, pointerEvents: "none" }} />
          {/* Bottom-heavy gradient */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 22%, transparent 42%, rgba(0,0,0,0.82) 68%, rgba(0,0,0,0.98) 100%)" }} />
          {/* Subtle left gradient for nav */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 50%)" }} />

          {/* ── MOBILE hero content ──────────────────────────── */}
          {isMobile && (
            <>
              {/* Title area — top */}
              <div style={{ position: "absolute", top: 58, left: 14, right: 14, zIndex: 10, pointerEvents: "none" }}>
                <div className="animate-hero-title" style={{ fontSize: "clamp(34px,9vw,44px)", fontWeight: 900, lineHeight: 0.92, letterSpacing: -1, textTransform: "uppercase", marginBottom: 12 }}>
                  NIL<br /><span style={{ color: "#D73F09" }}>Deal Tracker</span>
                </div>
              </div>
              {/* Deep bottom gradient for cinematic nameplate */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 260, background: "linear-gradient(to top, #000000 0%, rgba(0,0,0,0.95) 25%, rgba(0,0,0,0.6) 55%, transparent 100%)", zIndex: 4, pointerEvents: "none" }} />
              {/* Mobile nameplate — logo tab + glass card */}
              <div className="animate-hero-np" style={{ position: "absolute", bottom: 14, left: 14, zIndex: 10 }}>
                {/* Floating logo */}
                {(curDeal.brands?.logo_white_url || curDeal.brands?.logo_primary_url) && (
                  <div style={{ marginLeft: 12, marginBottom: 6, height: 32, display: "flex", alignItems: "flex-end" }}>
                    <img src={curDeal.brands.logo_white_url || curDeal.brands.logo_primary_url!} alt="" style={{ maxHeight: 32, maxWidth: 80, objectFit: "contain", ...(!curDeal.brands.logo_white_url ? { filter: "brightness(0) invert(1)" } : {}) }} />
                  </div>
                )}
                {/* Glass card */}
                <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 12px 10px", minWidth: 140 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: "#D73F09" }}>{curDeal.brand_name}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{curDeal.campaign_recaps?.name || curDeal.brand_name}</div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "6px 0" }} />
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{curDeal.athlete_name}</div>
                  {(curDeal.athlete_school || curDeal.athlete_sport) && (curDeal.athlete_name?.length || 0) <= 18 && (
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{[curDeal.athlete_school, curDeal.athlete_sport].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
                {/* Dots */}
                {featured.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    {featured.map((_, i) => (
                      <button key={i} onClick={() => goHero(i)} style={{ width: i === heroIdx ? 28 : 8, height: 8, borderRadius: 4, background: i === heroIdx ? "#D73F09" : "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── TABLET hero content ─────────────────────────── */}
          {isTablet && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 32px 32px", gap: 20, zIndex: 10, pointerEvents: "none" }}>
              {/* Left — description */}
              <div style={{ maxWidth: 420 }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.22em", color: "#D73F09", marginBottom: 8 }}>Postgame NIL</div>
                <div className="animate-hero-title" style={{ fontSize: 38, fontWeight: 900, lineHeight: 0.92, letterSpacing: -1, textTransform: "uppercase", marginBottom: 12 }}>
                  NIL<br /><span style={{ color: "#D73F09" }}>Deal Tracker</span>
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.52)", lineHeight: 1.7, maxWidth: 380, marginBottom: 8, marginTop: 0 }}>
                  Postgame has executed NIL partnerships for thousands of college athletes across every sport and conference — from national fast food chains to global apparel labels.
                </p>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.28)" }}>Filter by sport, school, or brand to explore the network.</div>
                {featured.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 14, pointerEvents: "all" }}>
                    {featured.map((_, i) => (
                      <button key={i} onClick={() => goHero(i)} style={{ width: i === heroIdx ? 28 : 8, height: 8, borderRadius: 4, background: i === heroIdx ? "#D73F09" : "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
                    ))}
                  </div>
                )}
              </div>
              {/* Right — logo tab + glass nameplate */}
              <div className="animate-hero-np" style={{ flexShrink: 0 }}>
                {(curDeal.brands?.logo_white_url || curDeal.brands?.logo_primary_url) && (
                  <div style={{ marginLeft: 12, marginBottom: 6, height: 36, display: "flex", alignItems: "flex-end" }}>
                    <img src={curDeal.brands.logo_white_url || curDeal.brands.logo_primary_url!} alt="" style={{ maxHeight: 36, maxWidth: 90, objectFit: "contain", ...(!curDeal.brands.logo_white_url ? { filter: "brightness(0) invert(1)" } : {}) }} />
                  </div>
                )}
                <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px 12px", minWidth: 190 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: "#D73F09" }}>{curDeal.brand_name}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{curDeal.campaign_recaps?.name || curDeal.brand_name}</div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "8px 0" }} />
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{curDeal.athlete_name}</div>
                  {(curDeal.athlete_school || curDeal.athlete_sport) && (
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{[curDeal.athlete_school, curDeal.athlete_sport].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── DESKTOP hero content ────────────────────────── */}
          {!isMobile && !isTablet && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 48px 36px", gap: 24, zIndex: 10, pointerEvents: "none" }}>
              {/* Left — description */}
              <div style={{ maxWidth: 520 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.22em", color: "#D73F09", marginBottom: 10 }}>Postgame NIL</div>
                <div className="animate-hero-title" style={{ fontSize: 52, fontWeight: 900, lineHeight: 0.92, letterSpacing: -1, textTransform: "uppercase", marginBottom: 14 }}>
                  NIL<br /><span style={{ color: "#D73F09" }}>Deal Tracker</span>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.52)", lineHeight: 1.7, maxWidth: 440, marginBottom: 10, marginTop: 0 }}>
                  Postgame has executed NIL partnerships for thousands of college athletes across every sport and conference — from national fast food chains to global apparel labels.
                </p>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>Filter by sport, school, or brand to explore the network.</div>
                {featured.length > 1 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 18, pointerEvents: "all" }}>
                    {featured.map((_, i) => (
                      <button key={i} onClick={() => goHero(i)} style={{ width: i === heroIdx ? 28 : 8, height: 8, borderRadius: 4, background: i === heroIdx ? "#D73F09" : "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
                    ))}
                  </div>
                )}
              </div>
              {/* Right — logo tab + glass nameplate */}
              <div className="animate-hero-np" style={{ position: "absolute", bottom: 20, right: 24, zIndex: 10 }}>
                {/* Floating logo */}
                {(curDeal.brands?.logo_white_url || curDeal.brands?.logo_primary_url) && (
                  <div style={{ marginLeft: 12, marginBottom: 6, height: 38, display: "flex", alignItems: "flex-end" }}>
                    <img src={curDeal.brands.logo_white_url || curDeal.brands.logo_primary_url!} alt="" style={{ maxHeight: 38, maxWidth: 100, objectFit: "contain", ...(!curDeal.brands.logo_white_url ? { filter: "brightness(0) invert(1)" } : {}) }} />
                  </div>
                )}
                {/* Glass card */}
                <div style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 16px 14px", minWidth: 220 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", color: "#D73F09" }}>{curDeal.brand_name}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{curDeal.campaign_recaps?.name || curDeal.brand_name}</div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "8px 0" }} />
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{curDeal.athlete_name}</div>
                  {(curDeal.athlete_school || curDeal.athlete_sport) && (
                    <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>{[curDeal.athlete_school, curDeal.athlete_sport].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Hero bleed gradient — extends hero photo fade into sections below ── */}
      {featured.length > 0 && (
        <div style={{ position: "relative", marginTop: -200, paddingTop: 200, background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 30%, #000 55%)", pointerEvents: "none", zIndex: 3 }}>
          <div style={{ pointerEvents: "auto" }}>

      {/* ── Stats Bar ──────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", padding: "clamp(24px,4vw,32px) clamp(20px,4vw,48px)" }}>
          {[
            { num: campaignsCount + "+", label: "Campaigns Run" },
            { num: brandsCount + "+", label: "Brand Partners" },
            { num: athletesCount >= 10000 ? "10K+" : athletesCount + "+", label: "Athletes Activated" },
            { num: "4K", label: "Production Standard" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: "clamp(24px,3.5vw,40px)", lineHeight: 1, color: "#D73F09" }}>{s.num}</div>
              <div style={{ fontSize: "clamp(10px,1vw,12px)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginTop: "clamp(4px,0.6vw,6px)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Featured Athletes Carousel ─────────────────────── */}
      {featured.length > 0 && (
        <div style={{ padding: "clamp(28px,4vw,48px) clamp(20px,4vw,48px) clamp(32px,5vw,48px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ fontSize: "clamp(10px,1.1vw,12px)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#D73F09", marginBottom: "clamp(8px,1.2vw,12px)" }}>Featured Athletes</div>
            <div style={{ fontSize: "clamp(24px,3.5vw,42px)", fontFamily: "'Bebas Neue',Arial,sans-serif", lineHeight: 1, marginBottom: "clamp(20px,3vw,32px)" }}>Headliner Deals</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", gap: "clamp(12px,1.5vw,20px)", transition: "transform 0.5s ease", transform: `translateX(-${carIdx * (248 + 20) * 4}px)` }}>
                {featured.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`} style={{ flex: `0 0 ${carCardW}`, width: carCardW, height: carCardH, borderRadius: "clamp(10px,1.3vw,16px)", overflow: "hidden", position: "relative", textDecoration: "none", color: "#fff", display: "block" }}>
                    <img src={d.image_url!} alt={d.athlete_name || ""} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: getFocal(d.id), transform: getZoom(d.id) !== 1 ? `scale(${getZoom(d.id)})` : undefined, transformOrigin: getFocal(d.id) }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "clamp(14px,2vw,20px) clamp(12px,1.5vw,18px)", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: "clamp(9px,0.9vw,10px)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#D73F09", marginBottom: 2 }}>{d.brand_name}</div>
                      <div style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: "clamp(18px,2vw,22px)", lineHeight: 1.05 }}>{d.athlete_name}</div>
                      {(d.athlete_school || d.athlete_sport) && (
                        <div style={{ fontSize: "clamp(10px,1vw,11px)", color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{[d.athlete_school, d.athlete_sport].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            {carPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: "clamp(16px,2vw,24px)" }}>
                {Array.from({ length: carPages }).map((_, i) => (
                  <button key={i} onClick={() => setCarIdx(i)} style={{ width: i === carIdx ? 24 : 8, height: 8, borderRadius: 4, background: i === carIdx ? "#D73F09" : "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

          </div>
        </div>
      )}

      {/* ── Filter Row ─────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(14px,2vw,20px) clamp(20px,4vw,48px)", display: "flex", alignItems: "center", gap: "clamp(8px,1.2vw,12px)", flexWrap: "wrap" }}>
          <span style={{ fontSize: "clamp(10px,1.1vw,12px)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", marginRight: 4 }}>Filter</span>
          <PillSelect label="Sport" value={sportFilter} onChange={setSportFilter} options={sports} />
          <PillSelect label="College" value={collegeFilter} onChange={setCollegeFilter} options={colleges} />
          <PillSelect label="Brand" value={brandFilter} onChange={setBrandFilter} options={brandNames} />
          {hasFilters && (
            <>
              <button onClick={resetFilters} style={{ padding: "clamp(6px,0.8vw,8px) clamp(12px,1.5vw,18px)", borderRadius: 20, border: "1px solid #D73F09", background: "none", color: "#D73F09", fontSize: "clamp(10px,1.1vw,12px)", fontWeight: 700, cursor: "pointer" }}>Reset</button>
              <span style={{ fontSize: "clamp(10px,1.1vw,12px)", color: "rgba(255,255,255,0.35)" }}>{filtered.length} of {deals.length}</span>
            </>
          )}
        </div>
      </div>

      {/* ── Deal Grid ──────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(32px,5vw,48px) clamp(20px,4vw,48px) clamp(48px,7vw,80px)" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "clamp(48px,8vw,80px) 0", color: "rgba(255,255,255,0.35)", fontSize: "clamp(14px,2vw,18px)" }}>
            No deals match your filters.
            {hasFilters && <div><button onClick={resetFilters} style={{ marginTop: 16, background: "none", border: "none", color: "#D73F09", fontSize: "clamp(12px,1.3vw,14px)", fontWeight: 700, cursor: "pointer" }}>Reset filters</button></div>}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: "clamp(12px,1.5vw,20px)" }}>
            {filtered.map(deal => (
              <Link key={deal.id} href={`/deals/${deal.id}`} className="hover-lift" style={{ borderRadius: "clamp(10px,1.3vw,16px)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#111", textDecoration: "none", color: "#fff", display: "block" }}>
                {deal.image_url && (
                  <div style={{ aspectRatio: "4/5", overflow: "hidden" }}>
                    <img src={deal.image_url} alt={deal.athlete_name || deal.brand_name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: getFocal(deal.id), transform: getZoom(deal.id) !== 1 ? `scale(${getZoom(deal.id)})` : undefined, transformOrigin: getFocal(deal.id), transition: "transform 0.4s" }} />
                  </div>
                )}
                <div style={{ padding: "clamp(12px,1.5vw,16px) clamp(14px,1.8vw,20px) clamp(14px,1.8vw,20px)" }}>
                  <div style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: "clamp(16px,1.8vw,24px)", lineHeight: 1.05, marginBottom: "clamp(2px,0.4vw,4px)" }}>{deal.athlete_name || "Team Campaign"}</div>
                  <div style={{ fontSize: "clamp(11px,1.2vw,13px)", fontWeight: 700, color: "#D73F09", marginBottom: "clamp(4px,0.6vw,6px)" }}>{deal.brand_name}</div>
                  {(deal.athlete_school || deal.athlete_sport) && (
                    <div style={{ fontSize: "clamp(10px,1.1vw,12px)", color: "rgba(255,255,255,0.4)" }}>{[deal.athlete_school, deal.athlete_sport].filter(Boolean).join(" · ")}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer>
        <div className="pg-footer">
          <div>
            <a href="/homepage"><img src="/postgame-logo.png" alt="Postgame" style={{ height: 28, width: "auto" }} /></a>
            <p className="pg-footer-brand-desc">The #1 NIL agency in the country. Connecting elite college athletes with the world&apos;s most ambitious brands.</p>
          </div>
          <div>
            <div className="pg-footer-col-title">Company</div>
            <ul className="pg-footer-links"><li><a href="/about/team">About</a></li><li><a href="/services/elevated">Services</a></li><li><a href="/contact">Contact</a></li></ul>
          </div>
          <div>
            <div className="pg-footer-col-title">Network</div>
            <ul className="pg-footer-links"><li><a href="/clients">Clients</a></li><li><a href="/campaigns">Campaigns</a></li><li><a href="/deals">Deal Tracker</a></li></ul>
          </div>
          <div>
            <div className="pg-footer-col-title">Connect</div>
            <ul className="pg-footer-links"><li><a href="#">Instagram</a></li><li><a href="#">TikTok</a></li><li><a href="#">Twitter / X</a></li><li><a href="#">LinkedIn</a></li></ul>
          </div>
        </div>
        <div className="pg-footer-bottom">
          <div className="pg-footer-copy">&copy; {new Date().getFullYear()} Postgame. All rights reserved.</div>
          <div className="pg-footer-socials"><a href="#">Privacy</a><a href="#">Terms</a><a href="/contact">Contact</a></div>
        </div>
      </footer>
    </div>
  );
}

/* ── Pill-style filter select ─────────────────────────────────── */
function PillSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: "clamp(6px,0.8vw,8px) clamp(24px,3vw,32px) clamp(6px,0.8vw,8px) clamp(12px,1.5vw,16px)",
        borderRadius: 20,
        border: value ? "1px solid #D73F09" : "1px solid rgba(255,255,255,0.15)",
        background: value ? "rgba(215,63,9,0.1)" : "rgba(255,255,255,0.04)",
        color: value ? "#D73F09" : "rgba(255,255,255,0.5)",
        fontSize: "clamp(10px,1.1vw,12px)",
        fontWeight: 700,
        fontFamily: "Arial,sans-serif",
        cursor: "pointer",
        appearance: "none" as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
      }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
