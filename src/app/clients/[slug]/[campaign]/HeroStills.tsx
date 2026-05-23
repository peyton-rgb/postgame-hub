'use client';

import { useEffect, useState } from 'react';

// One hero still: the _w1600.webp URL plus the focal point we computed at
// import (sharp + smartcrop saliency). The page top-anchors the still and
// nudges the crop vertically toward focalY so faces stay in frame.
export interface HeroStill {
  src: string;
  originalSrc: string; // the raw file_url — fallback when variant 404s
  alt: string;
  focalX: number; // 0..1
  focalY: number; // 0..1
}

const ROTATE_MS = 4500;
const FADE_MS = 1200;

export default function HeroStills({ stills }: { stills: HeroStill[] }) {
  const [current, setCurrent] = useState(0);
  // Track which slides already fell back to originalSrc (prevents infinite loop)
  const [fellBack, setFellBack] = useState<Set<number>>(() => new Set());

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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.src}
          src={fellBack.has(i) ? s.originalSrc : s.src}
          alt={s.alt}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            // Bias slightly upward — heads typically sit in the upper third —
            // then nudge by focal Y. Cap at center to avoid flipping landscapes upside-down.
            objectPosition: `${(s.focalX * 100).toFixed(1)}% ${Math.min(50, s.focalY * 100).toFixed(1)}%`,
            opacity: i === current ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease`,
            animation: 'kenBurnsSlow 22s ease-in-out infinite alternate',
          }}
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => {
            // Variant 404'd — swap to the original file_url (once only)
            if (!fellBack.has(i)) {
              setFellBack((prev) => new Set(prev).add(i));
            }
          }}
        />
      ))}
    </>
  );
}
