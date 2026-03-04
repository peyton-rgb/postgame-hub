"use client";

import { useState } from "react";
import type { Campaign, Athlete, Media } from "@/lib/types";

function MasonryCard({ athlete, items }: { athlete: Athlete; items: Media[] }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);

  const current = items[slideIdx];
  const isVideo = current?.type === "video";
  const displaySrc = current?.thumbnail_url || (current?.type !== "video" ? current?.file_url : null);

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaying(false);
    setSlideIdx((i) => (i <= 0 ? items.length - 1 : i - 1));
  };
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaying(false);
    setSlideIdx((i) => (i >= items.length - 1 ? 0 : i + 1));
  };

  return (
    <div
      className="break-inside-avoid mb-2 rounded-lg overflow-hidden bg-black"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative overflow-hidden">
        {isVideo && playing ? (
          <video
            src={current.file_url}
            autoPlay
            controls
            playsInline
            className="w-full block"
            onEnded={() => setPlaying(false)}
          />
        ) : displaySrc ? (
          <img
            src={displaySrc}
            className="w-full block"
            draggable={false}
            alt={athlete.name}
          />
        ) : (
          <div className="w-full aspect-[4/5] bg-black flex items-center justify-center">
            <span className="text-[10px] text-white/30 font-black uppercase">
              No media
            </span>
          </div>
        )}

        {/* Video play button */}
        {isVideo && !playing && (
          <div
            onClick={() => setPlaying(true)}
            className="absolute inset-0 flex items-center justify-center cursor-pointer z-[2]"
          >
            <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}

        {/* Type badge */}
        <span className="absolute top-2 right-2 z-[3] px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-black/65 text-white backdrop-blur">
          {athlete.post_type}
        </span>

        {/* Carousel arrows — visible on hover even during video playback */}
        {items.length > 1 && hovered && (
          <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 z-[4] flex justify-between px-1.5">
            <button
              onClick={goPrev}
              className="w-7 h-7 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={goNext}
              className="w-7 h-7 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Dots */}
        {items.length > 1 && (
          <div
            className={`absolute bottom-11 left-1/2 -translate-x-1/2 flex gap-1 z-[3] transition-opacity ${
              hovered ? "opacity-100" : "opacity-0"
            }`}
          >
            {items.map((_, i) => (
              <div
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setPlaying(false);
                  setSlideIdx(i);
                }}
                className={`w-1.5 h-1.5 rounded-full cursor-pointer ${
                  slideIdx === i ? "bg-white" : "bg-white/35"
                }`}
              />
            ))}
          </div>
        )}

        {/* Creator overlay — no SchoolBadge */}
        <div className="absolute bottom-0 left-0 right-0 z-[2] px-3 pt-5 pb-2.5 bg-gradient-to-t from-black/85 to-transparent">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase text-white truncate">
              {athlete.name}
            </div>
            <div className="text-[9px] text-white/55 font-semibold flex items-center gap-1.5">
              {athlete.school}
              <span className="px-1 py-px rounded text-[7px] font-bold uppercase bg-brand text-white">
                {athlete.sport}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecapGallery({
  campaign,
  athletes,
  media,
}: {
  campaign: Campaign;
  athletes: Athlete[];
  media: Record<string, Media[]>;
}) {
  const [filter, setFilter] = useState("all");

  const filtered = athletes.filter((a) => {
    if (filter === "all") return true;
    if (filter === "photo") return a.post_type !== "IG Reel";
    return a.post_type === "IG Reel";
  });

  const cols = campaign.settings?.columns || 4;

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* Header */}
      <div className="px-6 md:px-12 pt-12 pb-6">
        <div className="text-xs font-bold uppercase tracking-[3px] text-brand mb-2">
          {campaign.client_name}
        </div>
        <h1 className="text-3xl font-black mb-6">{campaign.name}</h1>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-5">
            <h2 className="text-xl font-black">Content Gallery</h2>
            <div className="flex gap-2">
              {["all", "photo", "video"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase ${
                    filter === f
                      ? "bg-brand text-white"
                      : "border border-white/15 text-white/40"
                  }`}
                >
                  {f === "all" ? "All" : f === "photo" ? "Photos" : "Videos"}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-white/30 font-semibold">
            {filtered.length} posts
          </span>
        </div>
      </div>

      {/* Masonry grid */}
      <div className="px-6 md:px-12 pb-12">
        <div
          data-masonry
          style={{ columnCount: cols, columnGap: 8 }}
          className="bg-black border border-white/10 rounded-xl p-2"
        >
          {filtered.map((a) => (
            <MasonryCard key={a.id} athlete={a} items={media[a.id] || []} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 md:px-12 py-8 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-white/30">
          Powered by Postgame
        </span>
        <span className="text-xs text-white/30">
          &copy; {new Date().getFullYear()} {campaign.client_name}
        </span>
      </div>
    </div>
  );
}
