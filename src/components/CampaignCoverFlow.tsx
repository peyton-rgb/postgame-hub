"use client";

// Postgame — scroll-driven cover flow for the campaign page.
// Auto-advances on its own and pauses on hover; manual drag/touch still works.
// NOTE: vertical mouse-wheel is intentionally NOT hijacked, so the page scrolls
// normally when the cursor is over the strip.

import { useEffect, useRef } from "react";

export type CampaignCard = {
  id: string;
  name: string;
  brand: string;
  slug: string;
  hero: string;
  logoLight: string | null;
  logoChip: string | null;
};

const ORANGE = "#D73F09";
const BEBAS = { fontFamily: "var(--font-bebas), sans-serif" } as const;
const CARD_W = 300;
const AUTO_MS = 3500; // how long it rests on each card before advancing

export default function CampaignCoverFlow({
  campaigns,
  hrefBase = "",
}: {
  campaigns: CampaignCard[];
  hrefBase?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const cards = () => Array.from(scroller.children) as HTMLElement[];

    const setPad = () => {
      const pad = Math.max(20, (scroller.clientWidth - CARD_W) / 2);
      scroller.style.paddingLeft = `${pad}px`;
      scroller.style.paddingRight = `${pad}px`;
    };

    // Tilt/scale/fade each card based on distance from center.
    const update = () => {
      const r = scroller.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      cards().forEach((card) => {
        const cr = card.getBoundingClientRect();
        const c = cr.left + cr.width / 2;
        const n = (c - cx) / (r.width / 2);
        const a = Math.min(Math.abs(n), 1);
        card.style.transform = `perspective(1500px) rotateY(${-n * 26}deg) scale(${1 - a * 0.24})`;
        card.style.opacity = `${1 - a * 0.5}`;
        card.style.zIndex = `${Math.round(100 - a * 50)}`;
        const cta = card.querySelector<HTMLElement>("[data-cta]");
        if (cta) {
          const focused = a < 0.16;
          cta.style.opacity = focused ? "1" : "0";
          cta.style.transform = focused ? "none" : "translateY(6px)";
        }
      });
    };

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => { update(); ticking = false; });
      }
    };
    const onResize = () => { setPad(); update(); };

    // Center a given card WITHOUT touching vertical page scroll.
    const centerDelta = (card: HTMLElement) => {
      const s = scroller.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      return (c.left + c.width / 2) - (s.left + s.width / 2);
    };
    const centeredIndex = () => {
      let best = 0, bestDist = Infinity;
      cards().forEach((card, i) => {
        const d = Math.abs(centerDelta(card));
        if (d < bestDist) { bestDist = d; best = i; }
      });
      return best;
    };
    const goTo = (i: number) => {
      const card = cards()[i];
      if (!card) return;
      scroller.scrollTo({ left: scroller.scrollLeft + centerDelta(card), behavior: "smooth" });
    };

    // shared state
    let paused = false, current = 0, dir = 1;
    let down = false, sx = 0, sl = 0, moved = false;

    // drag to scroll
    const onDown = (e: PointerEvent) => {
      down = true; moved = false; sx = e.clientX; sl = scroller.scrollLeft;
      scroller.classList.add("dragging");
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      if (Math.abs(e.clientX - sx) > 6) moved = true;
      scroller.scrollLeft = sl - (e.clientX - sx);
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      scroller.classList.remove("dragging");
      current = centeredIndex(); // resync auto-scroll to where we landed
    };
    const onClick = (e: MouseEvent) => { if (moved) { e.preventDefault(); e.stopPropagation(); } };

    // auto-scroll, pauses on hover / drag
    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    const tick = () => {
      if (paused || down) return;
      const n = cards().length;
      if (n <= 1) return;
      if (current >= n - 1) dir = -1;
      else if (current <= 0) dir = 1;
      current += dir;
      goTo(current);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("pointerdown", onDown);
    scroller.addEventListener("click", onClick, true);
    scroller.addEventListener("pointerenter", onEnter);
    scroller.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", onResize);

    setPad();
    update();

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let intervalId = 0;
    if (!reduce) intervalId = window.setInterval(tick, AUTO_MS);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("pointerdown", onDown);
      scroller.removeEventListener("click", onClick, true);
      scroller.removeEventListener("pointerenter", onEnter);
      scroller.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      if (intervalId) clearInterval(intervalId);
    };
  }, [campaigns]);

  if (!campaigns.length) return null;

  return (
    <div className="w-full">
      <div
        ref={scrollerRef}
        className="flex items-center gap-6 overflow-x-auto py-10 snap-x snap-mandatory cursor-grab select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&.dragging]:cursor-grabbing [&.dragging]:snap-none"
      >
        {campaigns.map((c) => (
          <a
            key={c.id}
            href={`${hrefBase}/${c.slug}`}
            aria-label={`${c.brand} — ${c.name}`}
            className="relative block shrink-0 w-[300px] h-[448px] snap-center overflow-hidden rounded-[22px] bg-black border border-white/10 will-change-transform"
          >
            <img src={c.hero} alt={`${c.brand} ${c.name}`} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(8,8,11,.3), transparent 38%, rgba(8,8,11,.9))" }} />
            <div className="absolute top-[18px] left-[18px]">
              <BrandLogo light={c.logoLight} chip={c.logoChip} alt={c.brand} />
            </div>
            <div className="absolute left-5 right-5 bottom-5">
              <span className="text-[10px] font-bold uppercase tracking-[2.4px]" style={{ color: ORANGE }}>{c.brand}</span>
              <div className="uppercase leading-[.9] tracking-[.5px] text-[36px] mt-[5px] text-[#FAF8F5]" style={BEBAS}>{c.name}</div>
              <div data-cta className="flex items-center gap-[7px] mt-3 text-[10px] uppercase tracking-[2px] text-[#FAF8F5] opacity-0 translate-y-[6px] transition-all duration-[400ms]">
                View recap <span style={{ color: ORANGE }}>&rarr;</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function BrandLogo({ light, chip, alt }: { light: string | null; chip: string | null; alt: string }) {
  // Light wordmark, shown directly on the photo: uniform 32px tall, wide ones capped at 120px.
  if (light)
    return <img src={light} alt={alt} className="h-[32px] w-auto max-w-[120px] object-contain object-left" />;
  // Colored logo on a white pill: pill is 32px tall (matches the light-logo height) with ~8px side
  // padding, capped at 140px wide; the logo inside is ~20px tall so square + wide marks stay consistent.
  if (chip)
    return (
      <span className="inline-flex items-center h-[32px] max-w-[140px] px-2 rounded-full bg-white/90">
        <img src={chip} alt={alt} className="h-[20px] w-auto max-w-full object-contain" />
      </span>
    );
  return null;
}
