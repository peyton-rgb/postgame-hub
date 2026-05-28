"use client";

// ============================================================
// <HomeHeroSlides> — the public, crossfading hero background for
// the homepage. Sits BEHIND the existing centered hero text
// (.hp-hero-inner is already z-index:1, this layer is z-index:0).
//
// Every slide is eager-loaded so a slide never flashes black while
// it waits to download (the exact bug your brand-page hero had).
// A dark scrim keeps the white hero text readable over any photo.
// ============================================================

import { useEffect, useState } from "react";
import { isVideoUrl } from "@/lib/is-video-url";

export interface HeroSlide {
  url: string;
  focalX: number; // 0..1
  focalY: number; // 0..1
  scale: number; // 1 = no zoom
}

export default function HomeHeroSlides({
  slides,
  interval = 5000,
}: {
  slides: HeroSlide[];
  interval?: number;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setActive((p) => (p + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [slides.length, interval]);

  if (!slides.length) return null;

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }}>
      {slides.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            inset: 0,
            opacity: i === active ? 1 : 0,
            transition: "opacity 1.2s ease",
          }}
        >
          {isVideoUrl(s.url) ? (
            <video
              src={s.url}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${s.focalX * 100}% ${s.focalY * 100}%`,
                transform: `scale(${s.scale})`,
              }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.url}
              alt=""
              loading="eager"
              // @ts-expect-error fetchpriority is valid HTML, not yet in React's types
              fetchpriority={i === 0 ? "high" : "auto"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${s.focalX * 100}% ${s.focalY * 100}%`,
                transform: `scale(${s.scale})`,
              }}
            />
          )}
        </div>
      ))}
      {/* Darkening scrim so the centered hero text stays legible */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </div>
  );
}
