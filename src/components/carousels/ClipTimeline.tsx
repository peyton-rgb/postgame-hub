'use client';

// Pick which part of a long clip plays in the 6-second loop — the artifact's
// timeline: the whole clip on top (drag the box, or click anywhere to jump),
// 24 seconds zoomed in below (drag the box edges to trim to 1–6s).

import { useEffect, useRef, useState } from 'react';
import { DUR } from '@/lib/carousel/layout';
import { fmtT, setSection, zoomRange } from '@/lib/carousel/edit';
import type { ScrubSheet } from '@/lib/carousel/frameio-clips';
import type { Look, Pre } from '@/lib/carousel/grade';
import { useGraded } from './gradeImage';

type Props = {
  dur: number; vin: number; vlen: number; strip?: string | null; thumb?: string | null; scrub?: ScrubSheet | null;
  /** Grade to show the frames through (null = as shot). */
  look?: Look | null;
  /** The clip's exposure / white-balance correction, drawn under the look. */
  pre?: Pre | null;
  onChange: (s: { vin: number; vlen: number }, commit: boolean) => void;
};

// Real frames along a bar, cut from Frame.io's frame grid: one tile per
// ~frame-width of bar, each showing the frame nearest its moment in the clip.
function Frames({ sheet, dur, range, height }: { sheet: ScrubSheet; dur: number; range: [number, number]; height: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el); setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const k = height / sheet.th, tileW = sheet.tw * k;
  const n = Math.max(1, Math.ceil(width / tileW));
  const [r0, r1] = range;
  return (
    <div ref={box} className="pointer-events-none absolute inset-0 flex overflow-hidden">
      {Array.from({ length: n }, (_, i) => {
        const t = r0 + ((i + 0.5) / n) * (r1 - r0);
        const f = Math.min(sheet.frames - 1, Math.max(0, Math.floor((t / dur) * sheet.frames)));
        const col = f % sheet.tx, row = Math.floor(f / sheet.tx);
        return (
          <div key={i} className="h-full shrink-0" style={{
            width: width / n,
            backgroundImage: `url(${sheet.url})`,
            backgroundSize: `${sheet.tx * (sheet.tw + sheet.pad) * k}px ${sheet.ty * (sheet.th + sheet.pad) * k}px`,
            backgroundPosition: `${-col * (sheet.tw + sheet.pad) * k - (tileW - width / n) / 2}px ${-row * (sheet.th + sheet.pad) * k}px`,
          }} />
        );
      })}
    </div>
  );
}

function Bar({ range, dur, vin, vlen, strip: strip0, thumb: thumb0, scrub: scrub0, look = null, pre = null, onChange, trim }: Props & { range: [number, number]; trim: boolean }) {
  const sheetUrl = useGraded(scrub0?.url, look, 2600, pre);
  const strip = useGraded(strip0, look, 4096, pre);
  const thumb = useGraded(thumb0, look, 640, pre);
  const scrub = scrub0 && sheetUrl ? { ...scrub0, url: sheetUrl } : scrub0;
  const ref = useRef<HTMLDivElement>(null);
  const [r0, r1] = range, span = r1 - r0;
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current!, rect = el.getBoundingClientRect();
    const sec = (x: number) => r0 + ((x - rect.left) / rect.width) * span;
    const edge = (e.target as HTMLElement).dataset.e;
    const onWin = !!(e.target as HTMLElement).closest('[data-win]');
    let st = { a: vin, l: vlen, s: sec(e.clientX) };
    if (!edge && !onWin) { const j = setSection(dur, st.s - vlen / 2, vlen); onChange(j, false); st = { a: j.vin, l: j.vlen, s: st.s }; }
    el.setPointerCapture(e.pointerId); e.preventDefault();
    let last = { vin: st.a, vlen: st.l };
    const mv = (ev: PointerEvent) => {
      const d = sec(ev.clientX) - st.s;
      if (edge === 'l') { const out = st.a + st.l; const a = Math.max(out - DUR, Math.min(out - 1, st.a + d)); last = setSection(dur, a, out - a); }
      else if (edge === 'r') last = setSection(dur, st.a, st.l + d);
      else last = setSection(dur, st.a + d, st.l);
      onChange(last, false);
    };
    const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); onChange(last, true); };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
  };
  return (
    <div ref={ref} onPointerDown={down} className="relative h-[72px] cursor-pointer touch-none overflow-hidden rounded-lg bg-surface-raised">
      {scrub ? (
        <Frames sheet={scrub} dur={dur} range={range} height={72} />
      ) : strip ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={strip} alt="" draggable={false} className="pointer-events-none absolute top-0 h-full max-w-none object-cover opacity-80"
          style={{ width: `${(dur / span) * 100}%`, left: `${(-r0 / span) * 100}%` }} />
      ) : thumb ? (
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: `url(${thumb})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x' }} />
      ) : null}
      <div data-win className="absolute top-0 bottom-0 cursor-grab rounded border-2 border-accent bg-accent/15"
        style={{ left: `${((vin - r0) / span) * 100}%`, width: `max(6px, ${(vlen / span) * 100}%)`, boxShadow: '0 0 0 2000px rgba(0,0,0,.45)' }}>
        {trim && <div data-e="l" title="Drag to trim the start" className="absolute -left-2 top-0 bottom-0 w-4 cursor-ew-resize rounded-l bg-accent/80 after:absolute after:left-1/2 after:top-1/2 after:h-6 after:w-[2px] after:-translate-x-1/2 after:-translate-y-1/2 after:bg-white" />}
        {trim && <div data-e="r" title="Drag to trim the end" className="absolute -right-2 top-0 bottom-0 w-4 cursor-ew-resize rounded-r bg-accent/80 after:absolute after:left-1/2 after:top-1/2 after:h-6 after:w-[2px] after:-translate-x-1/2 after:-translate-y-1/2 after:bg-white" />}
      </div>
      <div className="pointer-events-none absolute bottom-0.5 left-1 right-1 flex justify-between text-[10px] font-bold text-ink-1 [text-shadow:0_1px_2px_#000]">
        <span>{fmtT(r0)}</span><span>{fmtT((r0 + r1) / 2)}</span><span>{fmtT(r1)}</span>
      </div>
    </div>
  );
}

export default function ClipTimeline(p: Props) {
  const zr = zoomRange(p.dur, p.vin, p.vlen);
  const num = 'w-20 rounded-lg border border-hairline-soft bg-surface-raised px-2 py-1 text-[14px] text-ink-1';
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] text-ink-4">Whole clip ({fmtT(p.dur)}) — drag the orange box, or click anywhere, to pick the moment</p>
      <Bar {...p} range={[0, p.dur]} trim={false} />
      <p className="mt-1 text-[12px] text-ink-4">Zoomed in — drag the orange handles to trim (1–{DUR}s)</p>
      <Bar {...p} range={zr} trim />
      <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink-3">
        <span className="text-[13px] text-ink-2">Plays {fmtT(p.vin)} → {fmtT(p.vin + p.vlen)} · {p.vlen.toFixed(1)}s{p.vlen < DUR - 0.01 ? ` (loops to fill the ${DUR}s post)` : ''}</span>
        <label className="flex items-center gap-1">In <input type="number" step={0.1} min={0} className={num} value={p.vin.toFixed(1)}
          onChange={(e) => p.onChange(setSection(p.dur, +e.target.value, p.vlen), true)} /></label>
        <label className="flex items-center gap-1">Length <input type="number" step={0.1} min={1} max={DUR} className={num} value={p.vlen.toFixed(1)}
          onChange={(e) => p.onChange(setSection(p.dur, p.vin, +e.target.value), true)} /></label>
      </div>
    </div>
  );
}
