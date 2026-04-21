"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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

// ---------------------------------------------------------------------------
// Best-In-Class layout planner
// ---------------------------------------------------------------------------
//
// Classifies each item's orientation from its loaded image dimensions, then
// builds a sequence of "featured rows" (horizontal-video arrangements) and a
// trailing masonry flow for everything else. Featured rows are always
// gap-free: every slot is filled before the row is committed.

type Orientation = "horizontal" | "vertical" | "square" | "unknown" | "broken";

type FeaturedRow =
  | { kind: "solo_full"; item: InspoItem }
  | { kind: "h_plus_tall_v"; h: InspoItem; v: InspoItem }
  | { kind: "h_plus_stacked_vs"; h: InspoItem; v1: InspoItem; v2: InspoItem }
  | { kind: "h_pair"; left: InspoItem; right: InspoItem };

type LayoutBlock =
  | { type: "featured"; row: FeaturedRow }
  | { type: "flow"; items: InspoItem[] };

const PAIRING_WINDOW = 6;

function classify(w: number, h: number): Orientation {
  if (!w || !h) return "unknown";
  const r = w / h;
  if (r >= 1.2) return "horizontal";
  if (r <= 0.85) return "vertical";
  return "square";
}

/**
 * Walk the items in feed order and plan the layout. Each horizontal video
 * gets a chance to become a featured row by pairing with nearby verticals
 * within PAIRING_WINDOW slots ahead of it in the feed. If no suitable
 * partners exist nearby, a lone horizontal becomes a solo full-width row.
 * Two adjacent (within the window) horizontals can pair with each other
 * regardless of verticals. Items consumed by a featured row are removed
 * from the flow; everything else renders into the trailing masonry.
 */
function planLayout(items: InspoItem[], orient: Map<string, Orientation>): LayoutBlock[] {
  const blocks: LayoutBlock[] = [];
  const consumed = new Set<string>();
  let flow: InspoItem[] = [];

  const flush = () => {
    if (flow.length) {
      blocks.push({ type: "flow", items: flow });
      flow = [];
    }
  };

  const getO = (it: InspoItem) => orient.get(it.id) ?? "unknown";

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (consumed.has(it.id)) continue;
    if (getO(it) !== "horizontal") {
      flow.push(it);
      continue;
    }

    // Look ahead within the window for a pairing partner, skipping consumed.
    const windowEnd = Math.min(items.length, i + 1 + PAIRING_WINDOW);
    const nearby: InspoItem[] = [];
    for (let j = i + 1; j < windowEnd; j++) {
      if (!consumed.has(items[j].id)) nearby.push(items[j]);
    }

    const nearbyHorizontals = nearby.filter((x) => getO(x) === "horizontal");
    const nearbyVerticals = nearby.filter((x) => getO(x) === "vertical");

    // Preferred: pair with another horizontal inside the window.
    if (nearbyHorizontals.length >= 1) {
      const partner = nearbyHorizontals[0];
      flush();
      blocks.push({ type: "featured", row: { kind: "h_pair", left: it, right: partner } });
      consumed.add(it.id);
      consumed.add(partner.id);
      continue;
    }

    // Next: horizontal with two stacked verticals (matched heights).
    if (nearbyVerticals.length >= 2) {
      const [v1, v2] = nearbyVerticals;
      flush();
      blocks.push({ type: "featured", row: { kind: "h_plus_stacked_vs", h: it, v1, v2 } });
      consumed.add(it.id);
      consumed.add(v1.id);
      consumed.add(v2.id);
      continue;
    }

    // Next: horizontal with one tall vertical.
    if (nearbyVerticals.length === 1) {
      const v = nearbyVerticals[0];
      flush();
      blocks.push({ type: "featured", row: { kind: "h_plus_tall_v", h: it, v } });
      consumed.add(it.id);
      consumed.add(v.id);
      continue;
    }

    // Fallback: solo full-width horizontal. Still gap-free — it's the entire row.
    flush();
    blocks.push({ type: "featured", row: { kind: "solo_full", item: it } });
    consumed.add(it.id);
  }

  flush();
  return blocks;
}

// Fixed featured-row height (px). 16:9 at half the masonry width (~600px total
// container / 2 per row) sits around ~180px tall; we bump it a bit to give the
// featured treatment real visual weight and to leave breathing room for cards
// with badges/tags.
const FEATURED_ROW_HEIGHT = 260;

function FeaturedSlot({ item, rowHeight }: { item: InspoItem; rowHeight: number }) {
  // Wrap InspoCard in a fixed-height box and force the image inside to cover
  // the box. InspoCard stays untouched — we only constrain its container.
  return (
    <div
      style={{
        height: rowHeight,
        overflow: "hidden",
        borderRadius: "var(--r-md)",
      }}
      className="best-featured-slot"
    >
      <InspoCard item={item} />
    </div>
  );
}

function FeaturedRowView({ row }: { row: FeaturedRow }) {
  // DIAGNOSTIC — temporary
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[inspo-grid] FeaturedRowView render:", {
      kind: row.kind,
      slots:
        row.kind === "solo_full" ? [row.item.athlete_name || row.item.id]
        : row.kind === "h_pair" ? [row.left.athlete_name || row.left.id, row.right.athlete_name || row.right.id]
        : row.kind === "h_plus_tall_v" ? [row.h.athlete_name || row.h.id, row.v.athlete_name || row.v.id]
        : [row.h.athlete_name || row.h.id, row.v1.athlete_name || row.v1.id, row.v2.athlete_name || row.v2.id],
    });
  }
  const gap = 12;
  const rowStyle: React.CSSProperties = {
    display: "grid",
    gap,
    marginBottom: 12,
  };
  if (row.kind === "solo_full") {
    return (
      <div style={{ ...rowStyle, gridTemplateColumns: "1fr" }}>
        <FeaturedSlot item={row.item} rowHeight={FEATURED_ROW_HEIGHT} />
      </div>
    );
  }
  if (row.kind === "h_pair") {
    return (
      <div style={{ ...rowStyle, gridTemplateColumns: "1fr 1fr" }}>
        <FeaturedSlot item={row.left} rowHeight={FEATURED_ROW_HEIGHT} />
        <FeaturedSlot item={row.right} rowHeight={FEATURED_ROW_HEIGHT} />
      </div>
    );
  }
  if (row.kind === "h_plus_tall_v") {
    return (
      <div style={{ ...rowStyle, gridTemplateColumns: "1fr 1fr" }}>
        <FeaturedSlot item={row.h} rowHeight={FEATURED_ROW_HEIGHT} />
        <FeaturedSlot item={row.v} rowHeight={FEATURED_ROW_HEIGHT} />
      </div>
    );
  }
  // h_plus_stacked_vs: left half = horizontal, right half = two stacked verticals,
  // each vertical is (rowHeight - gap) / 2 so the stack matches the left height.
  const halfHeight = (FEATURED_ROW_HEIGHT - gap) / 2;
  return (
    <div style={{ ...rowStyle, gridTemplateColumns: "1fr 1fr" }}>
      <FeaturedSlot item={row.h} rowHeight={FEATURED_ROW_HEIGHT} />
      <div style={{ display: "grid", gap, gridTemplateRows: `${halfHeight}px ${halfHeight}px` }}>
        <FeaturedSlot item={row.v1} rowHeight={halfHeight} />
        <FeaturedSlot item={row.v2} rowHeight={halfHeight} />
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

  // ── Orientation probe ──
  // Preload each item's thumbnail in a detached Image() and record its
  // orientation when it resolves. Items we haven't measured yet stay
  // "unknown" and render in the normal masonry flow until their image lands.
  const [orientations, setOrientations] = useState<Record<string, Orientation>>({});
  useEffect(() => {
    let cancelled = false;
    for (const item of gridItems) {
      if (orientations[item.id]) continue;
      const src = item.thumbnail_url || item.file_url;
      if (!src) {
        // No image at all — mark broken so the planner won't feature it.
        setOrientations((prev) => prev[item.id] ? prev : { ...prev, [item.id]: "broken" });
        continue;
      }
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setOrientations((prev) =>
          prev[item.id] ? prev : { ...prev, [item.id]: classify(img.naturalWidth, img.naturalHeight) }
        );
      };
      img.onerror = () => {
        if (cancelled) return;
        setOrientations((prev) => prev[item.id] ? prev : { ...prev, [item.id]: "broken" });
      };
      img.src = src;
    }
    return () => { cancelled = true; };
  }, [gridItems]);

  const orientationMap = useMemo(() => {
    const m = new Map<string, Orientation>();
    for (const [k, v] of Object.entries(orientations)) m.set(k, v);
    return m;
  }, [orientations]);

  const layoutBlocks = useMemo(
    () => planLayout(gridItems, orientationMap),
    [gridItems, orientationMap]
  );

  // ── DIAGNOSTIC LOGGING (temporary — remove once root cause found) ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const orientDump: Record<string, { orientation: Orientation | "unknown"; name: string; thumb: string | null }> = {};
    for (const it of gridItems) {
      orientDump[it.id] = {
        orientation: orientationMap.get(it.id) ?? "unknown",
        name: it.athlete_name || it.visual_description?.slice(0, 40) || "(untitled)",
        thumb: it.thumbnail_url || it.file_url || null,
      };
    }
    const blockDump = layoutBlocks.map((b, i) => {
      if (b.type === "flow") return { idx: i, type: "flow", count: b.items.length, firstFew: b.items.slice(0, 3).map((x) => x.athlete_name || x.id.slice(0, 8)) };
      const r = b.row;
      if (r.kind === "solo_full") return { idx: i, type: "featured", kind: r.kind, item: r.item.athlete_name || r.item.id };
      if (r.kind === "h_pair") return { idx: i, type: "featured", kind: r.kind, left: r.left.athlete_name || r.left.id, right: r.right.athlete_name || r.right.id };
      if (r.kind === "h_plus_tall_v") return { idx: i, type: "featured", kind: r.kind, h: r.h.athlete_name || r.h.id, v: r.v.athlete_name || r.v.id };
      return { idx: i, type: "featured", kind: r.kind, h: r.h.athlete_name || r.h.id, v1: r.v1.athlete_name || r.v1.id, v2: r.v2.athlete_name || r.v2.id };
    });
    // eslint-disable-next-line no-console
    console.log("[inspo-grid] orientations:", orientDump);
    // eslint-disable-next-line no-console
    console.log("[inspo-grid] layoutBlocks:", blockDump);
  }, [layoutBlocks, orientationMap, gridItems]);

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

      {/* ── Best-In-Class Grid ── */}
      {gridItems.length > 0 ? (
        <div>
          {layoutBlocks.map((block, idx) =>
            block.type === "featured" ? (
              <FeaturedRowView key={`feat-${idx}`} row={block.row} />
            ) : (
              <div
                key={`flow-${idx}`}
                style={{ columnCount: 4, columnGap: 12, marginBottom: 12 }}
              >
                {block.items.map((item) => (
                  <InspoCard key={item.id} item={item} />
                ))}
              </div>
            )
          )}
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

      {/* Spin animation for search indicator + featured-slot sizing */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
        .best-featured-slot > div {
          margin-bottom: 0 !important;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .best-featured-slot > div > div:first-child {
          flex: 1;
          min-height: 0;
        }
        .best-featured-slot > div > div:first-child > img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          min-height: 0 !important;
        }
        /* NO-PREVIEW fallback: if InspoCard renders a text div instead of an
           <img>, make it fill the slot so the dark bg shows edge-to-edge
           rather than leaving black page-bg void below a short fallback box. */
        .best-featured-slot > div > div:first-child > div {
          width: 100%;
          height: 100% !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
