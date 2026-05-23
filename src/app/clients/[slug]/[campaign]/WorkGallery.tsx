'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface GalleryItem {
  id: string;
  src: string;          // original/full-size — used in lightbox + download
  thumb: string;        // _w400.webp variant — used in tiles
  isVideo: boolean;
  poster: string | null;
  alt: string;
  focalX: number;
  focalY: number;
}

// The prototype mixes a video into the masonry every 5 photos.
function interleave(images: GalleryItem[], videos: GalleryItem[]): GalleryItem[] {
  const out: GalleryItem[] = [];
  let vi = 0;
  images.forEach((img, idx) => {
    out.push(img);
    if ((idx + 1) % 5 === 0 && vi < videos.length) {
      out.push(videos[vi++]);
    }
  });
  while (vi < videos.length) out.push(videos[vi++]);
  return out;
}

function PhotoTile({ item, onClick }: { item: GalleryItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full break-inside-avoid mb-3 relative overflow-hidden rounded-sm border border-white/[0.08] bg-[#161616] hover:border-white/20 transition-colors"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.thumb}
        alt={item.alt}
        className="block w-full h-auto"
        style={{ objectPosition: `${(item.focalX * 100).toFixed(1)}% ${(item.focalY * 100).toFixed(1)}%` }}
        loading="lazy"
        decoding="async"
      />
    </button>
  );
}

function VideoTile({ item, onClick }: { item: GalleryItem; onClick: () => void }) {
  const vref = useRef<HTMLVideoElement>(null);
  return (
    <div
      className="block break-inside-avoid mb-3 relative overflow-hidden rounded-sm border border-white/[0.08] bg-[#161616] hover:border-white/20 transition-colors"
      onMouseEnter={() => vref.current?.play().catch(() => {})}
      onMouseLeave={() => { if (vref.current) { vref.current.pause(); vref.current.currentTime = 0; } }}
      onClick={onClick}
    >
      <video
        ref={vref}
        src={item.src}
        poster={item.poster || undefined}
        muted
        loop
        playsInline
        preload="metadata"
        className="block w-full h-auto cursor-pointer"
      />
      <span
        className="absolute bottom-2 left-2 pointer-events-none uppercase tracking-[0.12em] text-white font-bold text-[9px] px-2 py-1"
        style={{ background: 'rgba(215,63,9,0.85)', fontFamily: 'var(--font-mono)' }}
      >
        ▶ Video · hover
      </span>
    </div>
  );
}

function Lightbox({
  item, onClose, onPrev, onNext,
}: {
  item: GalleryItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-5 right-5 text-white/60 hover:text-white"
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="Previous"
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-2"
      >
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next"
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-2"
      >
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="max-w-[92vw] max-h-[88vh]" onClick={(e) => e.stopPropagation()}>
        {item.isVideo ? (
          <video src={item.src} controls autoPlay className="max-w-full max-h-[88vh] rounded" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.src} alt={item.alt} className="max-w-full max-h-[88vh] object-contain rounded" />
        )}
      </div>
      <a
        href={item.src}
        download
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 uppercase tracking-[0.14em] text-[10px] text-white/50 hover:text-white border border-white/20 px-3 py-2"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        ↓ Download original
      </a>
    </div>
  );
}

export default function WorkGallery({
  images,
  videos,
}: {
  images: GalleryItem[];
  videos: GalleryItem[];
}) {
  const tiles = interleave(images, videos);
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const prev = useCallback(() => {
    setOpen((i) => (i === null ? null : (i - 1 + tiles.length) % tiles.length));
  }, [tiles.length]);
  const next = useCallback(() => {
    setOpen((i) => (i === null ? null : (i + 1) % tiles.length));
  }, [tiles.length]);

  return (
    <>
      <div
        className="mt-11"
        style={{ columnCount: 5, columnGap: '12px' }}
      >
        {tiles.map((t, i) =>
          t.isVideo ? (
            <VideoTile key={t.id} item={t} onClick={() => setOpen(i)} />
          ) : (
            <PhotoTile key={t.id} item={t} onClick={() => setOpen(i)} />
          )
        )}
      </div>

      {/* Mobile/tablet column overrides. Tailwind doesn't have first-class
          column-count utilities, so we inline a small style block. */}
      <style jsx>{`
        @media (max-width: 1100px) {
          div :global([style*="column-count: 5"]) { column-count: 3 !important; }
        }
        @media (max-width: 640px) {
          div :global([style*="column-count: 5"]) { column-count: 2 !important; }
        }
      `}</style>

      {open !== null && tiles[open] && (
        <Lightbox
          item={tiles[open]}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}
