"use client";

import { useMemo, useState } from "react";
import {
  ORANGE,
  OFFWHITE,
  CARD,
  CARD_B,
  RADIUS,
  BLUR,
  BEBAS,
  MONO,
  INK_BODY,
  INK_LABEL,
} from "@/lib/portal";
import AssetModal, { type PortalAthlete } from "./AssetModal";

export type LibraryTile = {
  id: string;
  campaignId: string;
  campaignName: string;
  athleteId: string | null;
  athleteName: string | null;
  // Display kind. The DB column is media.type ('image' | 'video') — it is
  // never 'photo'; the mapping to "photo" happens server-side for display.
  kind: "photo" | "video";
  thumb: string | null;
  fileUrl: string;
  createdAt: string | null;
};

export type LibraryCampaign = { id: string; name: string };

type MediaFilter = "all" | "photo" | "video";

// "top" is rendered but DISABLED. asset_metrics is empty and quality_score is
// null on every row, so there is no performance data to rank by. We keep the
// option visible (it returns when metrics land) and we do NOT quietly alias it
// to Newest — presenting an arbitrary order as a performance ranking is
// exactly what hard rule 6 forbids.
type SortMode = "newest" | "campaign";

type OpenState = { campaignId: string; index: number; postIndex: number };

export default function LibraryGallery({
  brandName,
  totalFiles,
  campaigns,
  tiles,
  athletesById,
  campaignAthletes,
  rowToAthlete,
}: {
  brandName: string;
  /** True media count for this brand, counted server-side. The tile fetch is
   *  capped at 1,000 rows, so tiles.length understated it. */
  totalFiles: number;
  campaigns: LibraryCampaign[];
  tiles: LibraryTile[];
  athletesById: Record<string, PortalAthlete>;
  campaignAthletes: Record<string, string[]>;
  rowToAthlete: Record<string, string>;
}) {
  const [media, setMedia] = useState<MediaFilter>("all");
  const [athlete, setAthlete] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [sort, setSort] = useState<SortMode>("campaign");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<OpenState | null>(null);

  // Clicking a tile opens its athlete's popup and selects the post the tile
  // belongs to: the tile's own row (athleteId) and side (photo -> feed,
  // video -> reel). Nav within the popup walks this campaign's distinct athletes.
  const openTile = (tile: LibraryTile) => {
    const rowId = tile.athleteId;
    if (!rowId) return;
    const gid = rowToAthlete[rowId];
    const athlete = gid ? athletesById[gid] : undefined;
    if (!gid || !athlete) return;
    const order = campaignAthletes[tile.campaignId] || [];
    const index = order.indexOf(gid);
    if (index < 0) return;

    const wantKind = tile.kind === "video" ? "reel" : "feed";
    let postIndex = athlete.posts.findIndex((p) => p.rowId === rowId && p.kind === wantKind);
    if (postIndex < 0) postIndex = athlete.posts.findIndex((p) => p.rowId === rowId);
    if (postIndex < 0) postIndex = 0;

    setOpen({ campaignId: tile.campaignId, index, postIndex });
  };

  const openAthletes = open
    ? (campaignAthletes[open.campaignId] || []).map((id) => athletesById[id]).filter(Boolean)
    : [];

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // When any filter/search is active, force every matching campaign open so the
  // narrowed results are actually visible; otherwise honor manual expansion.
  const filtersActive = media !== "all" || athlete !== "" || query.trim() !== "";

  // Athletes who appear in this brand's media, for the dropdown.
  //
  // DISPLAY-LAYER DEDUPE ONLY — no athlete row is modified. The same person
  // arrives under several spellings, and the dropdown listed each separately:
  //   · case      — "Brianna Nunley" and "BRIANNA NUNLEY"
  //   · whitespace — "Dillon Mitchell" and "Dillon Mitchell "
  //   · a trailing "(<brand>)", an internal name-collision marker that means
  //     nothing to a client and is redundant on that brand's own portal
  //
  // Only the brand's OWN name is stripped, never any trailing parenthetical —
  // "(Jr.)" or a genuine qualifier has to survive.
  const stripBrandSuffix = useMemo(() => {
    const escaped = brandName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\s*\\(\\s*${escaped}\\s*\\)\\s*$`, "i");
    return (n: string) => n.replace(re, "").trim();
  }, [brandName]);

  const athleteKeyOf = (n: string | null) =>
    n ? stripBrandSuffix(n).trim().toLowerCase() : "";

  const athleteOptions = useMemo(() => {
    // Prefer the best-cased spelling rather than whichever sorts first:
    // "Brianna Nunley" over "BRIANNA NUNLEY". More lowercase letters wins,
    // ties broken deterministically.
    const lowerCount = (v: string) => (v.match(/[a-z]/g) || []).length;
    const best = new Map<string, string>();
    for (const t of tiles) {
      if (!t.athleteName) continue;
      const display = stripBrandSuffix(t.athleteName);
      if (!display) continue;
      const key = display.toLowerCase();
      const prev = best.get(key);
      if (
        !prev ||
        lowerCount(display) > lowerCount(prev) ||
        (lowerCount(display) === lowerCount(prev) && display.localeCompare(prev) < 0)
      ) {
        best.set(key, display);
      }
    }
    return Array.from(best, ([key, label]) => ({ key, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [tiles, stripBrandSuffix]);

  // Apply filters to the flat tile list.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tiles.filter((t) => {
      if (media !== "all" && t.kind !== media) return false;
      if (athlete && athleteKeyOf(t.athleteName) !== athlete) return false;
      if (q) {
        const hay = `${t.campaignName} ${t.athleteName || ""} ${stripBrandSuffix(t.athleteName || "")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tiles, media, athlete, query]);

  // Group filtered tiles by campaign, preserving the server's campaign order,
  // and drop any section left empty by the filters.
  const sections = useMemo(() => {
    const byCampaign: Record<string, LibraryTile[]> = {};
    for (const t of filtered) {
      (byCampaign[t.campaignId] ||= []).push(t);
    }
    return campaigns
      .map((c) => ({ campaign: c, items: byCampaign[c.id] || [] }))
      .filter((s) => s.items.length > 0);
  }, [filtered, campaigns]);

  // Newest is a real sort — media.created_at is populated. Grouping by
  // campaign is the other real option.
  const newestTiles = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      ),
    [filtered],
  );

  const segButton = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-[3px] px-3.5 inline-flex items-center justify-center"
      style={{
        ...MONO,
        fontSize: 10,
        letterSpacing: ".14em",
        border: 0,
        cursor: "pointer",
        minHeight: 34,
        background: active ? "rgba(250,248,245,.11)" : "transparent",
        color: active ? OFFWHITE : INK_LABEL,
      }}
    >
      {label}
    </button>
  );

  const segWrap = (children: React.ReactNode) => (
    <div
      className="inline-flex p-[3px] rounded-[5px]"
      style={{ background: "rgba(250,248,245,.05)", border: `1px solid ${CARD_B}` }}
    >
      {children}
    </div>
  );

  return (
    <div>
      {/* Page head */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-6">
        <div>
          <div style={{ ...MONO, fontSize: 11, letterSpacing: ".18em", color: ORANGE }}>Assets</div>
          <h1
            className="uppercase mt-2.5"
            style={{ ...BEBAS, fontSize: "clamp(30px,5vw,40px)", lineHeight: 1, letterSpacing: ".012em" }}
          >
            {brandName} asset library
          </h1>
        </div>
        <div style={{ ...MONO, fontSize: 10, letterSpacing: ".16em", color: INK_LABEL }}>
          {filtered.length.toLocaleString()} of {totalFiles.toLocaleString()} files
        </div>
      </div>

      {/* Controls. At <=750px these wrap; if a row still overflows it scrolls
          with a visible fade affordance — never clipped by overflow:hidden. */}
      <div className="pv2-controls-wrap mb-8">
      <div className="pv2-controls flex flex-wrap items-center gap-3">
        {/* Type — real: media.type is 'image' | 'video' */}
        {segWrap(
          <>
            {segButton("Everything", media === "all", () => setMedia("all"))}
            {segButton("Photos", media === "photo", () => setMedia("photo"))}
            {segButton("Video", media === "video", () => setMedia("video"))}
          </>,
        )}

        {/* Sort — Newest and By campaign are real. Top performing is
            deliberately disabled, not hidden and not aliased. */}
        {segWrap(
          <>
            {segButton("Newest", sort === "newest", () => setSort("newest"))}
            {segButton("By campaign", sort === "campaign", () => setSort("campaign"))}
            <span
              aria-disabled="true"
              title="Awaiting verified data"
              className="rounded-[3px] px-3.5 inline-flex items-center justify-center gap-2 select-none cursor-not-allowed"
              style={{
                ...MONO,
                fontSize: 10,
                letterSpacing: ".14em",
                minHeight: 34,
                color: "rgba(250,248,245,.30)",
              }}
            >
              Top performing
            </span>
          </>,
        )}

        <span
          className="inline-block rounded-[3px] px-2 py-[5px]"
          style={{
            ...MONO,
            fontSize: 10,
            background: "rgba(250,248,245,.07)",
            border: `1px solid ${CARD_B}`,
            color: "rgba(250,248,245,.60)",
          }}
        >
          Top performing &mdash; awaiting verified data
        </span>

        <select
          value={athlete}
          onChange={(e) => setAthlete(e.target.value)}
          className="rounded-[4px] px-3 outline-none"
          style={{
            ...MONO,
            fontSize: 10,
            minHeight: 34,
            background: "rgba(250,248,245,.05)",
            color: OFFWHITE,
            border: `1px solid ${CARD_B}`,
          }}
        >
          <option value="">All athletes</option>
          {athleteOptions.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search campaign or athlete"
          aria-label="Search campaign or athlete"
          className="rounded-[4px] px-3 outline-none min-w-[220px] flex-1 max-w-[320px]"
          style={{
            fontSize: 16,
            minHeight: 34,
            background: "rgba(250,248,245,.05)",
            color: OFFWHITE,
            border: `1px solid ${CARD_B}`,
          }}
        />
      </div>
      </div>

      {/* Newest = one flat, date-ordered wall. By campaign = expandable
          campaign sections. */}
      {filtered.length === 0 ? (
        <p className="pv2-body" style={{ fontSize: 16, color: INK_BODY }}>No media matches these filters.</p>
      ) : sort === "newest" ? (
        <div className="gap-3 [column-fill:_balance] columns-2 sm:columns-3 lg:columns-4">
          {newestTiles.map((t) => (
            <Tile
              key={t.id}
              tile={t}
              onOpen={t.athleteId && rowToAthlete[t.athleteId] ? openTile : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map(({ campaign, items }) => {
            const open = filtersActive || expanded.has(campaign.id);
            return (
              <div
                key={campaign.id}
                className="overflow-hidden"
                style={{
                  background: CARD,
                  border: `1px solid ${CARD_B}`,
                  borderRadius: RADIUS,
                  backdropFilter: BLUR,
                  WebkitBackdropFilter: BLUR,
                }}
              >
                <button
                  onClick={() => toggle(campaign.id)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <div className="flex items-baseline gap-3 min-w-0">
                    <h2
                      className="uppercase leading-none tracking-[0.5px] truncate"
                      style={{ ...BEBAS, color: OFFWHITE, fontSize: "clamp(22px, 2.6vw, 32px)" }}
                    >
                      {campaign.name}
                    </h2>
                    <span
                      className="text-[11px] font-bold uppercase tracking-[1.5px] shrink-0"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      {items.length} {items.length === 1 ? "piece" : "pieces"}
                    </span>
                  </div>
                  <span
                    className="flex items-center gap-2 shrink-0 text-[11px] font-bold uppercase tracking-[1.5px]"
                    style={{ color: open ? ORANGE : "rgba(255,255,255,0.6)" }}
                  >
                    {open ? "Hide media" : "View media"}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>

                {open ? (
                  <div className="px-5 pb-5 pt-1">
                    <div className="gap-3 [column-fill:_balance] columns-2 sm:columns-3 lg:columns-4">
                      {items.map((t) => (
                        <Tile
                          key={t.id}
                          tile={t}
                          onOpen={t.athleteId && rowToAthlete[t.athleteId] ? openTile : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {open && openAthletes.length > 0 ? (
        <AssetModal
          athletes={openAthletes}
          startIndex={open.index}
          startPostIndex={open.postIndex}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}

function Tile({ tile, onOpen }: { tile: LibraryTile; onOpen?: (tile: LibraryTile) => void }) {
  const isVideo = tile.kind === "video";
  return (
    <figure
      onClick={onOpen ? () => onOpen(tile) : undefined}
      className={`group relative break-inside-avoid mb-3 rounded-xl overflow-hidden ${onOpen ? "cursor-pointer" : ""}`}
      style={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {tile.thumb ? (
        <img
          src={tile.thumb}
          alt={tile.athleteName || tile.campaignName}
          loading="lazy"
          className="block w-full h-auto object-cover"
        />
      ) : (
        <div className="w-full aspect-[3/4] grid place-items-center" style={{ background: "#15151a" }}>
          <PlayIcon size={34} />
        </div>
      )}

      {/* Photo/Video badge */}
      <span
        className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[1.5px]"
        style={{
          background: isVideo ? ORANGE : "rgba(0,0,0,0.6)",
          color: "#fff",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        {isVideo ? "Video" : "Photo"}
      </span>

      {/* Play icon on videos that have a poster thumbnail */}
      {isVideo && tile.thumb ? (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <span className="grid place-items-center w-12 h-12 rounded-full" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
            <PlayIcon size={20} />
          </span>
        </div>
      ) : null}

      {/* Download button */}
      <a
        href={tile.fileUrl}
        download
        onClick={(e) => e.stopPropagation()}
        aria-label="Download"
        title="Download"
        className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.6)", color: "#fff", backdropFilter: "blur(6px)" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </a>

      {/* Athlete name on hover */}
      {tile.athleteName ? (
        <figcaption className="absolute left-0 right-0 bottom-0 px-3 pt-8 pb-2.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity pointer-events-none"
          style={{ background: "linear-gradient(180deg, transparent, rgba(8,8,11,0.9))" }}>
          <span style={{ ...BEBAS, color: OFFWHITE, fontSize: 18, letterSpacing: 0.5 }} className="uppercase leading-none">
            {tile.athleteName}
          </span>
        </figcaption>
      ) : null}
    </figure>
  );
}

function PlayIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden>
      <polygon points="8 5 19 12 8 19 8 5" />
    </svg>
  );
}
