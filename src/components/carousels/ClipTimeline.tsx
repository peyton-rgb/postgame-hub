'use client';

// Pick which part of a long clip plays in the 6-second loop — the artifact's
// timeline: the whole clip on top (drag the box, or click anywhere to jump),
// 24 seconds zoomed in below (drag the box edges to trim to 1–6s).

import { useRef } from 'react';
import { DUR } from '@/lib/carousel/layout';
import { fmtT, setSection, zoomRange } from '@/lib/carousel/edit';

type Props = {
  dur: number; vin: number; vlen: number; strip?: string | null; thumb?: string | null;
  onChange: (s: { vin: number; vlen: number }, commit: boolean) => void;
};

function Bar({ range, dur, vin, vlen, strip, thumb, onChange, trim }: Props & { range: [number, number]; trim: boolean }) {
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
    <div ref={ref} onPointerDown={down} className="relative h-14 cursor-pointer touch-none overflow-hidden rounded-lg bg-surface-raised">
      {strip ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={strip} alt="" draggable={false} className="pointer-events-none absolute top-0 h-full max-w-none object-cover opacity-80"
          style={{ width: `${(dur / span) * 100}%`, left: `${(-r0 / span) * 100}%` }} />
      ) : thumb ? (
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: `url(${thumb})`, backgroundSize: 'auto 100%', backgroundRepeat: 'repeat-x' }} />
      ) : null}
      <div data-win className="absolute top-0 bottom-0 cursor-grab rounded border-2 border-accent bg-accent/15"
        style={{ left: `${((vin - r0) / span) * 100}%`, width: `max(6px, ${(vlen / span) * 100}%)`, boxShadow: '0 0 0 2000px rgba(0,0,0,.45)' }}>
        {trim && <div data-e="l" className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-ew-resize" />}
        {trim && <div data-e="r" className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-ew-resize" />}
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
      <p className="text-[13px] text-ink-2">
        Plays {fmtT(p.vin)} → {fmtT(p.vin + p.vlen)} · {p.vlen.toFixed(1)}s{p.vlen < DUR - 0.01 ? ` (loops to fill the ${DUR}s post)` : ''}
      </p>
      <p className="text-[12px] text-ink-4">Whole clip — drag the box (or click anywhere) to pick the moment</p>
      <Bar {...p} range={[0, p.dur]} trim={false} />
      <p className="text-[12px] text-ink-4">Zoomed in — drag the box edges to trim (1–{DUR}s)</p>
      <Bar {...p} range={zr} trim />
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
        <label className="flex items-center gap-1">In <input type="number" step={0.1} min={0} className={num} value={p.vin.toFixed(1)}
          onChange={(e) => p.onChange(setSection(p.dur, +e.target.value, p.vlen), true)} /></label>
        <label className="flex items-center gap-1">Length <input type="number" step={0.1} min={1} max={DUR} className={num} value={p.vlen.toFixed(1)}
          onChange={(e) => p.onChange(setSection(p.dur, p.vin, +e.target.value), true)} /></label>
      </div>
    </div>
  );
}
