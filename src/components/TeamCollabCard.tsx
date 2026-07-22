"use client";

// ─────────────────────────────────────────────────────────────
// TeamCollabCard — dashboard (Upload Content) card for ONE collab
// TEAM (athlete set). The per-platform collab groups are consolidated
// upstream into one card: `items` is the union of every platform's
// media and `platformTags` shows each platform as pooled/solo.
//
// Collab media lives in the existing media table as
// drive_file_id = "collab:<groupId>" with athlete_id = NULL, pooled
// under the merged (canonical) group id. Assets are added from the
// team's Drive folder (resolved via the matching collab_containers
// row). A team whose athlete set has no container renders a disabled
// "Drive folder not linked" state — no upload.
//
// Visual language: dark dashboard card + the recap collab treatment
// (orange #D73F09 left spine + title band) so the brand and the
// campaign manager see a consistent design across surfaces.
// ─────────────────────────────────────────────────────────────

import type { Media } from "@/lib/types";
import { supabaseImageUrl } from "@/lib/supabase-image";

interface TeamCollabCardProps {
  /** Team display name, e.g. "UF Softball". */
  teamName: string;
  /** Platform label — a single platform or a merged "IG Feed + Reel". Only shown
   *  as a fallback badge when platformTags is absent. */
  platformLabel: string;
  /** Placeholder school crest — 2-3 letter initials (never a real school mark). */
  crestLabel?: string;
  /** Per-platform pooled/solo tags from detectCollabGroups. Supersedes the plain
   *  platformLabel badge when provided. */
  platformTags?: { label: string; kind: "pooled" | "solo" }[];
  /** Participant athlete display names. */
  participantNames: string[];
  /** Assigned media for this group (drive_file_id = "collab:<groupId>"). */
  items: Media[];
  /** Whether a collab_containers row (Drive folder) backs this group. */
  driveLinked: boolean;
  /** Open the Drive picker scoped to this group's team folder. Only when linked. */
  onAddFromDrive?: () => void;
  /** Upload local files straight to this collab group. */
  onUpload?: () => void;
  /** Remove a single asset. */
  onRemoveMedia?: (mediaId: string) => void;
  /** How many thumbnails to show before "+N more". */
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

export default function TeamCollabCard({
  teamName,
  platformLabel,
  crestLabel,
  platformTags,
  participantNames,
  items,
  driveLinked,
  onAddFromDrive,
  onUpload,
  onRemoveMedia,
  maxThumbs = 6,
}: TeamCollabCardProps) {
  const participants =
    participantNames.length > 0 ? participantNames.join(", ") : "No participants detected";

  const shown = items.slice(0, maxThumbs);
  const overflow = Math.max(0, items.length - maxThumbs);
  const empty = items.length === 0;

  return (
    <div className="flex rounded-xl overflow-hidden border border-gray-800 bg-[#0a0a0a]">
      {/* Orange spine — matches the recap collab treatment */}
      <div className="w-1.5 flex-shrink-0 bg-[#D73F09]" aria-hidden />

      <div className="flex-1 min-w-0">
        {/* Title band */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-800 bg-[#111]">
          {crestLabel && (
            <div
              className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black text-white bg-white/10 border border-white/20"
              title="Placeholder crest"
            >
              {crestLabel}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-[#D73F09] text-white tracking-wider">
                Collab
              </span>
              <h4 className="text-sm font-black uppercase tracking-wide truncate text-white">
                {teamName}
              </h4>
              {!platformTags && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase border border-[#D73F09]/50 text-[#D73F09] tracking-wider whitespace-nowrap">
                  {platformLabel}
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 truncate mt-0.5" title={participants}>
              {participantNames.length} athlete{participantNames.length === 1 ? "" : "s"} · {participants}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="p-3">
          {/* Pooled / solo per-platform tags */}
          {platformTags && platformTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {platformTags.map((t) => (
                <span
                  key={t.label}
                  className={`text-[8px] font-black uppercase tracking-wider rounded px-2 py-1 ${
                    t.kind === "pooled"
                      ? "bg-[#D73F09] text-white"
                      : "bg-white/5 text-gray-400 border border-gray-700"
                  }`}
                >
                  {t.label}
                </span>
              ))}
            </div>
          )}
          {empty ? (
            <div className="h-[52px] flex items-center justify-center">
              <span className="text-[10px] text-gray-600 font-medium text-center px-2">
                {driveLinked ? "No content selected yet" : "No content"}
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

          {/* Action footer */}
          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-[9px] text-gray-500 font-bold whitespace-nowrap">
              {items.length} asset{items.length === 1 ? "" : "s"} selected
            </span>
            <div className="flex items-center gap-3">
              {onUpload && (
                <button
                  type="button"
                  onClick={onUpload}
                  className="text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
                >
                  Upload
                </button>
              )}
              {driveLinked ? (
                <button
                  type="button"
                  onClick={onAddFromDrive}
                  className="text-[9px] font-bold uppercase tracking-wider text-[#D73F09] hover:text-[#ff5722] transition-colors"
                >
                  {empty ? "Add from Drive" : "Edit from Drive"}
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-gray-600"
                  title="No collab_containers row links a Drive folder to this athlete set."
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                  Not linked
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
