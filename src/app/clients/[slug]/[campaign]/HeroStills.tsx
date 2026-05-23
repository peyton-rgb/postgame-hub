'use client';

import { useCallback, useEffect, useState } from 'react';

// One hero still: the direct file_url plus the focal point computed at
// import (sharp + smartcrop saliency). The page top-anchors the still and
// nudges the crop vertically toward focalY so faces stay in frame.
export interface HeroStill {
  src: string;
  alt: string;
  focalX: number; // 0..1
  focalY: number; // 0..1
}

const ROTATE_MS = 4500;
const FADE_MS = 1200;

export default function HeroStills({ stills }: { stills: HeroStill[] }) {
  const [current, setCurrent] = useState(0);

  // Track which images are portrait so we can switch from object-cover
  // (which crops portrait photos heavily in a landscape hero) to
  // object-contain (which shows the full photo with dark bars on sides).
  // We detect orientation client-side because Drive-imported media often
  // has resolution=null in the database.
  const [portraits, setPortraits] = useState<Record<string, boolean>>({});

  const handleLoad = useCallback(
    (src: string, e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      if (img.naturalHeight > img.naturalWidth) {
        setPortraits((prev) => ({ ...prev, [src]: true }));
      }
    },
    []
  );

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
      {stills.map((s, i) => {
        const isPortrait = portraits[s.src];
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={s.src}
            alt={s.alt}
            className="absolute inset-0 w-full h-full"
            style={{
              // Portrait photos → object-contain (full photo, dark side bars).
              // Landscape photos → object-cover (fills the hero, looks cinematic).
              objectFit: isPortrait ? 'contain' : 'cover',
              objectPosition: isPortrait
                ? 'center center'
                : `${(s.focalX * 100).toFixed(1)}% ${Math.min(50, s.focalY * 100).toFixed(1)}%`,
              opacity: i === current ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease`,
            }}
            // All slides load eagerly — there are ≤6 and the hero is above
            // the fold, so we want them ready before the rotation timer fires.
            loading="eager"
            decoding="async"
            onLoad={(e) => handleLoad(s.src, e)}
          />
        );
      })}
    </>
  );
}
