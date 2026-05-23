// ============================================================
// HeroSlideshow — client component for the recap-reel behind
// the hero. Renders slide 0 active on the server so the first
// client paint matches and we don't introduce a hydration
// mismatch. Crossfade and timer kick in inside useEffect.
// If only one (or zero) images are passed, no client-side
// effect runs — just a static backdrop.
//
// Uses next/image so the browser fetches a properly-sized,
// modern-format render at viewport width instead of stretching
// the raw original file (that's what was making slides grainy).
// objectPosition is biased toward the top of the photo so the
// athlete's face survives the crop on full-body shots.
// ============================================================

'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface Props {
  images: string[];
  intervalMs?: number;
}

export default function HeroSlideshow({ images, intervalMs = 4500 }: Props) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  if (images.length === 0) return null;

  return (
    <>
      <div className="bp-slides">
        {images.map((src, i) => (
          <div key={src + i} className={`bp-slide${i === active ? ' active' : ''}`}>
            <Image
              src={src}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              style={{ objectFit: 'cover', objectPosition: 'center 12%' }}
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="bp-dots">
          {images.map((_, i) => (
            <span key={i} className={i === active ? 'on' : ''} />
          ))}
        </div>
      )}
    </>
  );
}
