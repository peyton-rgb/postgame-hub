// ============================================================
// Inspo media helpers — shared by the library grid and the
// asset detail panel.
//
//   isVideoItem / stillFor  decide what an item is and which
//                           picture stands in for it
//   Still                   an image that degrades to an icon
//   TileMedia               a tile's picture, which plays the
//                           video (muted) while it is on screen
//   downloadUrl             a link that saves the file instead
//                           of opening it
// ============================================================

'use client';

import { useEffect, useRef, useState } from 'react';
import type { InspoItem } from '@/lib/types/intake';

// The Instagram ingest stored its reels with no mime_type, so "is this a
// video" cannot rest on mime_type alone. Fall back to the file extension.
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|$)/i;

export function isVideoItem(item: InspoItem): boolean {
  if (item.mime_type?.startsWith('video/')) return true;
  return !item.mime_type && VIDEO_EXT.test(item.file_url || '');
}

// The picture to show for an item: its thumbnail, or the file itself when the
// file is an image. Never a video file. An <img> cannot render one, and a
// failed <img> prints its alt text, which is how the grid once turned into a
// wall of descriptions.
export function stillFor(item: InspoItem): string | null {
  if (item.thumbnail_url) return item.thumbnail_url;
  if (item.file_url && !isVideoItem(item)) return item.file_url;
  return null;
}

// Supabase Storage sends a file as a download, under the given name, when the
// object URL carries ?download=<name>. That works for public and signed URLs
// alike and needs no fetch. Any other host is returned untouched.
export function downloadUrl(item: InspoItem): string | null {
  if (!item.file_url) return null;
  try {
    const u = new URL(item.file_url);
    if (!u.hostname.endsWith('.supabase.co')) return item.file_url;
    const ext = (u.pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1] || (isVideoItem(item) ? 'mp4' : 'jpg')).toLowerCase();
    u.searchParams.set('download', `postgame-inspo-${item.id.slice(0, 8)}.${ext}`);
    return u.toString();
  } catch {
    return item.file_url;
  }
}

export function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

// An image that degrades to a quiet icon instead of alt text when it is
// missing or fails to load. The alt is a short label, never the long
// description.
export function Still({
  src,
  label,
  video,
  className = 'w-full h-full object-cover',
}: {
  src: string | null;
  label: string;
  video: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={label}
        className="w-full h-full min-h-[120px] flex items-center justify-center text-gray-500"
      >
        {video ? (
          <PlayIcon size={28} />
        ) : (
          <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 16l5-5 4 4 3-3 6 6" />
          </svg>
        )}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

// A tile's media. Shows the still; when the tile is a video and at least 60%
// of it has been on screen for a moment, the video is mounted over the still
// and played muted on a loop. It is unmounted again as soon as the tile
// leaves, so a long scroll does not keep hundreds of videos loaded.
//
// Autoplay is skipped when the device asks for reduced motion or for data
// saving; those viewers keep the still.
export function TileMedia({ item, label }: { item: InspoItem; label: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const video = isVideoItem(item) && !!item.file_url;

  useEffect(() => {
    const box = boxRef.current;
    if (!video || !box || typeof IntersectionObserver === 'undefined') return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (reduceMotion || saveData) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          // A short wait, so tiles flying past during a fast scroll never load.
          timer = setTimeout(() => setPlaying(true), 350);
        } else {
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(box);
    return () => {
      if (timer) clearTimeout(timer);
      io.disconnect();
    };
  }, [video]);

  useEffect(() => {
    if (playing) videoRef.current?.play().catch(() => setPlaying(false));
  }, [playing]);

  return (
    <div ref={boxRef} className="absolute inset-0">
      <Still src={stillFor(item)} label={label} video={isVideoItem(item)} />
      {playing && video && (
        <video
          ref={videoRef}
          src={item.file_url!}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setPlaying(false)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
