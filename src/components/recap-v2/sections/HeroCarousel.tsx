"use client";

// The hero stills, cross-fading on a 6.5s cycle with a slow parallax drift.
//
// Client-only because of the timer. Everything else in the hero — brand mark,
// title, meta — is server-rendered above this, so a campaign with no usable
// media (2 of 82) simply never mounts it and the flat black plate stands on
// its own.
import { useEffect, useMemo, useState } from "react";
import { RecapImage } from "../RecapImage";

const INTERVAL_MS = 6500;

export function HeroCarousel({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);
  // 54 media rows are too large for Supabase's transformer, which 400s rather
  // than resizing them. A hero still that cannot be transformed is dropped
  // outright — the alternative is pulling a 35MB original to sit behind the
  // title. If every still fails, the hero falls back to the flat black plate,
  // which is a state it already has to support: 2 campaigns have no media.
  const [dead, setDead] = useState<Set<string>>(new Set());
  const live = useMemo(() => images.filter((s) => !dead.has(s)), [images, dead]);
  const many = live.length > 1;

  useEffect(() => {
    if (!many) return;
    // Respect the OS setting: this loops for as long as the page is open.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = setInterval(() => setCurrent((c) => (c + 1) % live.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [live.length, many]);

  // A dropped slide can leave the index past the end.
  const index = live.length === 0 ? 0 : current % live.length;

  if (live.length === 0) return null;

  return (
    <>
      <div className="absolute inset-0" aria-hidden="true">
        {live.map((src, i) => (
          <div
            key={src}
            // Scales alternate slightly so consecutive stills do not drift in
            // lockstep, which reads as the whole plate sliding.
            style={{ "--slide-scale": 1.08 + (i % 3) * 0.04 } as React.CSSProperties}
            className={`rv-slide absolute inset-0 transition-opacity duration-[1400ms] ease-out ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          >
            <RecapImage
              src={src}
              alt=""
              width={1600}
              className="h-full w-full object-cover"
              onUnavailable={() => setDead((d) => new Set(d).add(src))}
            />
          </div>
        ))}
      </div>
      {many ? (
        <div className="absolute bottom-[62px] right-[var(--gutter)] z-[4] flex gap-[9px] min-[1001px]:bottom-[100px]">
          {live.map((src, i) => (
            <button
              key={src}
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
