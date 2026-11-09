'use client';

// Draws a carousel exactly the way the old artifact did: a 5400×1350 strip
// (five 1080×1350 slides) scaled down to fit, every layer positioned by the
// shared rules in lib/carousel/layout, and every clip locked to one 6-second
// clock so the carousel loops as a whole. The editor passes `overlay` (handles,
// snap lines, measurements) and pointer handlers; viewing needs neither.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { DUR, H, SLIDE, W, clipTime, placeLayer, type Layer, type Layout, type MediaInfo } from '@/lib/carousel/layout';

export type CanvasMedia = MediaInfo & { src: string | null; thumb: string | null; strip?: string | null; hasFull?: boolean; stream?: 'hls' | null; source?: string };

// Frame.io streams video as HLS (a playlist of short chunks). Safari plays it
// natively; Chrome needs hls.js. The shared clock still seeks/plays it.
function StreamVideo({ id, src, style }: { id: string; src: string | null; style: React.CSSProperties }) {
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
  return <video ref={v} data-id={id} muted loop playsInline preload="auto" style={style} />;
}
export type CanvasHandle = { toStage: (clientX: number, clientY: number) => { x: number; y: number }; scale: number; el: HTMLDivElement | null };

type Props = {
  layout: Layout;
  media: Record<string, CanvasMedia>;
  playing: boolean;
  showSeams?: boolean;
  overlay?: (scale: number) => React.ReactNode;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
};

const CarouselCanvas = forwardRef<CanvasHandle, Props>(function CarouselCanvas(
  { layout, media, playing, showSeams = true, overlay, onPointerDown, onPointerMove, onPointerUp },
  ref,
) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.15);
  const clock = useRef({ t0: performance.now(), pausedAt: 0 });
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

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
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
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
    const id = window.setInterval(() => sync(), 250);
    return () => window.clearInterval(id);
  }, [playing, media, clipKey]);

  const layers = useMemo(() => layout.layers.filter((l): l is Layer => l.type !== 'text'), [layout]);

  return (
    <div ref={wrap} className="relative w-full overflow-hidden bg-[#0b0b0c]" style={{ height: H * scale, touchAction: onPointerDown ? 'none' : undefined }}>
      <div
        ref={stage}
        className="absolute left-0 top-0 select-none bg-black"
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {layers.map((L) => {
          const m = media[L.media];
          if (!m) return null;
          const p = placeLayer(L, m);
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
              {m.kind === 'video' && m.stream === 'hls' ? (
                <StreamVideo id={L.id} src={m.src} style={mediaStyle} />
              ) : m.kind === 'video' ? (
                <video data-id={L.id} src={m.src ?? undefined} muted loop playsInline preload="auto" style={mediaStyle} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.src ?? undefined} alt="" draggable={false} style={mediaStyle} />
              )}
            </div>
          );
        })}
        {showSeams &&
          [1, 2, 3, 4].map((k) => (
            <div key={k} className="pointer-events-none absolute top-0 bg-white/75" style={{ left: k * SLIDE - 1 / scale, width: 2 / scale, height: H }} />
          ))}
        {overlay?.(scale)}
      </div>
    </div>
  );
});

export default CarouselCanvas;
