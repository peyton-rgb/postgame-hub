"use client";

// The hero photo: one pane on the right, cross-fading between the chosen
// stills, with the horizontal gradient that puts the copy on solid black.
//
// The pane is the point. A full-bleed photo behind an overlay has to be
// cropped to the frame's aspect ratio, which is why a portrait shot could not
// be used at all before. Here a portrait fills the pane's width and is panned
// vertically, where the overflow actually is.
//
// Four values per still, and which element each one moves matters:
//
//   across (x)  moves the PANE — translateX((x - 100) * 0.42)%. It must not
//               touch object-position: a portrait photo fills the pane's
//               width, so there is no horizontal overflow and panning the
//               image does nothing at all. The slider would move and the
//               picture would sit still.
//   up/down (y) moves the IMAGE — the Y of object-position.
//   zoom        scales the image.
//   fade        drives --fade on the gradient.
//
// The pane transform and the gradient both follow the CURRENT slide, so they
// animate along with the cross-fade rather than staying on the first still.
import { useEffect, useMemo, useState } from "react";
import { RecapImage } from "../RecapImage";
import { FOCAL_DEFAULTS, type FocalPoint } from "@/lib/recap-v2/config";

export interface HeroSlide {
  id: string;
  url: string;
  /** Framing chosen in the builder. Absent means FOCAL_DEFAULTS. */
  focal?: FocalPoint;
}

const INTERVAL_MS = 6500;

/** The mockup's mapping, kept exactly: x=100 rests at 0, x=0 pulls 42% left. */
function paneShift(x: number): string {
  return `translateX(${(x - 100) * 0.42}%)`;
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0);
  // 54 media rows exceed the transformer's source-file ceiling and answer 400.
  // A still that cannot be transformed is dropped rather than backed by a
  // 30MB original. If every one fails the hero falls back to the flat black
  // plate, which it already has to support: 2 campaigns have no media at all.
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

  // A dropped slide can leave the index past the end.
  const index = live.length === 0 ? 0 : current % live.length;
  const focal = live[index]?.focal ?? FOCAL_DEFAULTS;

  if (live.length === 0) return null;

  return (
    <>
      <div
        className="rv-hero-pane transition-transform duration-500 ease-out"
        style={{ transform: paneShift(focal.x) }}
        aria-hidden="true"
      >
        {live.map((sl, i) => {
          const f = sl.focal ?? FOCAL_DEFAULTS;
          return (
            <div
              key={sl.id}
              className={`absolute inset-0 transition-opacity duration-[1400ms] ease-out ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            >
              <RecapImage
                src={sl.url}
                alt=""
                width={1600}
                className="h-full w-full object-cover transition-[object-position,transform] duration-500 ease-out"
                style={{
                  // X pinned at 50% deliberately — see the note above.
                  objectPosition: `50% ${f.y}%`,
                  transform: `scale(${f.scale})`,
                }}
                onUnavailable={() => setDead((d) => new Set(d).add(sl.id))}
              />
            </div>
          );
        })}
      </div>

      <div
        className="rv-hero-grad transition-[background] duration-500"
        style={{ ["--fade" as string]: `${focal.fade}%` }}
        aria-hidden="true"
      />

      {many ? (
        <div className="absolute bottom-[62px] right-[var(--gutter)] z-[4] flex gap-[9px] min-[1001px]:bottom-[100px]">
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
