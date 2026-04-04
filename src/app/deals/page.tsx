"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";
import Link from "next/link";

/* ── Extended deal with joined fields ─────────────────────────── */
type DealRow = Deal & {
  focal_point?: string | null;
  brand_id?: string | null;
  source_campaign_id?: string | null;
  campaign_recaps?: { name: string } | null;
  brands?: { logo_primary_url: string | null } | null;
};

/* ── Stats ────────────────────────────────────────────────────── */
const STATS = [
  { num: "394+", label: "Campaigns Run" },
  { num: "100+", label: "Brand Partners" },
  { num: "10K+", label: "Athletes Activated" },
  { num: "4K",   label: "Production Standard" },
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

  /* ── Focal map ────────────────────────────────────────────── */
  const [focalMap, setFocalMap] = useState<Record<string, string>>({});

  /* ── Responsive ───────────────────────────────────────────── */
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── Load deals ───────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("deals")
        .select("*, campaign_recaps(name), brands(logo_primary_url)")
        .eq("published", true)
        .order("featured", { ascending: false })
        .order("sort_order", { ascending: true });
      const rows = (data || []) as DealRow[];
      setDeals(rows);
      const fm: Record<string, string> = {};
      rows.forEach(d => { if (d.focal_point) fm[d.id] = d.focal_point; });
      setFocalMap(fm);
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
  const currentHero = featured[heroIdx] || null;
  const currentFocal = currentHero ? (focalMap[currentHero.id] || "50% 25%") : "center 15%";

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
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "clamp(12px,2vw,16px) clamp(20px,4vw,48px)", background: "rgba(10,10,10,0.92)", backdropFilter: "blur(16px)", boxShadow: "0 1px 0 rgba(255,255,255,0.08)" }}>
        <a href="/homepage" style={{ fontSize: "clamp(18px,2.5vw,22px)", fontWeight: 900, color: "#D73F09", textDecoration: "none" }}>POSTGAME</a>
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(16px,3vw,32px)" }}>
          {[["About", "/about/team"], ["Services", "/services/elevated"], ["Campaigns", "/campaigns"], ["Clients", "/clients"], ["Deals", "/deals"], ["Press", "/press"]].map(([l, h]) => (
            <a key={l} href={h} style={{ color: h === "/deals" ? "#fff" : "rgba(255,255,255,0.55)", fontSize: "clamp(11px,1.2vw,13px)", fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</a>
          ))}
          <a href="/contact" style={{ padding: "clamp(6px,1vw,8px) clamp(14px,2vw,20px)", border: "1.5px solid #D73F09", borderRadius: 8, color: "#D73F09", fontSize: "clamp(10px,1.1vw,12px)", fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>Contact</a>
        </div>
      </nav>

      {/* ── Immersive Hero ──────────────────────────────────── */}
      {featured.length > 0 && currentHero && (
        <div style={{ position: "relative", height: "clamp(520px,90vh,680px)", overflow: "hidden" }}>
          {/* Background image with crossfade */}
          <div style={{ position: "absolute", inset: 0, transition: "opacity 0.6s ease", opacity: heroFade ? 1 : 0 }}>
            <img
              src={currentHero.image_url!}
              alt={currentHero.athlete_name || ""}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: currentFocal }}
            />
          </div>

          {/* Bottom-heavy gradient */}
          <div style={{ position: "absolute", inset: 0, background: isMobile
            ? "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, transparent 30%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.99) 100%)"
            : "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 40%, rgba(0,0,0,0.78) 68%, rgba(0,0,0,0.97) 100%)"
          }} />
          {/* Subtle left gradient for nav */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(0,0,0,0.25) 0%, transparent 50%)" }} />

          {/* Bottom layout — column on mobile, row on desktop */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "flex-end", justifyContent: isMobile ? "flex-end" : "space-between", padding: isMobile ? "0 20px 24px" : "0 48px 36px", gap: isMobile ? 14 : 24, zIndex: 10, pointerEvents: "none" }}>

            {/* Nameplate — on mobile renders FIRST (top), on desktop renders second (right) */}
            {isMobile && (
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(10,10,10,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
                {currentHero.brands?.logo_primary_url && (
                  <img src={currentHero.brands.logo_primary_url} alt="" style={{ width: 24, height: 24, objectFit: "contain", background: "rgba(255,255,255,0.07)", borderRadius: 6, padding: 3, filter: "brightness(0) invert(1)", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{currentHero.athlete_name}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#D73F09", marginTop: 2 }}>
                    {currentHero.brand_name}{currentHero.campaign_recaps?.name ? ` · ${currentHero.campaign_recaps.name}` : ""}
                  </div>
                </div>
                {(currentHero.athlete_school || currentHero.athlete_sport) && (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textAlign: "right", flexShrink: 0 }}>{[currentHero.athlete_school, currentHero.athlete_sport].filter(Boolean).join(" · ")}</div>
                )}
              </div>
            )}

            {/* Description box */}
            <div style={{ maxWidth: isMobile ? undefined : 520 }}>
              <div style={{ fontSize: isMobile ? 9 : 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.22em", color: "#D73F09", marginBottom: isMobile ? 6 : 10 }}>Postgame NIL</div>
              <div style={{ fontSize: isMobile ? 36 : 52, fontWeight: 900, lineHeight: 0.92, letterSpacing: -1, textTransform: "uppercase", marginBottom: isMobile ? 10 : 14 }}>
                NIL<br /><span style={{ color: "#D73F09" }}>Deal Tracker</span>
              </div>
              {!isMobile && (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.52)", lineHeight: 1.7, maxWidth: 440, marginBottom: 10, marginTop: 0 }}>
                  Postgame has executed NIL partnerships for thousands of college athletes across every sport and conference — from national fast food chains to global apparel labels.
                </p>
              )}
              <div style={{ fontSize: isMobile ? 10 : 11, color: "rgba(255,255,255,0.28)" }}>Filter by sport, school, or brand to explore the network.</div>
              {/* Dot indicators */}
              {featured.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginTop: isMobile ? 12 : 18, pointerEvents: "all" }}>
                  {featured.map((_, i) => (
                    <button key={i} onClick={() => goHero(i)} style={{ width: i === heroIdx ? 28 : 8, height: 8, borderRadius: 4, background: i === heroIdx ? "#D73F09" : "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
                  ))}
                </div>
              )}
            </div>

            {/* Desktop nameplate — right side */}
            {!isMobile && (
              <div style={{ width: 220, flexShrink: 0, background: "rgba(10,10,10,0.55)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  {currentHero.brands?.logo_primary_url && (
                    <img src={currentHero.brands.logo_primary_url} alt="" style={{ width: 28, height: 28, objectFit: "contain", background: "rgba(255,255,255,0.07)", borderRadius: 6, padding: 4, filter: "brightness(0) invert(1)" }} />
                  )}
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#D73F09", lineHeight: 1.3 }}>{currentHero.brand_name}</div>
                    {currentHero.campaign_recaps?.name && (
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", lineHeight: 1.3 }}>{currentHero.campaign_recaps.name}</div>
                    )}
                  </div>
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 10 }} />
                <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, marginBottom: 4 }}>{currentHero.athlete_name}</div>
                {(currentHero.athlete_school || currentHero.athlete_sport) && (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{[currentHero.athlete_school, currentHero.athlete_sport].filter(Boolean).join(" · ")}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stats Bar ──────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", padding: "clamp(24px,4vw,32px) clamp(20px,4vw,48px)" }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: "clamp(24px,3.5vw,40px)", lineHeight: 1, color: "#D73F09" }}>{s.num}</div>
              <div style={{ fontSize: "clamp(10px,1vw,12px)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginTop: "clamp(4px,0.6vw,6px)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Featured Athletes Carousel ─────────────────────── */}
      {featured.length > 0 && (
        <div style={{ padding: "clamp(40px,6vw,64px) clamp(20px,4vw,48px) clamp(32px,5vw,48px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ fontSize: "clamp(10px,1.1vw,12px)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#D73F09", marginBottom: "clamp(8px,1.2vw,12px)" }}>Featured Athletes</div>
            <div style={{ fontSize: "clamp(24px,3.5vw,42px)", fontFamily: "'Bebas Neue',Arial,sans-serif", lineHeight: 1, marginBottom: "clamp(20px,3vw,32px)" }}>Headliner Deals</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", gap: "clamp(12px,1.5vw,20px)", transition: "transform 0.5s ease", transform: `translateX(-${carIdx * (248 + 20) * 4}px)` }}>
                {featured.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`} style={{ flex: `0 0 clamp(160px,${isMobile ? "42vw" : "20vw"},248px)`, width: `clamp(160px,${isMobile ? "42vw" : "20vw"},248px)`, height: `clamp(240px,${isMobile ? "63vw" : "32vw"},380px)`, borderRadius: "clamp(10px,1.3vw,16px)", overflow: "hidden", position: "relative", textDecoration: "none", color: "#fff", display: "block" }}>
                    <img src={d.image_url!} alt={d.athlete_name || ""} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focalMap[d.id] || "50% 25%" }} />
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
            {/* Carousel dots */}
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

      {/* ── 4-Column Deal Grid ─────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(32px,5vw,48px) clamp(20px,4vw,48px) clamp(48px,7vw,80px)" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "clamp(48px,8vw,80px) 0", color: "rgba(255,255,255,0.35)", fontSize: "clamp(14px,2vw,18px)" }}>
            No deals match your filters.
            {hasFilters && <div><button onClick={resetFilters} style={{ marginTop: 16, background: "none", border: "none", color: "#D73F09", fontSize: "clamp(12px,1.3vw,14px)", fontWeight: 700, cursor: "pointer" }}>Reset filters</button></div>}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: "clamp(12px,1.5vw,20px)" }}>
            {filtered.map(deal => (
              <Link key={deal.id} href={`/deals/${deal.id}`} style={{ borderRadius: "clamp(10px,1.3vw,16px)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#111", textDecoration: "none", color: "#fff", display: "block", transition: "border-color 0.2s" }}>
                {deal.image_url && (
                  <div style={{ aspectRatio: "4/5", overflow: "hidden" }}>
                    <img src={deal.image_url} alt={deal.athlete_name || deal.brand_name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focalMap[deal.id] || "50% 25%", transition: "transform 0.4s" }} />
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
