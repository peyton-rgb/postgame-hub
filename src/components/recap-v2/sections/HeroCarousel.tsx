"use client";

// The hero backdrop: the photo behind the whole hero-and-overview block, plus
// the two gradients that blend it.
//
// It is a backdrop, not a framed image. Sized by height, overspilling the
// block, and masked on all four edges so it dissolves whatever its size or
// position — see .rv-backdrop-img in recap-v2.css, which the builder's preview
// carries too. Framing moves the backdrop rather than cropping inside a box;
// the maths is shared in heroTransform.ts.
//
// The transform and --fade follow the CURRENT slide, so they animate with the
// cross-fade rather than sticking on the first still.
import { useEffect, useMemo, useState } from "react";
import { RecapImage } from "../RecapImage";
import { FOCAL_DEFAULTS, type FocalPoint } from "@/lib/recap-v2/config";
import { backdropTransform } from "@/components/recap-builder/heroTransform";

export interface HeroSlide {
  id: string;
  url: string;
  /** Framing chosen in the builder. Absent means FOCAL_DEFAULTS. */
  focal?: FocalPoint;
}

const INTERVAL_MS = 6500;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0);
  // Media over the transformer's source-file ceiling answers 400. A still that
  // cannot be transformed is dropped rather than backed by a 30MB original; if
  // they all fail the block falls back to flat black, which it has to support
  // anyway for the campaigns with no media at all.
  const [dead, setDead] = useState<Set<string>>(new Set());
  const live = useMemo(() => slides.filter((sl) => !dead.has(sl.id)), [slides, dead]);
  const many = live.length > 1;

  useEffect(() => {
    if (!many) return;
    // Respect the OS setting: this loops for as long as the page is open.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % live.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [live.length, many]);

  const index = live.length === 0 ? 0 : current % live.length;
  const focal = live[index]?.focal ?? FOCAL_DEFAULTS;

  return (
    <>
      {live.length > 0 ? (
        <div className="rv-bg" aria-hidden="true">
          {live.map((sl, i) => (
            <RecapImage
              key={sl.id}
              src={sl.url}
              alt=""
              className={`rv-backdrop-img transition-[opacity,transform] duration-[900ms] ease-out ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
              style={{ transform: backdropTransform(sl.focal ?? FOCAL_DEFAULTS) }}
              onUnavailable={() => setDead((d) => new Set(d).add(sl.id))}
            />
          ))}
        </div>
      ) : null}

      {/* The wash renders even with no photo: its vertical half is what carries
          the block into the page, and a media-less campaign still needs that. */}
      <div
        className="rv-wash"
        style={{ ["--fade" as string]: `${focal.fade}%` }}
        aria-hidden="true"
      />

      {many ? (
        <div className="absolute bottom-5 right-[var(--gutter)] z-[3] flex gap-[9px]">
          {live.map((sl, i) => (
            <button
              key={sl.id}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Show image ${i + 1} of ${live.length}`}
              aria-current={i === index}
              className={`h-[2px] w-[26px] transition-colors duration-300 ${
                i === index ? "bg-[color:var(--rv-white)]" : "bg-white/25"
              }`}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
