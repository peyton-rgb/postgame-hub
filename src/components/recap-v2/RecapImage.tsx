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
//  2. Supabase's transformer refuses anything over ~25MB, answering
//     400 InvalidRequest "The source image file is too large to process".
//     54 rows in the library are over that line, the largest 357MB.
//
// On failure this reports up rather than silently retrying the original. That
// is deliberate: the untransformed file IS the 35MB one, and quietly pulling
// it to fill a thumbnail would be a far worse outcome than not showing the
// tile — especially on a phone. The caller decides what to do with the gap;
// both current callers drop the image and say how many were skipped.
import { useState } from "react";
import { transformed } from "./media";

export function RecapImage({
  src,
  alt,
  width,
  className = "",
  onRatio,
  onUnavailable,
}: {
  src: string;
  alt: string;
  width: number;
  className?: string;
  onRatio?: (ratio: number) => void;
  onUnavailable?: () => void;
}) {
  const [dead, setDead] = useState(false);
  if (dead) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={transformed(src, width)}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
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
