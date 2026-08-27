"use client";

// An <img> that measures its own aspect ratio and reports a failed transform.
//
// Two problems this solves, both from the data audit:
//
//  1. media.aspect_ratio is non-null on 0 of 4,434 rows and `resolution` on
//     only ~9% — worse than none, because a masonry laid out from it would be
//     right for one tile in eleven. So the ratio is measured client-side on
//     load and applied to the tile, which is what stops the column reflowing
//     as images arrive.
//
//  2. Supabase's transformer refuses large SOURCE files, answering
//     400 InvalidRequest "The source image file is too large to process".
//     The ceiling is between 22.0MB and 24.2MB, measured — lower than the
//     25MB usually quoted. Ghost Amp alone has two such photos.
//
// On failure this reports up rather than silently retrying the original. That
// is deliberate: the untransformed file IS the 35MB one, and quietly pulling
// it to fill a thumbnail would be a far worse outcome than not showing the
// tile — especially on a phone. The caller decides what to do with the gap;
// both current callers drop the image and say how many were skipped.
import { useState } from "react";
import { displayImage } from "./media";

export function RecapImage({
  src,
  alt,
  className = "",
  style,
  onRatio,
  onUnavailable,
}: {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  onRatio?: (ratio: number) => void;
  onUnavailable?: () => void;
}) {
  const [dead, setDead] = useState(false);
  if (dead) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={displayImage(src)}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      style={style}
      onLoad={(e) => {
        const el = e.currentTarget;
        if (onRatio && el.naturalWidth > 0 && el.naturalHeight > 0) {
          onRatio(el.naturalWidth / el.naturalHeight);
        }
      }}
      onError={() => {
        setDead(true);
        onUnavailable?.();
      }}
    />
  );
}
