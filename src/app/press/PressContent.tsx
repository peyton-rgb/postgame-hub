"use client";

import { useState, useEffect, useMemo } from "react";
import type { PressArticle } from "@/lib/types";

const CHIPS = ["All", "NIL", "Brands", "Athletes", "Media", "Forbes", "Agency"];

export default function PressContent({ articles }: { articles: PressArticle[] }) {
  const [chip, setChip] = useState("All");
  const [isDesktop, setIsDesktop] = useState(false);

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

  const featuredArticle = filtered.find(a => a.featured) || filtered[0] || null;
  const rest = filtered.filter(a => a !== featuredArticle);
  const latest = rest.slice(0, 4);
  const grid = rest.slice(4);

  const excerpt = (s: string | null, len = 120) => {
    if (!s) return "";
    return s.length > len ? s.slice(0, len).trimEnd() + "..." : s;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0", fontFamily: "Arial,Helvetica,sans-serif" }}>
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

        {/* Featured Article */}
        {featuredArticle && (
          <div style={{ margin: isDesktop ? "24px auto" : "16px 18px", maxWidth: isDesktop ? 760 : undefined }}>
            <a href={featuredArticle.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block", background: "#fff", borderRadius: 14, border: "1px solid #e8e8e8", overflow: "hidden" }}>
              {featuredArticle.image_url && (
                <img src={featuredArticle.image_url} alt={featuredArticle.title} style={{ width: "100%", height: isDesktop ? 320 : 220, objectFit: "cover", display: "block" }} />
              )}
              <div style={{ padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", background: "#D73F09", color: "#fff", padding: "3px 8px", borderRadius: 4 }}>Featured</span>
                  {featuredArticle.publication && <span style={{ fontSize: 10, color: "#aaa", fontWeight: 600 }}>{featuredArticle.publication}</span>}
                </div>
                <h2 style={{ fontSize: isDesktop ? 22 : 17, fontWeight: 900, color: "#111", lineHeight: 1.25, margin: "0 0 8px" }}>{featuredArticle.title}</h2>
                {featuredArticle.excerpt && <p style={{ fontSize: 12, color: "#666", lineHeight: 1.55, margin: "0 0 14px" }}>{excerpt(featuredArticle.excerpt)}</p>}
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: "#D73F09", letterSpacing: "0.1em" }}>Read Article →</span>
              </div>
            </a>
          </div>
        )}

        {/* Latest Coverage */}
        {latest.length > 0 && (
          <>
            <div style={{ padding: "20px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", color: "#111" }}>Latest Coverage</span>
              <span style={{ fontSize: 10, color: "#aaa" }}>{rest.length} articles</span>
            </div>
            <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {latest.map(a => (
                <a key={a.id} href={a.external_url || "#"} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12, padding: 12, alignItems: "flex-start", background: "#fff", borderRadius: 12, border: "1px solid #e8e8e8" }}>
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

        {/* More Coverage Grid */}
        {grid.length > 0 && (
          <>
            <div style={{ padding: "20px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", color: "#111" }}>More Coverage</span>
            </div>
            <div style={{ padding: "0 18px 28px", display: "grid", gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "repeat(2, 1fr)", gap: 10 }}>
              {grid.map(a => (
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
