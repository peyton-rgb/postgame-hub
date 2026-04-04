"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { PressArticle } from "@/lib/types";

const CHIPS = ["All", "NIL", "Brands", "Athletes", "Media", "Forbes", "Agency"];

export default function PressContent({ articles }: { articles: PressArticle[] }) {
  const [chip, setChip] = useState("All");
  const [isDesktop, setIsDesktop] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const paused = useRef(false);
  const prevHeroId = useRef<string | null>(null);
  const [droppedId, setDroppedId] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth > 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const filtered = useMemo(() => {
    if (chip === "All") return articles;
    return articles.filter(a => a.category?.toLowerCase().includes(chip.toLowerCase()));
  }, [articles, chip]);

  // Fixed featured article (stays static)
  const fixedFeatured = filtered.find(a => a.featured) || null;

  // Rotating articles = all non-featured
  const rotatingArticles = useMemo(() => filtered.filter(a => !a.featured), [filtered]);

  // Reset heroIdx when filter changes
  useEffect(() => { setHeroIdx(0); }, [chip]);

  const safeIdx = rotatingArticles.length > 0 ? heroIdx % rotatingArticles.length : 0;
  const heroArticle = rotatingArticles[safeIdx] || null;
  const listArticles = rotatingArticles.length > 1
    ? [...rotatingArticles.slice(safeIdx + 1), ...rotatingArticles.slice(0, safeIdx)]
    : [];
  const latestList = listArticles.slice(0, 4);
  const gridList = listArticles.slice(4);

  // Auto-advance timer
  useEffect(() => {
    if (rotatingArticles.length <= 1) return;
    const iv = setInterval(() => {
      if (paused.current) return;
      setIsTransitioning(true);
      prevHeroId.current = rotatingArticles[heroIdx % rotatingArticles.length]?.id || null;
      setTimeout(() => {
        setHeroIdx(i => (i + 1) % rotatingArticles.length);
        setTimeout(() => {
          setIsTransitioning(false);
          setDroppedId(prevHeroId.current);
          setTimeout(() => setDroppedId(null), 500);
        }, 50);
      }, 400);
    }, 5000);
    return () => clearInterval(iv);
  }, [rotatingArticles.length, heroIdx]);

  const goTo = (i: number) => {
    if (i === safeIdx) return;
    setIsTransitioning(true);
    prevHeroId.current = heroArticle?.id || null;
    setTimeout(() => {
      setHeroIdx(i);
      setTimeout(() => {
        setIsTransitioning(false);
        setDroppedId(prevHeroId.current);
        setTimeout(() => setDroppedId(null), 500);
      }, 50);
    }, 350);
  };

  const excerpt = (s: string | null, len = 120) => {
    if (!s) return "";
    return s.length > len ? s.slice(0, len).trimEnd() + "..." : s;
  };

  return (
    <div
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "Arial,Helvetica,sans-serif" }}
    >
      <style>{`@keyframes slideInBottom { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } } .slide-in-bottom { animation: slideInBottom 0.45s ease both; }`}</style>

      {/* ── Nav ─────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: "1px solid #e8e8e8", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/homepage" style={{ fontSize: 13, fontWeight: 900, color: "#111", textDecoration: "none", letterSpacing: "0.03em" }}>POSTGAME <span style={{ color: "#D73F09" }}>NIL</span></a>
      </nav>

      {/* ── Hero Header ────────────────────────── */}
      <div style={{ background: "#111", padding: isDesktop ? "48px 24px 32px" : "36px 18px 28px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", color: "#D73F09", marginBottom: 14 }}>Press & News</div>
          <h1 style={{ fontFamily: "'Bebas Neue',Arial,sans-serif", fontSize: isDesktop ? 52 : 38, fontWeight: 900, textTransform: "uppercase", lineHeight: 0.88, color: "#fff", margin: 0 }}>
            IN THE<br /><span style={{ color: "#D73F09" }}>PRESS</span>
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", maxWidth: 420, marginTop: 14, marginBottom: 0, lineHeight: 1.55 }}>
            The latest press coverage and media highlights from Postgame NIL campaigns.
          </p>
          <div style={{ width: 36, height: 3, background: "#D73F09", marginTop: 20, borderRadius: 2 }} />
        </div>
      </div>

      {/* ── Filter Chips ───────────────────────── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #ececec", padding: "14px 18px", overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 8, maxWidth: 800, margin: "0 auto" }}>
          {CHIPS.map(c => (
            <button key={c} onClick={() => setChip(c)} style={{
              padding: "6px 16px", borderRadius: 20, border: chip === c ? "1.5px solid #D73F09" : "1.5px solid #e0e0e0",
              fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
              background: chip === c ? "#D73F09" : "#fff", color: chip === c ? "#fff" : "#666",
            }}>{c}</button>
          ))}
        </div>
      </div>

      {/* ── Content ────────────────────────────── */}
      <div style={{ maxWidth: isDesktop ? 800 : undefined, margin: "0 auto" }}>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 18px", color: "#aaa", fontSize: 14 }}>No articles in this category yet.</div>
        )}

        {/* 1. Fixed Featured Article (static) */}
        {fixedFeatured && (
          <div style={{ margin: isDesktop ? "24px auto" : "16px 18px", maxWidth: isDesktop ? 760 : undefined }}>
            <a href={fixedFeatured.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block", background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8", overflow: "hidden" }}>
              {fixedFeatured.image_url && (
                <img src={fixedFeatured.image_url} alt={fixedFeatured.title} style={{ width: "100%", height: isDesktop ? 320 : 220, objectFit: "cover", display: "block" }} />
              )}
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", background: "#D73F09", color: "#fff", padding: "3px 8px", borderRadius: 4 }}>Featured</span>
                  {fixedFeatured.publication && <span style={{ fontSize: 10, color: "#aaa", fontWeight: 600 }}>{fixedFeatured.publication}</span>}
                </div>
                <h2 style={{ fontSize: isDesktop ? 22 : 17, fontWeight: 900, color: "#111", lineHeight: 1.25, margin: "0 0 8px" }}>{fixedFeatured.title}</h2>
                {fixedFeatured.excerpt && <p style={{ fontSize: 12, color: "#666", lineHeight: 1.55, margin: "0 0 14px" }}>{excerpt(fixedFeatured.excerpt)}</p>}
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#D73F09", letterSpacing: "0.1em" }}>Read Article →</span>
              </div>
            </a>
          </div>
        )}

        {/* 2. Rotating Hero Card */}
        {heroArticle && (
          <div style={{ margin: isDesktop ? "16px auto" : "12px 18px", maxWidth: isDesktop ? 760 : undefined }}>
            <a
              href={heroArticle.external_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none", color: "inherit", display: "block", background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8", overflow: "hidden",
                transition: "opacity 0.35s ease, transform 0.35s ease",
                opacity: isTransitioning ? 0 : 1,
                transform: isTransitioning ? "translateY(-16px)" : "translateY(0)",
              }}
            >
              {heroArticle.image_url && (
                <img src={heroArticle.image_url} alt={heroArticle.title} style={{ width: "100%", height: isDesktop ? 260 : 180, objectFit: "cover", display: "block" }} />
              )}
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  {heroArticle.category && <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#D73F09" }}>{heroArticle.category}</span>}
                  {heroArticle.publication && <span style={{ fontSize: 10, color: "#aaa", fontWeight: 600 }}>{heroArticle.publication}</span>}
                </div>
                <h3 style={{ fontSize: isDesktop ? 20 : 16, fontWeight: 900, color: "#111", lineHeight: 1.25, margin: "0 0 6px" }}>{heroArticle.title}</h3>
                {heroArticle.excerpt && <p style={{ fontSize: 12, color: "#666", lineHeight: 1.55, margin: "0 0 12px" }}>{excerpt(heroArticle.excerpt)}</p>}
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#D73F09", letterSpacing: "0.1em" }}>Read Article →</span>
              </div>
            </a>

            {/* Dot indicators */}
            {rotatingArticles.length > 1 && (
              <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12, marginBottom: 4 }}>
                {rotatingArticles.map((_, i) => (
                  <button key={i} onClick={() => goTo(i)} style={{ width: i === safeIdx ? 14 : 6, height: 6, borderRadius: 2, background: i === safeIdx ? "#D73F09" : "rgba(0,0,0,0.2)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Latest Coverage List */}
        {latestList.length > 0 && (
          <>
            <div style={{ padding: "20px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", color: "#111" }}>Latest Coverage</span>
              <span style={{ fontSize: 10, color: "#aaa" }}>{listArticles.length} articles</span>
            </div>
            <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {latestList.map(a => (
                <a
                  key={a.id}
                  href={a.external_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={a.id === droppedId ? "slide-in-bottom" : ""}
                  style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12, padding: 12, alignItems: "flex-start", background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8" }}
                >
                  {a.image_url ? (
                    <img src={a.image_url} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 72, height: 72, borderRadius: 8, background: "#f0f0f0", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#ccc" }}>{a.title.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {a.category && <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#D73F09", marginBottom: 4 }}>{a.category}</div>}
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#111", lineHeight: 1.3, marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{a.title}</div>
                    {a.publication && <div style={{ fontSize: 10, color: "#aaa", fontWeight: 600 }}>{a.publication}</div>}
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

        {/* 4. More Coverage Grid */}
        {gridList.length > 0 && (
          <>
            <div style={{ padding: "20px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", color: "#111" }}>More Coverage</span>
            </div>
            <div style={{ padding: "0 18px 28px", display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: 10 }}>
              {gridList.map(a => (
                <a key={a.id} href={a.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8", overflow: "hidden", display: "block" }}>
                  {a.image_url ? (
                    <img src={a.image_url} alt="" style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                  ) : (
                    <div style={{ width: "100%", height: 90, background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: "#ddd" }}>{a.title.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div style={{ padding: 10 }}>
                    {a.category && <div style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", color: "#D73F09", marginBottom: 3 }}>{a.category}</div>}
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#111", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{a.title}</div>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
