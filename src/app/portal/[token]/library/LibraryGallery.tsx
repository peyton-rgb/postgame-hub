"use client";

import { useMemo, useState } from "react";
import { ORANGE, OFFWHITE, BEBAS } from "@/lib/portal";
import AssetModal, { type PortalAthlete } from "./AssetModal";

export type LibraryTile = {
  id: string;
  campaignId: string;
  campaignName: string;
  athleteId: string | null;
  athleteName: string | null;
  kind: "photo" | "video";
  thumb: string | null;
  fileUrl: string;
};

export type LibraryCampaign = { id: string; name: string };

type MediaFilter = "all" | "photo" | "video";

type OpenState = { campaignId: string; index: number; postIndex: number };

export default function LibraryGallery({
  campaigns,
  tiles,
  athletesById,
  campaignAthletes,
  rowToAthlete,
}: {
  campaigns: LibraryCampaign[];
  tiles: LibraryTile[];
  athletesById: Record<string, PortalAthlete>;
  campaignAthletes: Record<string, string[]>;
  rowToAthlete: Record<string, string>;
}) {
  const [media, setMedia] = useState<MediaFilter>("all");
  const [athlete, setAthlete] = useState<string>("");
  const [query, setQuery] = useState<string>("");
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
  const athleteOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of tiles) if (t.athleteName) set.add(t.athleteName);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tiles]);

  // Apply filters to the flat tile list.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tiles.filter((t) => {
      if (media !== "all" && t.kind !== media) return false;
      if (athlete && t.athleteName !== athlete) return false;
      if (q) {
        const hay = `${t.campaignName} ${t.athleteName || ""}`.toLowerCase();
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

  const filterChip = (label: string, value: MediaFilter) => {
    const active = media === value;
    return (
      <button
        key={value}
        onClick={() => setMedia(value)}
        className="px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[1.5px] transition-colors"
        style={{
          background: active ? ORANGE : "rgba(255,255,255,0.06)",
          color: active ? "#fff" : "rgba(255,255,255,0.6)",
          border: `1px solid ${active ? ORANGE : "rgba(255,255,255,0.12)"}`,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-10 pt-2">
        <div className="flex items-center gap-2">
          {filterChip("All", "all")}
          {filterChip("Photo", "photo")}
          {filterChip("Video", "video")}
        </div>

        <select
          value={athlete}
          onChange={(e) => setAthlete(e.target.value)}
          className="px-3 py-2 rounded-full text-[12px] outline-none"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: OFFWHITE,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <option value="">All athletes</option>
          {athleteOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search campaign or athlete"
          className="px-4 py-2 rounded-full text-[12px] outline-none min-w-[220px] flex-1 max-w-[320px]"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: OFFWHITE,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        />

        {/* Placeholder for an upcoming feature. */}
        <span
          className="px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[1.5px] cursor-not-allowed select-none"
          style={{
            background: "rgba(255,255,255,0.03)",
            color: "rgba(255,255,255,0.3)",
            border: "1px dashed rgba(255,255,255,0.14)",
          }}
          aria-disabled
          title="Coming soon"
        >
          Style &amp; Vibe Tags — coming soon
        </span>
      </div>

      {/* Campaign list — each row expands to its full content gallery */}
      {sections.length === 0 ? (
        <p style={{ color: "rgba(255,255,255,0.45)" }} className="text-sm">
          No media matches these filters.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map(({ campaign, items }) => {
            const open = filtersActive || expanded.has(campaign.id);
            return (
              <div
                key={campaign.id}
                className="rounded-[18px] overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.11)",
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
        className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
        <figcaption className="absolute left-0 right-0 bottom-0 px-3 pt-8 pb-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
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
