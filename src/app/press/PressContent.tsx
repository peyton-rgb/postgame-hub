"use client";

import { useState } from "react";
import Link from "next/link";
import type { PressArticle } from "@/lib/types";

const DATE_FILTERS = [
  { label: "All", value: "all" },
  { label: "This Month", value: "month" },
  { label: "Last 3 Months", value: "3months" },
  { label: "Last 6 Months", value: "6months" },
  { label: "This Year", value: "year" },
];

function isWithinRange(dateStr: string, filter: string): boolean {
  if (filter === "all") return true;
  const d = new Date(dateStr);
  const now = new Date();
  switch (filter) {
    case "month": return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    case "3months": { const c = new Date(); c.setMonth(c.getMonth() - 3); return d >= c; }
    case "6months": { const c = new Date(); c.setMonth(c.getMonth() - 6); return d >= c; }
    case "year": return d.getFullYear() === now.getFullYear();
    default: return true;
  }
}

export default function PressContent({ articles }: { articles: PressArticle[] }) {
  const [filter, setFilter] = useState("all");

  const dated = articles.filter((a) => a.published_date)
    .sort((a, b) => new Date(b.published_date!).getTime() - new Date(a.published_date!).getTime());
  const undated = articles.filter((a) => !a.published_date);
  const filteredDated = filter === "all" ? dated : dated.filter((a) => isWithinRange(a.published_date!, filter));
  const filteredUndated = filter === "all" ? undated : [];
  const featured = filteredDated[0] || null;
  const rest = [...filteredDated.slice(1), ...filteredUndated];

  const fmt = (s: string) => new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const Logo = (article: PressArticle, size: "sm" | "lg") => {
    if (!article.show_logo) return null;
    const h = size === "lg" ? 28 : 20;
    const side = article.logo_position === "bottom-right" ? { right: 12 } : { left: 12 };
    return (
      <div style={{ position: "absolute", bottom: 12, ...side, display: "flex", alignItems: "center", gap: 6, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
        <img src="/postgame-logo-white.png" alt="Postgame" style={{ height: h, objectFit: "contain" }} />
        {article.brand_logo_url && <><span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700 }}>&times;</span><img src={article.brand_logo_url} alt="" style={{ height: h, objectFit: "contain" }} /></>}
      </div>
    );
  };

  return (
    <>
      {/* Filters */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 48 }}>
        {DATE_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)} style={{ padding: "8px 20px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, transition: "all 0.15s", background: filter === f.value ? "#D73F09" : "#141414", color: filter === f.value ? "#fff" : "rgba(255,255,255,0.55)" }}>
            {f.label}
          </button>
        ))}
      </div>

      {!featured && rest.length === 0 && <p style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", padding: "64px 0" }}>No articles found for this period.</p>}

      {/* Featured */}
      {featured && (
        <section style={{ marginBottom: 64 }}>
          <span style={{ display: "inline-block", background: "#D73F09", color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 12px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>Latest</span>
          <Link href={featured.url || "#"} target="_blank" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, textDecoration: "none", color: "inherit" }}>
            <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#141414" }}>
              {featured.image_url
                ? <img src={featured.image_url} alt={featured.title} style={{ width: "100%", height: 360, objectFit: "cover", display: "block" }} />
                : <div style={{ width: "100%", height: 360, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "rgba(255,255,255,0.2)", fontSize: 14 }}>No image</span></div>
              }
              {Logo(featured, "lg")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                {featured.category && <span style={{ color: "#D73F09", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>{featured.category}</span>}
                {featured.published_date && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{fmt(featured.published_date)}</span>}
              </div>
              <h2 style={{ fontSize: "clamp(24px,3vw,36px)", fontWeight: 800, lineHeight: 1.15, margin: "0 0 16px", color: "#fff" }}>{featured.title}</h2>
              {featured.description && <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>{featured.description}</p>}
              <div style={{ marginTop: 24, color: "#D73F09", fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>Read Article →</div>
            </div>
          </Link>
        </section>
      )}

      {rest.length > 0 && <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: 48 }} />}

      {/* Grid */}
      {rest.length > 0 && (
        <div style={{ columns: 3, columnGap: 20 }}>
          {rest.map((a) => (
            <Link key={a.id} href={a.url || "#"} target="_blank" style={{ display: "block", breakInside: "avoid", marginBottom: 20, textDecoration: "none", color: "inherit" }}>
              <div style={{ borderRadius: 14, overflow: "hidden", background: "#141414", border: "1px solid rgba(255,255,255,0.08)", transition: "border-color 0.2s, transform 0.2s" }}>
                {a.image_url && (
                  <div style={{ position: "relative" }}>
                    <img src={a.image_url} alt={a.title} style={{ width: "100%", display: "block" }} />
                    {Logo(a, "sm")}
                  </div>
                )}
                <div style={{ padding: "16px 20px 20px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    {a.category && <span style={{ color: "#D73F09", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>{a.category}</span>}
                    {a.published_date && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{fmt(a.published_date)}</span>}
                  </div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: "#fff", margin: 0 }}>{a.title}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
