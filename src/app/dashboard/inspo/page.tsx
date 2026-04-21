"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InspoItem {
  id: string;
  thumbnail_url: string | null;
  file_url: string | null;
  content_type: string | null;
  source: string | null;
  sport: string | null;
  school: string | null;
  athlete_name: string | null;
  visual_description: string | null;
  triage_status: string | null;
  tagging_status: string | null;
  performance_tier: string | null;
  context_tags: Record<string, string> | null;
  social_tags: Record<string, unknown> | null;
  pro_tags: Record<string, string> | null;
  search_phrases: string[] | null;
  brief_fit: string[] | null;
  created_at: string | null;
  brand_id: string | null;
  campaign_id: string | null;
  // joined
  brands?: { id: string; name: string; logo_light_url: string | null; logo_url: string | null } | null;
}

interface Brand {
  id: string;
  name: string;
  logo_light_url: string | null;
  logo_url: string | null;
}

type ContentType = "produced" | "athlete_ugc" | "bts" | "raw_footage" | "photography" | "talking_head" | "inspo_external";
type Source = "inspo" | "produced_catalog" | "live_athlete_post";
type PerfTier = "top" | "solid" | "learning" | "unscored";

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  produced: "Produced",
  athlete_ugc: "Athlete UGC",
  bts: "BTS",
  raw_footage: "Raw Footage",
  photography: "Photography",
  talking_head: "Talking Head",
  inspo_external: "External Inspo",
};

const SOURCE_LABELS: Record<Source, string> = {
  inspo: "Inspo",
  produced_catalog: "Produced Catalog",
  live_athlete_post: "Live Post",
};

const TIER_LABELS: Record<PerfTier, string> = {
  top: "Top",
  solid: "Solid",
  learning: "Learning",
  unscored: "Unscored",
};

const TIER_COLORS: Record<PerfTier, string> = {
  top: "#22c55e",
  solid: "#3b82f6",
  learning: "#f59e0b",
  unscored: "rgba(255,255,255,0.3)",
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  produced: "#D73F09",
  athlete_ugc: "#8b5cf6",
  bts: "#f59e0b",
  raw_footage: "#6b7280",
  photography: "#ec4899",
  talking_head: "#14b8a6",
  inspo_external: "#3b82f6",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull up to 3 interesting AI tags from the item for display. */
function getTopTags(item: InspoItem): string[] {
  const tags: string[] = [];
  const ctx = item.context_tags;
  if (ctx?.mood) tags.push(ctx.mood);
  if (ctx?.setting) tags.push(ctx.setting);
  const social = item.social_tags as Record<string, unknown> | null;
  if (social?.hook_style) tags.push(String(social.hook_style));
  if (tags.length < 3 && ctx?.lighting) tags.push(ctx.lighting);
  if (tags.length < 3 && item.sport) tags.push(item.sport);
  return tags.slice(0, 3);
}

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FilterBar({
  brands,
  filters,
  onFilterChange,
  searchQuery,
  onSearch,
  searching,
}: {
  brands: Brand[];
  filters: { brand_id: string; content_type: string; source: string; performance_tier: string };
  onFilterChange: (key: string, value: string) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  searching: boolean;
}) {
  const selectStyle: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: "var(--r-sm)",
    color: "var(--text-2)",
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "Arial, sans-serif",
    padding: "8px 12px",
    outline: "none",
    cursor: "pointer",
    minWidth: 130,
  };

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      {/* Search */}
      <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 340 }}>
        <input
          type="text"
          placeholder="Search content..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            ...selectStyle,
            width: "100%",
            paddingLeft: 36,
            minWidth: 0,
            color: "var(--text)",
          }}
        />
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        {searching && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, border: "2px solid var(--text-3)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        )}
      </div>

      {/* Brand */}
      <select style={selectStyle} value={filters.brand_id} onChange={(e) => onFilterChange("brand_id", e.target.value)}>
        <option value="">All Brands</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>

      {/* Content Type */}
      <select style={selectStyle} value={filters.content_type} onChange={(e) => onFilterChange("content_type", e.target.value)}>
        <option value="">All Types</option>
        {Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Source */}
      <select style={selectStyle} value={filters.source} onChange={(e) => onFilterChange("source", e.target.value)}>
        <option value="">All Sources</option>
        {Object.entries(SOURCE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>

      {/* Performance Tier */}
      <select style={selectStyle} value={filters.performance_tier} onChange={(e) => onFilterChange("performance_tier", e.target.value)}>
        <option value="">All Tiers</option>
        {Object.entries(TIER_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  );
}

function TriageCard({
  item,
  onApprove,
  onReject,
}: {
  item: InspoItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const brandName = item.brands?.name ?? "Unknown Brand";
  const thumb = item.thumbnail_url || item.file_url;

  return (
    <div
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        display: "flex",
        gap: 0,
        minHeight: 100,
        transition: "border-color 0.15s, background 0.15s",
      }}
      className="glass-hover"
    >
      {/* Thumbnail */}
      <div style={{ width: 120, minHeight: 100, background: "var(--bg-3)", flexShrink: 0, position: "relative" }}>
        {thumb ? (
          <img src={thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)", fontSize: 11, fontWeight: 700 }}>
            NO THUMB
          </div>
        )}
        {item.tagging_status === "processing" && (
          <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.7)", borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700, color: "#f59e0b" }}>
            TAGGING...
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.athlete_name || "Unnamed"}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap" }}>
            {brandName}
          </span>
        </div>
        {item.visual_description && (
          <p style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {item.visual_description}
          </p>
        )}
        <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
          <button
            onClick={() => onApprove(item.id)}
            style={{ padding: "5px 14px", fontSize: 11, fontWeight: 800, fontFamily: "Arial, sans-serif", background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Approve
          </button>
          <button
            onClick={() => onReject(item.id)}
            style={{ padding: "5px 14px", fontSize: 11, fontWeight: 800, fontFamily: "Arial, sans-serif", background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function InspoCard({ item }: { item: InspoItem }) {
  const brandName = item.brands?.name ?? "";
  const thumb = item.thumbnail_url || item.file_url;
  const topTags = getTopTags(item);
  const ctColor = CONTENT_TYPE_COLORS[item.content_type ?? ""] ?? "var(--text-3)";
  const tierColor = TIER_COLORS[(item.performance_tier as PerfTier) ?? "unscored"] ?? "var(--text-4)";

  return (
    <div
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        transition: "border-color 0.15s, background 0.15s, transform 0.15s",
        cursor: "pointer",
        breakInside: "avoid",
        marginBottom: 12,
      }}
      className="glass-hover"
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", background: "var(--bg-3)" }}>
        {thumb ? (
          <img
            src={thumb}
            alt={item.visual_description || ""}
            style={{ width: "100%", display: "block", minHeight: 120, objectFit: "cover" }}
            loading="lazy"
          />
        ) : (
          <div style={{ width: "100%", height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-4)", fontSize: 12, fontWeight: 700, letterSpacing: "0.05em" }}>
            NO PREVIEW
          </div>
        )}

        {/* Content type badge */}
        {item.content_type && (
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            borderRadius: 6, padding: "3px 8px",
            fontSize: 10, fontWeight: 800, fontFamily: "Arial, sans-serif",
            color: ctColor, textTransform: "uppercase", letterSpacing: "0.05em",
            border: `1px solid ${ctColor}33`,
          }}>
            {CONTENT_TYPE_LABELS[item.content_type as ContentType] ?? item.content_type}
          </div>
        )}

        {/* Performance tier dot */}
        {item.performance_tier && item.performance_tier !== "unscored" && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            width: 10, height: 10, borderRadius: "50%",
            background: tierColor,
            boxShadow: `0 0 6px ${tierColor}`,
            border: "1.5px solid rgba(0,0,0,0.4)",
          }}
            title={`Performance: ${TIER_LABELS[item.performance_tier as PerfTier] ?? item.performance_tier}`}
          />
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "10px 12px 12px" }}>
        {/* Brand name */}
        {brandName && (
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            {brandName}
          </div>
        )}

        {/* Athlete / title */}
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", lineHeight: 1.3, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.athlete_name || item.visual_description?.slice(0, 50) || "Untitled"}
        </div>

        {/* AI tags */}
        {topTags.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {topTags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10, fontWeight: 700, fontFamily: "Arial, sans-serif",
                  color: "var(--text-3)",
                  background: "var(--glass-bg-2)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 6, padding: "2px 7px",
                  textTransform: "lowercase",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const SELECT_FIELDS = `
  id, thumbnail_url, file_url, content_type, source, sport, school,
  athlete_name, visual_description, triage_status, tagging_status,
  performance_tier, context_tags, social_tags, pro_tags, search_phrases,
  brief_fit, created_at, brand_id, campaign_id,
  brands ( id, name, logo_light_url, logo_url )
`.replace(/\s+/g, " ").trim();

export default function InspoLibrary() {
  const supabase = createBrowserSupabase();

  // Data
  const [triageItems, setTriageItems] = useState<InspoItem[]>([]);
  const [approvedItems, setApprovedItems] = useState<InspoItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState({ brand_id: "", content_type: "", source: "", performance_tier: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<InspoItem[] | null>(null);

  // Counts
  const [triageCount, setTriageCount] = useState(0);

  // ── Load brands ──
  useEffect(() => {
    supabase
      .from("brands")
      .select("id, name, logo_light_url, logo_url")
      .eq("archived", false)
      .order("name")
      .then(({ data }) => setBrands(data || []));
  }, []);

  // ── Load triage queue ──
  const loadTriage = useCallback(async () => {
    const { data, count } = await supabase
      .from("inspo_items")
      .select(SELECT_FIELDS, { count: "exact" })
      .eq("triage_status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    setTriageItems((data as unknown as InspoItem[]) || []);
    setTriageCount(count ?? 0);
  }, []);

  // ── Load approved items (with filters) ──
  const loadApproved = useCallback(async () => {
    let query = supabase
      .from("inspo_items")
      .select(SELECT_FIELDS)
      .eq("triage_status", "approved")
      .order("created_at", { ascending: false })
      .limit(60);

    if (filters.brand_id) query = query.eq("brand_id", filters.brand_id);
    if (filters.content_type) query = query.eq("content_type", filters.content_type);
    if (filters.source) query = query.eq("source", filters.source);
    if (filters.performance_tier) query = query.eq("performance_tier", filters.performance_tier);

    const { data } = await query;
    setApprovedItems((data as unknown as InspoItem[]) || []);
  }, [filters]);

  // ── Initial load ──
  useEffect(() => {
    Promise.all([loadTriage(), loadApproved()]).then(() => setLoading(false));
  }, []);

  // ── Reload approved when filters change ──
  useEffect(() => {
    if (!loading) loadApproved();
  }, [filters]);

  // ── Search (debounced) ──
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, limit: 30 }),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results ?? []);
        }
      } catch {
        // fall back to client-side text match
        const q = searchQuery.toLowerCase();
        const matched = approvedItems.filter(
          (item) =>
            item.athlete_name?.toLowerCase().includes(q) ||
            item.visual_description?.toLowerCase().includes(q) ||
            item.search_phrases?.some((p) => p.toLowerCase().includes(q)) ||
            item.sport?.toLowerCase().includes(q)
        );
        setSearchResults(matched);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Triage actions ──
  async function handleTriage(id: string, status: "approved" | "rejected") {
    await supabase.from("inspo_items").update({ triage_status: status }).eq("id", id);
    setTriageItems((prev) => prev.filter((i) => i.id !== id));
    setTriageCount((c) => Math.max(0, c - 1));
    if (status === "approved") loadApproved();
  }

  // ── Filter change ──
  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  // ── Which items to show in the grid ──
  const gridItems = searchResults ?? approvedItems;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-3)", fontSize: 14, fontWeight: 700 }}>Loading Inspo Library...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "0 32px 64px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "28px 0 20px", borderBottom: "1px solid var(--glass-border)", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <h1 className="d" style={{ fontSize: 36, letterSpacing: "0.02em", lineHeight: 1, color: "var(--text)" }}>
            Inspo Library
          </h1>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Content Engine
          </span>
        </div>
        <Link
          href="/dashboard"
          style={{
            fontSize: 12, fontWeight: 800, fontFamily: "Arial, sans-serif",
            color: "var(--text-3)", textDecoration: "none",
            padding: "8px 16px",
            border: "1px solid var(--glass-border)",
            borderRadius: "var(--r-sm)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            transition: "color 0.15s, border-color 0.15s",
          }}
          className="glass-hover"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* ── Triage Queue ── */}
      {triageCount > 0 && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <h2 className="d" style={{ fontSize: 22, letterSpacing: "0.03em", color: "var(--text)" }}>
              Triage Queue
            </h2>
            <span style={{
              fontSize: 11, fontWeight: 800, fontFamily: "Arial, sans-serif",
              background: "var(--orange-dim)", color: "var(--orange)",
              border: "1px solid var(--orange-glow)",
              borderRadius: 20, padding: "2px 10px",
            }}>
              {triageCount} pending
            </span>
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 10,
          }}>
            {triageItems.map((item) => (
              <TriageCard
                key={item.id}
                item={item}
                onApprove={(id) => handleTriage(id, "approved")}
                onReject={(id) => handleTriage(id, "rejected")}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Filters ── */}
      <section style={{ marginBottom: 24 }}>
        <FilterBar
          brands={brands}
          filters={filters}
          onFilterChange={handleFilterChange}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          searching={searching}
        />
      </section>

      {/* ── Search indicator ── */}
      {searchResults !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Search results: {searchResults.length}
          </span>
          <button
            onClick={() => { setSearchQuery(""); setSearchResults(null); }}
            style={{
              fontSize: 11, fontWeight: 800, fontFamily: "Arial, sans-serif",
              color: "var(--text-3)", background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)", borderRadius: 6,
              padding: "3px 10px", cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Masonry Grid ── */}
      {gridItems.length > 0 ? (
        <div
          style={{
            columnCount: 4,
            columnGap: 12,
          }}
        >
          {gridItems.map((item) => (
            <InspoCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block" }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-3)" }}>
              {searchResults !== null ? "No results found" : "No approved content yet"}
            </p>
            <p style={{ fontSize: 12, color: "var(--text-4)", marginTop: 6 }}>
              {searchResults !== null ? "Try a different search term" : "Approve items from the triage queue above"}
            </p>
          </div>
        </div>
      )}

      {/* Spin animation for search indicator */}
      <style jsx>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
