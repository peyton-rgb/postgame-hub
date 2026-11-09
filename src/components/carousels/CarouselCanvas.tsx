'use client';

// Draws a saved carousel exactly the way the old artifact did: a 5400×1350
// strip (five 1080×1350 slides) scaled down to fit, every layer positioned by
// the shared rules in lib/carousel/layout, and every clip locked to one
// 6-second clock so the carousel loops as a whole.

import { useEffect, useMemo, useRef, useState } from 'react';
import { DUR, H, SLIDE, W, clipTime, placeLayer, type Layer, type Layout, type MediaInfo } from '@/lib/carousel/layout';

export type CanvasMedia = MediaInfo & { src: string | null; thumb: string | null; hasFull?: boolean };

export default function CarouselCanvas({
  layout,
  media,
  playing,
  showSeams = true,
}: {
  layout: Layout;
  media: Record<string, CanvasMedia>;
  playing: boolean;
  showSeams?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.15);
  const clock = useRef({ t0: performance.now(), pausedAt: 0 });

  // Fit the 5400px strip to whatever width the page gives us.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const now = () => (playing ? (performance.now() - clock.current.t0) / 1000 : clock.current.pausedAt);

  // Keep every clip on the shared clock (same 0.12s tolerance as the artifact).
  useEffect(() => {
    const c = clock.current;
    if (playing) c.t0 = performance.now() - c.pausedAt * 1000;
    else c.pausedAt = (performance.now() - c.t0) / 1000;
    const sync = (force = false) => {
      const t = now() % DUR;
      stage.current?.querySelectorAll('video').forEach((v) => {
        const L = layout.layers.find((l) => l.id === v.dataset.id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, layout, media]);

  const layers = useMemo(() => layout.layers.filter((l): l is Layer => l.type !== 'text'), [layout]);

  return (
    <div ref={wrap} className="relative w-full overflow-hidden bg-[#0b0b0c]" style={{ height: H * scale }}>
      <div
        ref={stage}
        className="absolute left-0 top-0 bg-black"
        style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}
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
              title={L.name}
              style={{
                position: 'absolute', overflow: 'hidden', display: L.hidden ? 'none' : undefined,
                ...p.frame, boxShadow: p.shadowBox ? '0 18px 60px rgba(0,0,0,.55)' : undefined,
              }}
            >
              {m.kind === 'video' ? (
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
            <div key={k} className="pointer-events-none absolute top-0 bg-white/75" style={{ left: k * SLIDE - 2, width: 4, height: H }} />
          ))}
      </div>
    </div>
  );
}
