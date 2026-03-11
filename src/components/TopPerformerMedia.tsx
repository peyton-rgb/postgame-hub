"use client";

import { useState } from "react";
import type { Media } from "@/lib/types";

export function TopPerformerMedia({ items, name }: { items: Media[]; name: string }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [playing, setPlaying] = useState(false);

  const current = items[slideIdx];
  const isVideo = current?.type === "video";
  const displaySrc = current?.thumbnail_url || (current?.type !== "video" ? current?.file_url : null);

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isVideo && playing ? (
        <video src={current.file_url} autoPlay controls playsInline className="w-full h-full object-cover" onEnded={() => setPlaying(false)} />
      ) : displaySrc ? (
        <img src={displaySrc} className="w-full h-full object-cover" draggable={false} alt={name} />
      ) : isVideo ? (
        <div className="w-full h-full bg-black flex items-center justify-center cursor-pointer" onClick={() => setPlaying(true)}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      ) : null}

      {isVideo && !playing && (
        <div onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center cursor-pointer z-[2]">
          <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:scale-110 transition-transform">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="5,3 19,12 5,21" /></svg>
          </div>
        </div>
      )}

      {items.length > 1 && hovered && (
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 z-[20] flex justify-between px-1 pointer-events-none">
          <button onClick={(e) => { e.stopPropagation(); setPlaying(false); setSlideIdx((i) => (i <= 0 ? items.length - 1 : i - 1)); }} className="pointer-events-auto w-6 h-6 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center hover:bg-black/90 transition-colors">
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); setPlaying(false); setSlideIdx((i) => (i >= items.length - 1 ? 0 : i + 1)); }} className="pointer-events-auto w-6 h-6 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center hover:bg-black/90 transition-colors">
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none"><path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}

      {items.length > 1 && !playing && (
        <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-[3] transition-opacity ${hovered ? "opacity-100" : "opacity-0"}`}>
          {items.map((_, i) => (
            <div key={i} onClick={(e) => { e.stopPropagation(); setPlaying(false); setSlideIdx(i); }} className={`w-1.5 h-1.5 rounded-full cursor-pointer ${slideIdx === i ? "bg-white" : "bg-white/35"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
