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

/* ── Focal-point presets ──────────────────────────────────────── */
const FOCAL_PRESETS = [
  { label: "Top",      value: "center 10%" },
  { label: "Upper",    value: "center 15%" },
  { label: "Mid-up",   value: "center 25%" },
  { label: "Center",   value: "center 50%" },
  { label: "Mid-low",  value: "center 65%" },
  { label: "Bottom",   value: "center 80%" },
];

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

  /* ── Hero carousel state ──────────────────────────────────── */
  const featured = useMemo(() => deals.filter(d => d.featured && d.image_url), [deals]);
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroFade, setHeroFade] = useState(true);
  const heroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Featured athletes carousel ───────────────────────────── */
  const [carIdx, setCarIdx] = useState(0);
  const carTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Focal panel state ────────────────────────────────────── */
  const [focalMap, setFocalMap] = useState<Record<string, string>>({});
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

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

  /* ── Focal-point helpers ──────────────────────────────────── */
  const currentHero = featured[heroIdx] || null;
  const currentFocal = currentHero ? (focalMap[currentHero.id] || "center 15%") : "center 15%";

  const saveFocal = useCallback(async (id: string, fp: string) => {
    setFocalMap(m => ({ ...m, [id]: fp }));
    await supabase.from("deals").update({ focal_point: fp }).eq("id", id);
  }, [supabase]);

  const onThumbDrag = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!thumbRef.current || !currentHero) return;
    const rect = thumbRef.current.getBoundingClientRect();
    const xPct = Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
    const yPct = Math.round(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)));
    const fp = `${xPct}% ${yPct}%`;
    saveFocal(currentHero.id, fp);
  }, [currentHero, saveFocal]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    onThumbDrag(e);
    const onMove = (ev: MouseEvent) => { if (dragging.current) onThumbDrag(ev); };
    const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onThumbDrag]);

  /* ── Filters ──────────────────────────────────────────────── */
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
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 48px", background: "rgba(10,10,10,0.92)", backdropFilter: "blur(16px)", boxShadow: "0 1px 0 rgba(255,255,255,0.08)" }}>
        <a href="/homepage" style={{ fontSize: 22, fontWeight: 900, color: "#D73F09", textDecoration: "none" }}>POSTGAME</a>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          {[["About", "/about/team"], ["Services", "/services/elevated"], ["Campaigns", "/campaigns"], ["Clients", "/clients"], ["Deals", "/deals"], ["Press", "/press"]].map(([l, h]) => (
            <a key={l} href={h} style={{ color: h === "/deals" ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 700, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.05em" }}>{l}</a>
          ))}
          <a href="/contact" style={{ padding: "8px 20px", border: "1.5px solid #D73F09", borderRadius: 8, color: "#D73F09", fontSize: 12, fontWeight: 800, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.06em" }}>Contact</a>
        </div>
      </nav>

      {/* ── Immersive Hero ──────────────────────────────────── */}
      {featured.length > 0 && currentHero && (
        <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
          {/* Background image with crossfade */}
          <div style={{ position: "absolute", inset: 0, transition: "opacity 0.6s ease", opacity: heroFade ? 1 : 0 }}>
            <img
              src={currentHero.image_url!}
              alt={currentHero.athlete_name || ""}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: currentFocal }}
            />
          </div>

          {/* Left gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.15) 70%, transparent 100%)" }} />
          {/* Bottom gradient */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 40%)" }} />

          {/* Glass card — bottom-left */}
          <div style={{ position: "absolute", bottom: 80, left: 48, zIndex: 10, background: "rgba(255,255,255,0.06)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "28px 32px", maxWidth: 420 }}>
            {currentHero.brands?.logo_primary_url && (
              <img src={currentHero.brands.logo_primary_url} alt="" style={{ height: 28, marginBottom: 12, filter: "brightness(0) invert(1)", opacity: 0.8 }} />
            )}
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "#D73F09", marginBottom: 6 }}>
              {currentHero.brand_name}{currentHero.campaign_recaps?.name ? ` · ${currentHero.campaign_recaps.name}` : ""}
            </div>
            <div style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: "clamp(32px,5vw,52px)", lineHeight: 1, letterSpacing: "0.01em", marginBottom: 6 }}>
              {currentHero.athlete_name}
            </div>
            {(currentHero.athlete_school || currentHero.athlete_sport) && (
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
                {[currentHero.athlete_school, currentHero.athlete_sport].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>

          {/* Dot indicators — bottom-center */}
          {featured.length > 1 && (
            <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 10 }}>
              {featured.map((_, i) => (
                <button key={i} onClick={() => goHero(i)} style={{ width: i === heroIdx ? 28 : 8, height: 8, borderRadius: 4, background: i === heroIdx ? "#D73F09" : "rgba(255,255,255,0.3)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
              ))}
            </div>
          )}

          {/* ── Focal-point panel — top-right ────────────── */}
          <div style={{ position: "absolute", top: 80, right: 24, zIndex: 20, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16, width: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.4)", marginBottom: 10 }}>Focal Point</div>
            {/* Preset buttons */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 12 }}>
              {FOCAL_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => currentHero && saveFocal(currentHero.id, p.value)}
                  style={{
                    padding: "5px 0", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(255,255,255,0.12)", transition: "all 0.15s",
                    background: currentFocal === p.value ? "rgba(215,63,9,0.25)" : "rgba(255,255,255,0.05)",
                    color: currentFocal === p.value ? "#D73F09" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Draggable thumbnail */}
            <div
              ref={thumbRef}
              onMouseDown={startDrag}
              style={{ width: "100%", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", cursor: "crosshair", position: "relative", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              <img src={currentHero.image_url!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: currentFocal, pointerEvents: "none" }} />
              {/* Crosshair indicator */}
              {(() => {
                const parts = currentFocal.split(/\s+/);
                const x = parseFloat(parts[0]) || 50;
                const y = parseFloat(parts[1]) || 50;
                return (
                  <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", border: "2px solid #D73F09", background: "rgba(215,63,9,0.3)", pointerEvents: "none" }} />
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Bar ──────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#0a0a0a" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", padding: "32px 48px" }}>
          {STATS.map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: "clamp(28px,4vw,44px)", lineHeight: 1, color: "#D73F09" }}>{s.num}</div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Featured Athletes Carousel ─────────────────────── */}
      {featured.length > 0 && (
        <div style={{ padding: "64px 48px 48px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#D73F09", marginBottom: 12 }}>Featured Athletes</div>
            <div style={{ fontSize: "clamp(28px,4vw,42px)", fontFamily: "'Bebas Neue',Arial,sans-serif", lineHeight: 1, marginBottom: 32 }}>Headliner Deals</div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 20, transition: "transform 0.5s ease", transform: `translateX(-${carIdx * (248 + 20) * 4}px)` }}>
                {featured.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`} style={{ flex: "0 0 248px", width: 248, height: 380, borderRadius: 16, overflow: "hidden", position: "relative", textDecoration: "none", color: "#fff", display: "block" }}>
                    <img src={d.image_url!} alt={d.athlete_name || ""} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focalMap[d.id] || "center 15%" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 18px", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#D73F09", marginBottom: 2 }}>{d.brand_name}</div>
                      <div style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: 22, lineHeight: 1.05 }}>{d.athlete_name}</div>
                      {(d.athlete_school || d.athlete_sport) && (
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{[d.athlete_school, d.athlete_sport].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
            {/* Carousel dots */}
            {carPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
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
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 48px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", marginRight: 4 }}>Filter</span>
          <PillSelect label="Sport" value={sportFilter} onChange={setSportFilter} options={sports} />
          <PillSelect label="College" value={collegeFilter} onChange={setCollegeFilter} options={colleges} />
          <PillSelect label="Brand" value={brandFilter} onChange={setBrandFilter} options={brandNames} />
          {hasFilters && (
            <>
              <button onClick={resetFilters} style={{ padding: "8px 18px", borderRadius: 20, border: "1px solid #D73F09", background: "none", color: "#D73F09", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Reset</button>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{filtered.length} of {deals.length}</span>
            </>
          )}
        </div>
      </div>

      {/* ── 4-Column Deal Grid ─────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 48px 80px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.35)", fontSize: 18 }}>
            No deals match your filters.
            {hasFilters && <div><button onClick={resetFilters} style={{ marginTop: 16, background: "none", border: "none", color: "#D73F09", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Reset filters</button></div>}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {filtered.map(deal => (
              <Link key={deal.id} href={`/deals/${deal.id}`} style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "#111", textDecoration: "none", color: "#fff", display: "block", transition: "border-color 0.2s" }}>
                {deal.image_url && (
                  <div style={{ aspectRatio: "4/5", overflow: "hidden" }}>
                    <img src={deal.image_url} alt={deal.athlete_name || deal.brand_name} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focalMap[deal.id] || "center 15%", transition: "transform 0.4s" }} />
                  </div>
                )}
                <div style={{ padding: "16px 20px 20px" }}>
                  <div style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: "clamp(18px,2vw,24px)", lineHeight: 1.05, marginBottom: 4 }}>{deal.athlete_name || "Team Campaign"}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#D73F09", marginBottom: 6 }}>{deal.brand_name}</div>
                  {(deal.athlete_school || deal.athlete_sport) && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{[deal.athlete_school, deal.athlete_sport].filter(Boolean).join(" · ")}</div>
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
        padding: "8px 32px 8px 16px",
        borderRadius: 20,
        border: value ? "1px solid #D73F09" : "1px solid rgba(255,255,255,0.15)",
        background: value ? "rgba(215,63,9,0.1)" : "rgba(255,255,255,0.04)",
        color: value ? "#D73F09" : "rgba(255,255,255,0.5)",
        fontSize: 12,
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
