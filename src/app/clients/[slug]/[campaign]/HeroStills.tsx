'use client';

import { useEffect, useState } from 'react';
import { isVideoUrl } from '@/lib/is-video-url';

// One hero still: the direct file_url plus the focal point and scale
// set in the hero editor (/dashboard/recaps/[id]/hero). The page
// uses object-cover and objectPosition to crop toward the focal point,
// and transform: scale() for the editor's zoom control.
export interface HeroStill {
  src: string;
  alt: string;
  focalX: number; // 0..1
  focalY: number; // 0..1
  scale: number;  // 1.0 = normal, 1.5 = 150% zoom, etc.
}

const ROTATE_MS = 4500;
const FADE_MS = 1200;

export default function HeroStills({ stills }: { stills: HeroStill[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (stills.length < 2) return;
    const t = setInterval(() => {
      setCurrent((c) => (c + 1) % stills.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [stills.length]);

  if (!stills.length) {
    return <div className="absolute inset-0 bg-[#0c0c0e]" />;
  }

  return (
    <>
      {stills.map((s, i) => (
        isVideoUrl(s.src) ? (
          <video
            key={s.src}
            src={s.src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              objectPosition: `${(s.focalX * 100).toFixed(1)}% ${(s.focalY * 100).toFixed(1)}%`,
              transform: s.scale !== 1 ? `scale(${s.scale})` : undefined,
              opacity: i === current ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease`,
            }}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={s.src}
            alt={s.alt}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              objectPosition: `${(s.focalX * 100).toFixed(1)}% ${(s.focalY * 100).toFixed(1)}%`,
              transform: s.scale !== 1 ? `scale(${s.scale})` : undefined,
              opacity: i === current ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease`,
            }}
            loading="eager"
            decoding="async"
          />
        )
      ))}
    </>
  );
}
