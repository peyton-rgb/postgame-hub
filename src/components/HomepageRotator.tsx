"use client";

// ============================================================
// <HomepageRotator> — full-bleed cinematic hero for the homepage.
// Replaces the old hand-typed featured_campaigns cards. One slide per
// hand-picked campaign (campaign_recaps.homepage_featured), ordered by
// homepage_order, fed by getHomepageRotatorCampaigns().
//
// HARDENING:
//  - The poster still is ALWAYS rendered under the video. If the video
//    fails to load or autoplay (e.g. iOS Low Power Mode), or the campaign
//    has no video at all, the poster stays — never a black tile.
//  - Stats that are 0/unavailable are omitted, not shown as "0".
//  - prefers-reduced-motion disables autoplay video, Ken Burns, and
//    auto-advance; posters show and the user clicks through.
//
// Hydration: the first paint is deterministic (active = 0, motion assumed
// on). All time/browser APIs (timers, matchMedia, video.play) run only in
// effects after mount, so server and client markup match.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { RotatorSlide } from "@/lib/getHomepageRotatorCampaigns";

const ORANGE = "#D73F09";
const SLIDE_MS = 7000; // auto-advance interval
const FADE_MS = 900; // crossfade duration

function formatReach(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}

// Returns the stat chips to show for a slide, omitting any that are 0/unavailable.
function statsFor(slide: RotatorSlide): { value: string; unit: string; label: string }[] {
  const out: { value: string; unit: string; label: string }[] = [];
  if (slide.reach > 0) out.push({ value: formatReach(slide.reach), unit: "", label: "Reach" });
  if (slide.engRate > 0)
    out.push({ value: slide.engRate.toFixed(1), unit: "%", label: "Engagement" });
  if (slide.athleteCount > 0)
    out.push({ value: String(slide.athleteCount), unit: "", label: slide.athleteCount === 1 ? "Athlete" : "Athletes" });
  return out;
}

export default function HomepageRotator({ slides }: { slides: RotatorSlide[] }) {
  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  // Slides whose video failed to load/play — fall back to poster-only.
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  const n = slides.length;

  // Detect prefers-reduced-motion after mount (keeps first paint deterministic).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const go = useCallback(
    (dir: number) => setActive((p) => (p + dir + n) % n),
    [n]
  );
  const goTo = useCallback((i: number) => setActive(((i % n) + n) % n), [n]);

  // Auto-advance — disabled when reduced motion, paused (hover), or single slide.
  useEffect(() => {
    if (reduced || paused || n <= 1) return;
    const t = setTimeout(() => setActive((p) => (p + 1) % n), SLIDE_MS);
    return () => clearTimeout(t);
  }, [active, reduced, paused, n]);

  // Play the active slide's video (best-effort). On failure, reveal the poster.
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => setFailed((f) => ({ ...f, [active]: true })));
  }, [active]);

  if (!n) return null;

  const cur = slides[active];
  const showVideo = !reduced && !!cur.heroVideo && !failed[active];

  return (
    <section
      className="hr-root"
      aria-roledescription="carousel"
      aria-label="Featured campaigns"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <style dangerouslySetInnerHTML={{ __html: HR_CSS }} />

      {/* ── Background layers (crossfade). Poster always under the video. ── */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`hr-slide${i === active ? " hr-slide-active" : ""}`}
          aria-hidden={i === active ? undefined : true}
          style={{ transition: `opacity ${FADE_MS}ms ease` }}
        >
          <div className={`hr-bg${i === active && !reduced ? " hr-kenburns" : ""}`}>
            {/* Poster still — ALWAYS present so a slide is never black. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.poster ?? s.hero}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              className="hr-media"
            />
            {/* Active slide's video sits on top of its poster; key forces a
                fresh element (and autoplay-from-start) on every slide change. */}
            {i === active && showVideo && (
              <video
                key={`v-${active}`}
                ref={videoRef}
                className="hr-media hr-video"
                src={cur.heroVideo as string}
                poster={s.poster ?? s.hero}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                onError={() => setFailed((f) => ({ ...f, [active]: true }))}
              />
            )}
          </div>
          {/* Vignette: stronger left + bottom for text legibility. */}
          <div className="hr-vignette" />
        </div>
      ))}
      {/* Grain overlay (single, above all slides, below content). */}
      <div className="hr-grain" aria-hidden />

      {/* ── Index counter (top-right) ── */}
      {n > 1 && (
        <div className="hr-counter" aria-hidden>
          {String(active + 1).padStart(2, "0")} <span className="hr-counter-sep">/</span>{" "}
          {String(n).padStart(2, "0")}
        </div>
      )}

      {/* ── Content panel (bottom-left). key=active retriggers the stagger. ── */}
      <div className="hr-content" key={active}>
        {cur.brand && <div className="hr-chip hr-stagger hr-s1">{cur.brand}</div>}
        <h2 className="hr-title hr-stagger hr-s2">{cur.name}</h2>
        {cur.description && (
          <p className="hr-desc hr-stagger hr-s3">{cur.description}</p>
        )}
        {statsFor(cur).length > 0 && (
          <div className="hr-stats hr-stagger hr-s4">
            {statsFor(cur).map((st, i) => (
              <div className="hr-stat" key={i}>
                <div className="hr-stat-num">
                  {st.value}
                  {st.unit && <span className="hr-stat-unit">{st.unit}</span>}
                </div>
                <div className="hr-stat-label">{st.label}</div>
              </div>
            ))}
          </div>
        )}
        <a
          className="hr-cta hr-stagger hr-s5"
          href={`/recap/${cur.slug}`}
        >
          View Recap
          <span className="hr-cta-arrow" aria-hidden>→</span>
        </a>
      </div>

      {/* ── Progress dots (bottom-left, below content) ── */}
      {n > 1 && (
        <div className="hr-dots" role="tablist" aria-label="Choose slide">
          {slides.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === active}
              aria-label={`Slide ${i + 1}: ${s.name}`}
              className={`hr-dot${i === active ? " hr-dot-active" : ""}`}
              onClick={() => goTo(i)}
            >
              <span
                className="hr-dot-fill"
                style={
                  i === active && !reduced && !paused
                    ? { animationDuration: `${SLIDE_MS}ms` }
                    : i === active
                    ? { width: "100%" }
                    : undefined
                }
              />
            </button>
          ))}
        </div>
      )}

      {/* ── Prev / Next (bottom-right) ── */}
      {n > 1 && (
        <div className="hr-arrows">
          <button className="hr-arrow" aria-label="Previous slide" onClick={() => go(-1)}>
            ‹
          </button>
          <button className="hr-arrow" aria-label="Next slide" onClick={() => go(1)}>
            ›
          </button>
        </div>
      )}
    </section>
  );
}

const HR_CSS = `
.hr-root{
  position:relative;
  width:100vw;
  margin-left:calc(50% - 50vw);
  height:clamp(440px,72vh,680px);
  overflow:hidden;
  background:#07070a;
  isolation:isolate;
}
.hr-slide{position:absolute;inset:0;opacity:0;z-index:0;}
.hr-slide-active{opacity:1;z-index:1;}
.hr-bg{position:absolute;inset:0;overflow:hidden;}
.hr-media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 30%;}
.hr-video{z-index:1;}
.hr-kenburns{animation:hrKen 9s ease-out both;}
@keyframes hrKen{from{transform:scale(1.001)}to{transform:scale(1.08)}}
.hr-vignette{
  position:absolute;inset:0;z-index:2;pointer-events:none;
  background:
    linear-gradient(to right, rgba(7,7,10,0.82) 0%, rgba(7,7,10,0.35) 38%, rgba(7,7,10,0) 70%),
    linear-gradient(to top, rgba(7,7,10,0.92) 0%, rgba(7,7,10,0.25) 45%, rgba(7,7,10,0) 78%);
}
.hr-grain{
  position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0.06;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
.hr-counter{
  position:absolute;top:24px;right:28px;z-index:5;
  font-family:'JetBrains Mono',ui-monospace,monospace;
  font-size:13px;letter-spacing:0.12em;color:rgba(255,255,255,0.72);
}
.hr-counter-sep{color:rgba(255,255,255,0.35);}
.hr-content{
  position:absolute;left:0;bottom:0;z-index:5;
  max-width:min(620px,86vw);
  padding:0 0 56px 48px;
}
.hr-chip{
  display:inline-block;
  font-family:'JetBrains Mono',ui-monospace,monospace;
  font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;
  color:rgba(255,255,255,0.85);
  background:rgba(255,255,255,0.08);
  border:1px solid rgba(255,255,255,0.14);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  padding:7px 12px;border-radius:999px;margin-bottom:16px;
}
.hr-title{
  font-family:var(--font-bebas),'Bebas Neue',Arial,sans-serif;
  text-transform:uppercase;
  font-size:clamp(40px,6.4vw,86px);line-height:0.92;letter-spacing:0.01em;
  color:#fff;margin:0 0 14px;
}
.hr-desc{
  font-size:17px;line-height:1.45;color:rgba(255,255,255,0.66);
  max-width:480px;margin:0 0 22px;
}
.hr-stats{display:flex;gap:36px;margin-bottom:26px;}
.hr-stat-num{
  font-family:var(--font-bebas),'Bebas Neue',Arial,sans-serif;
  font-size:40px;line-height:1;color:#fff;letter-spacing:0.02em;
}
.hr-stat-unit{color:${ORANGE};margin-left:2px;}
.hr-stat-label{
  font-family:'JetBrains Mono',ui-monospace,monospace;
  font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;
  color:rgba(255,255,255,0.5);margin-top:7px;
}
.hr-cta{
  display:inline-flex;align-items:center;gap:9px;
  background:${ORANGE};color:#fff;text-decoration:none;
  font-size:14px;font-weight:700;letter-spacing:0.02em;
  padding:13px 22px;border-radius:10px;
  transition:transform 0.18s ease,filter 0.18s ease;
}
.hr-cta:hover{filter:brightness(1.08);transform:translateY(-1px);}
.hr-cta-arrow{transition:transform 0.18s ease;}
.hr-cta:hover .hr-cta-arrow{transform:translateX(3px);}
.hr-dots{
  position:absolute;left:48px;bottom:24px;z-index:5;display:flex;gap:8px;
}
.hr-dot{
  position:relative;width:34px;height:4px;border:none;padding:0;cursor:pointer;
  border-radius:999px;background:rgba(255,255,255,0.22);overflow:hidden;
}
.hr-dot-fill{position:absolute;left:0;top:0;height:100%;width:0;background:${ORANGE};border-radius:999px;}
.hr-dot-active .hr-dot-fill{animation:hrFill linear both;}
@keyframes hrFill{from{width:0}to{width:100%}}
.hr-arrows{
  position:absolute;right:28px;bottom:24px;z-index:5;display:flex;gap:10px;
}
.hr-arrow{
  width:44px;height:44px;border-radius:50%;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  font-size:24px;line-height:1;color:#fff;
  background:rgba(255,255,255,0.08);
  border:1px solid rgba(255,255,255,0.16);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  transition:background 0.18s ease,border-color 0.18s ease;
}
.hr-arrow:hover{background:rgba(255,255,255,0.16);border-color:rgba(215,63,9,0.6);}
/* Staggered entrance on each slide change */
.hr-stagger{opacity:0;animation:hrUp 0.6s ease both;}
.hr-s1{animation-delay:0.05s;}
.hr-s2{animation-delay:0.15s;}
.hr-s3{animation-delay:0.25s;}
.hr-s4{animation-delay:0.35s;}
.hr-s5{animation-delay:0.45s;}
@keyframes hrUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:900px){
  .hr-content{padding:0 0 64px 22px;max-width:90vw;}
  .hr-dots{left:22px;}
  .hr-arrows{right:18px;}
  .hr-stats{gap:24px;}
  .hr-stat-num{font-size:32px;}
  .hr-counter{right:18px;top:18px;}
}
/* Reduced motion: no entrance animation, no Ken Burns, no progress fill. */
@media(prefers-reduced-motion:reduce){
  .hr-stagger{opacity:1;animation:none;}
  .hr-kenburns{animation:none;}
  .hr-dot-active .hr-dot-fill{animation:none;width:100%;}
  .hr-slide{transition:none !important;}
  .hr-cta,.hr-cta-arrow,.hr-arrow{transition:none;}
}
`;
