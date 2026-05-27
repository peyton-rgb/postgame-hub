"use client";

// ─────────────────────────────────────────────────────────────
// TeamCollabCard — dashboard (Upload Content) card for a team
// collab post. Shows two side-by-side content slots, Feed + Reel,
// that the campaign manager fills with Drive assets per platform.
//
// Driven by a collab_containers row (a detected team Drive folder).
// Media lives in the existing media table as drive_file_id =
// "collab:<containerId>"; the new `slot` column says feed vs reel.
//
// Visual language: dark dashboard card + the recap collab treatment
// (orange #D73F09 left spine + title band) so the brand and the
// campaign manager see a consistent design across surfaces.
// ─────────────────────────────────────────────────────────────

import type { Media } from "@/lib/types";
import { supabaseImageUrl } from "@/lib/supabase-image";

export type CollabSlot = "feed" | "reel";

interface TeamCollabCardProps {
  /** Team display name, e.g. "UF Softball". */
  teamName: string;
  /** Participant athlete display names. */
  participantNames: string[];
  feedMedia: Media[];
  reelMedia: Media[];
  /** Fired when a slot is clicked — opens the Drive picker scoped to this slot. */
  onSlotClick: (slot: CollabSlot) => void;
  /** Remove a single asset from a slot. */
  onRemoveMedia?: (mediaId: string) => void;
  /** How many thumbnails to show per slot before "+N more". */
  maxThumbs?: number;
}

function Thumb({ m, onRemove }: { m: Media; onRemove?: (id: string) => void }) {
  const thumbSrc = m.thumbnail_url || (m.type !== "video" ? m.file_url : null);
  return (
    <div className="relative flex-shrink-0 group/thumb">
      <div
        className={`w-10 h-10 rounded overflow-hidden border-2 ${
          m.type === "video" ? "border-purple-500/50" : "border-gray-700"
        }`}
      >
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={supabaseImageUrl(thumbSrc, 100) ?? thumbSrc}
            className="w-full h-full object-cover [image-rendering:-webkit-optimize-contrast]"
            alt=""
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.includes("/render/image/public/")) {
                img.src = img.src.replace("/render/image/public/", "/object/public/").split("?")[0];
              }
            }}
          />
        ) : (
          <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>
          </div>
        )}
      </div>
      {m.type === "video" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-4 h-4 rounded-full bg-black/60 flex items-center justify-center">
            <svg width="7" height="7" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="8 5 19 12 8 19 8 5" /></svg>
          </div>
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(m.id); }}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-black/80 text-white text-[7px] flex items-center justify-center hover:bg-red-600 opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"
        >×</button>
      )}
    </div>
  );
}

function Slot({
  label,
  slot,
  items,
  onSlotClick,
  onRemoveMedia,
  maxThumbs,
}: {
  label: string;
  slot: CollabSlot;
  items: Media[];
  onSlotClick: (slot: CollabSlot) => void;
  onRemoveMedia?: (mediaId: string) => void;
  maxThumbs: number;
}) {
  const shown = items.slice(0, maxThumbs);
  const overflow = Math.max(0, items.length - maxThumbs);
  const empty = items.length === 0;

  return (
    <button
      type="button"
      onClick={() => onSlotClick(slot)}
      className={`flex-1 min-w-0 text-left rounded-lg p-3 border-2 transition-all ${
        empty
          ? "border-dashed border-gray-700 hover:border-gray-500 bg-[#0a0a0a]"
          : "border-gray-800 hover:border-[#D73F09] bg-[#0d0d0d]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-gray-200">{label}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#D73F09]">{slot}</span>
      </div>

      {empty ? (
        <div className="h-[52px] flex items-center justify-center">
          <span className="text-[10px] text-gray-600 font-medium text-center px-2">
            No {label} content selected yet
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 mb-2">
          {shown.map((m) => (
            <Thumb key={m.id} m={m} onRemove={onRemoveMedia} />
          ))}
          {overflow > 0 && (
            <div className="w-10 h-10 rounded border-2 border-gray-800 bg-[#1a1a1a] flex items-center justify-center text-[10px] font-bold text-gray-400">
              +{overflow}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-gray-500 font-bold">
          {items.length} asset{items.length === 1 ? "" : "s"} selected
        </span>
        <span className="text-[9px] text-[#D73F09] font-bold uppercase tracking-wider">
          {empty ? "Click to add" : "Click to edit"}
        </span>
      </div>
    </button>
  );
}

export default function TeamCollabCard({
  teamName,
  participantNames,
  feedMedia,
  reelMedia,
  onSlotClick,
  onRemoveMedia,
  maxThumbs = 6,
}: TeamCollabCardProps) {
  const participants =
    participantNames.length > 0 ? participantNames.join(", ") : "No participants detected";

  return (
    <div className="flex rounded-xl overflow-hidden border border-gray-800 bg-[#0a0a0a]">
      {/* Orange spine — matches the recap collab treatment */}
      <div className="w-1.5 flex-shrink-0 bg-[#D73F09]" aria-hidden />

      <div className="flex-1 min-w-0">
        {/* Title band */}
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-800 bg-[#111]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-[#D73F09] text-white tracking-wider">
                Collab
              </span>
              <h4 className="text-sm font-black uppercase tracking-wide truncate text-white">
                {teamName}
              </h4>
            </div>
            <div className="text-[10px] text-gray-500 truncate mt-0.5" title={participants}>
              Participants: {participants}
            </div>
          </div>
        </div>

        {/* Side-by-side Feed + Reel slots (stack on mobile) */}
        <div className="flex flex-col sm:flex-row gap-2 p-3">
          <Slot
            label="Feed"
            slot="feed"
            items={feedMedia}
            onSlotClick={onSlotClick}
            onRemoveMedia={onRemoveMedia}
            maxThumbs={maxThumbs}
          />
          <Slot
            label="Reel"
            slot="reel"
            items={reelMedia}
            onSlotClick={onSlotClick}
            onRemoveMedia={onRemoveMedia}
            maxThumbs={maxThumbs}
          />
        </div>
      </div>
    </div>
  );
}
