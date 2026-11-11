'use client';

// Draws a carousel exactly the way the old artifact did: a 5400×1350 strip
// (five 1080×1350 slides) scaled down to fit, every layer positioned by the
// shared rules in lib/carousel/layout, and every clip locked to one 6-second
// clock so the carousel loops as a whole. The editor passes `overlay` (handles,
// snap lines, measurements) and pointer handlers; viewing needs neither.

import type { ScrubSheet } from '@/lib/carousel/frameio-clips';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { DUR, H, SLIDE, W, clipTime, placeLayer, type Layer, type Layout, type MediaInfo } from '@/lib/carousel/layout';
import { lookFor, needsScene, preFor, refineLook, type Look, type Pre } from '@/lib/carousel/grade';
import { filmAmount, filmGeo } from '@/lib/carousel/film';
import { useGraded, useScenes } from './gradeImage';
import GradeCanvas from './GradeCanvas';

export type CanvasMedia = MediaInfo & { src: string | null; thumb: string | null; strip?: string | null; scrub?: ScrubSheet | null; hasFull?: boolean; stream?: 'hls' | null; source?: string };

// Frame.io streams video as HLS (a playlist of short chunks). Safari plays it
// natively; Chrome needs hls.js. The shared clock still seeks/plays it.
function StreamVideo({ id, src, style, cors }: { id: string; src: string | null; style: React.CSSProperties; cors?: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = v.current;
    if (!el || !src) return;
    let destroy: (() => void) | undefined;
    if (el.canPlayType('application/vnd.apple.mpegurl')) el.src = src;
    else import('hls.js').then(({ default: Hls }) => {
      if (!Hls.isSupported()) return;
      const hls = new Hls({ maxBufferLength: 12 });
      hls.loadSource(src); hls.attachMedia(el);
      destroy = () => hls.destroy();
    });
    return () => { destroy?.(); el.removeAttribute('src'); el.load(); };
  }, [src]);
  return <video ref={v} data-id={id} crossOrigin={cors ? 'anonymous' : undefined} muted loop playsInline preload="auto" style={style} />;
}
// A video drawn as its thumbnail (slide previews), through its grade.
function StillThumb({ url, look, pre, style }: { url: string; look: Look | null; pre: Pre | null; style: React.CSSProperties }) {
  const src = useGraded(url, look, 1024, pre);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src ?? url} alt="" draggable={false} crossOrigin={look ? 'anonymous' : undefined} style={style} />;
}
export type CanvasHandle = { toStage: (clientX: number, clientY: number) => { x: number; y: number }; scale: number; el: HTMLDivElement | null };

type Props = {
  layout: Layout;
  media: Record<string, CanvasMedia>;
  playing: boolean;
  showSeams?: boolean;
  /** 'all' fits the whole strip; a slide number (0–4) zooms to that slide with its neighbours dimmed. */
  view?: 'all' | number;
  /** Cap the drawn height (px) so a zoomed slide still fits on screen. */
  maxHeight?: number;
  /** Jump the shared clock to t seconds; bump n to re-seek to the same t. */
  seek?: { t: number; n: number };
  onTick?: (t: number) => void;
  /** Draw videos as their thumbnail picture — for small previews that shouldn't decode video. */
  still?: boolean;
  /**
   * Pasteboard: this many strip pixels of working room around the canvas (editor only).
   * A layer dragged or resized past the canvas edge stays visible (dimmed) out there, and
   * its handles stay grabbable, so it can be made bigger than a slide and then cropped in.
   */
  bleed?: number;
  overlay?: (scale: number) => React.ReactNode;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
};

const CarouselCanvas = forwardRef<CanvasHandle, Props>(function CarouselCanvas(
  { layout, media, playing, showSeams = true, overlay, onPointerDown, onPointerMove, onPointerUp, view = 'all', maxHeight, seek, onTick, still, bleed = 0 },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const [gradeFailed, setGradeFailed] = useState<Set<string>>(new Set());
  // Canon clips on Auto: green screen → as shot, anywhere else → brightened.
  const scenes = useScenes(layout.layers.map((l) => { const m = media[l.media]; return m && (l.grade ?? 'auto') === 'auto' && needsScene(lookFor(l, m)) ? m.thumb : null; }));
  const stage = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(800);
  // Zoomed view: the slide plus 260px of each neighbour, so seams still line up by eye.
  const PAD = 260;
  // With a pasteboard the view may run past the strip's ends (and above/below it) by `bleed`.
  const x0 = view === 'all' ? -bleed : Math.max(-bleed, view * SLIDE - PAD);
  const x1 = view === 'all' ? W + bleed : Math.min(W + bleed, (view + 1) * SLIDE + PAD);
  const scale = Math.min(boxW / (x1 - x0), maxHeight ? maxHeight / H : Infinity);
  const clock = useRef({ t0: performance.now(), pausedAt: 0 });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const syncRef = useRef<((force?: boolean) => void) | null>(null);

  useImperativeHandle(ref, () => ({
    toStage: (cx, cy) => {
      const r = stage.current!.getBoundingClientRect();
      return { x: (cx - r.left) / scale, y: (cy - r.top) / scale };
    },
    scale,
    el: stage.current,
  }), [scale]);

  // Fit the 5400px strip to whatever width the page gives us.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only clip choices/sections should force a re-seek — not every drag of a box.
  const clipKey = useMemo(
    () => layout.layers.map((l) => `${l.id}:${l.media}:${l.vin ?? ''}:${l.vlen ?? ''}`).join('|'),
    [layout],
  );

  // Keep every clip on the shared clock (same 0.12s tolerance as the artifact).
  useEffect(() => {
    const c = clock.current;
    const now = () => (playing ? (performance.now() - c.t0) / 1000 : c.pausedAt);
    if (playing) c.t0 = performance.now() - c.pausedAt * 1000;
    else c.pausedAt = (performance.now() - c.t0) / 1000;
    const sync = (force = false) => {
      const t = now() % DUR;
      stage.current?.querySelectorAll('video').forEach((v) => {
        const L = layoutRef.current.layers.find((l) => l.id === v.dataset.id);
        if (!L) return;
        const m = media[L.media];
        const target = clipTime(L, m, t, !!m?.hasFull, v.duration);
        if (force || Math.abs(v.currentTime - target) > 0.12) {
          try { v.currentTime = target; } catch { /* not seekable yet */ }
        }
        if (playing) v.play().catch(() => {});
        else v.pause();
      });
    };
    sync(true);
    const id = window.setInterval(() => { sync(); onTickRef.current?.(now() % DUR); }, 250);
    syncRef.current = sync;
    return () => window.clearInterval(id);
  }, [playing, media, clipKey]);

  // Scrubbing: move the shared clock and re-seek every clip.
  useEffect(() => {
    if (!seek) return;
    const c = clock.current;
    c.pausedAt = seek.t; c.t0 = performance.now() - seek.t * 1000;
    syncRef.current?.(true);
    onTickRef.current?.(seek.t);
  }, [seek?.n]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div ref={wrap} className="relative w-full overflow-hidden bg-[#0b0b0c]" style={{ height: (H + 2 * bleed) * scale, touchAction: onPointerDown ? 'none' : undefined }}>
      <div
        ref={stage}
        className="absolute select-none bg-black"
        style={{ width: W, height: H, top: bleed * scale, left: ((boxW - (x1 - x0) * scale) / 2) - x0 * scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {layout.layers.map((L: Layer) => {
          if (L.type === 'text') {
            return (
              <div key={L.id} data-layer={L.id} title={L.name}
                style={{
                  position: 'absolute', left: L.x, top: L.y, display: L.hidden ? 'none' : undefined,
                  // next/font hashes family names — go through the CSS variables (see tailwind.config.js).
                  fontFamily: L.font === 'Arimo' ? 'var(--font-arimo), Arial, sans-serif'
                    : L.font === 'Anton' ? 'var(--font-anton), Impact, sans-serif'
                    : 'var(--font-bebas), Impact, sans-serif',
                  fontSize: L.size ?? 40, fontWeight: L.weight ?? 400, color: L.color ?? '#fff', opacity: L.opacity ?? 1,
                  lineHeight: 1, whiteSpace: 'pre',
                  transform: L.align === 'center' ? 'translateX(-50%)' : L.align === 'right' ? 'translateX(-100%)' : undefined,
                  cursor: onPointerDown ? (L.locked ? 'default' : 'move') : undefined,
                }}>
                {L.text}
              </div>
            );
          }
          const m = media[L.media];
          if (!m) return null;
          const p = placeLayer(L, m);
          const auto = (L.grade ?? 'auto') === 'auto', scene = m.thumb ? scenes[m.thumb] : false;
          const look = refineLook(lookFor(L, m), auto, scene);
          const pre = look ? preFor(lookFor(L, m), auto, scene) : null;
          // Ask for readable pixels whenever the clip *might* be graded — Auto's
          // green-screen check finishes after the video starts loading, and a
          // video fetched without CORS can't be graded later.
          // Super 8 film look: drawn over clips and photos, with the grade underneath.
          const film = still ? 0 : filmAmount(L, m.kind);
          const cors = !!look || !!lookFor(L, m) || film > 0;
          const mediaStyle: React.CSSProperties = {
            position: 'absolute', display: 'block', maxWidth: 'none', pointerEvents: 'none',
            ...p.media, filter: p.filter,
          };
          return (
            <div
              key={L.id}
              data-layer={L.id}
              title={L.name}
              style={{
                position: 'absolute', overflow: 'hidden', display: L.hidden ? 'none' : undefined,
                ...p.frame, boxShadow: p.shadowBox ? '0 18px 60px rgba(0,0,0,.55)' : undefined,
                cursor: onPointerDown ? (L.locked ? 'default' : 'move') : undefined,
              }}
            >
              {m.kind === 'video' && still ? (
                m.thumb ? <StillThumb url={m.thumb} look={look} pre={pre} style={mediaStyle} />
                : <div style={{ ...mediaStyle, background: '#1c1c1c' }} />
              ) : m.kind === 'video' && m.stream === 'hls' ? (
                <StreamVideo key={cors ? 'c' : 'p'} id={L.id} src={m.src} style={mediaStyle} cors={cors} />
              ) : m.kind === 'video' ? (
                <video key={cors ? 'c' : 'p'} data-id={L.id} src={m.src ?? undefined} crossOrigin={cors ? 'anonymous' : undefined} muted loop playsInline preload="auto" style={mediaStyle} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.src ?? undefined} alt="" draggable={false} style={mediaStyle} />
              )}
              {/* The clip's grade and/or the Super 8 film look, drawn live over the clip or photo */}
              {(() => {
                if (still || !(film > 0 || (m.kind === 'video' && look))) return null;
                const lk = m.kind === 'video' ? look : null;
                const fk = `${L.id}:${lk}:${film > 0 ? 'film' : ''}`;
                if (gradeFailed.has(fk)) return null;
                return (
                  <GradeCanvas key={`${lk}:${film > 0 ? 'film' : ''}`} look={lk} style={mediaStyle}
                    film={film} geo={film > 0 ? filmGeo(p) : undefined} animate={playing} pre={lk ? pre : null}
                    imageSrc={m.kind === 'image' ? m.src : undefined}
                    onFail={() => setGradeFailed((s) => new Set(s).add(fk))} />
                );
              })()}
            </div>
          );
        })}
        {showSeams &&
          [1, 2, 3, 4].map((k) => (
            <div key={k} className="pointer-events-none absolute top-0 bg-white/75" style={{ left: k * SLIDE - 1 / scale, width: 2 / scale, height: H }} />
          ))}
        {view !== 'all' && (
          <>
            <div className="pointer-events-none absolute top-0 left-0" style={{ width: view * SLIDE, height: H, background: 'rgba(7,7,10,.66)' }} />
            <div className="pointer-events-none absolute top-0" style={{ left: (view + 1) * SLIDE, width: W - (view + 1) * SLIDE, height: H, background: 'rgba(7,7,10,.66)' }} />
          </>
        )}
        {/* Pasteboard: anything hanging off the canvas shows dimmed, under the handles */}
        {bleed > 0 && (
          <>
            <div className="pointer-events-none absolute" style={{ left: -bleed, top: -bleed, width: W + 2 * bleed, height: bleed, background: 'rgba(11,11,12,.8)' }} />
            <div className="pointer-events-none absolute" style={{ left: -bleed, top: H, width: W + 2 * bleed, height: bleed, background: 'rgba(11,11,12,.8)' }} />
            <div className="pointer-events-none absolute" style={{ left: -bleed, top: 0, width: bleed, height: H, background: 'rgba(11,11,12,.8)' }} />
            <div className="pointer-events-none absolute" style={{ left: W, top: 0, width: bleed, height: H, background: 'rgba(11,11,12,.8)' }} />
          </>
        )}
        {overlay?.(scale)}
      </div>
    </div>
  );
});

export default CarouselCanvas;
