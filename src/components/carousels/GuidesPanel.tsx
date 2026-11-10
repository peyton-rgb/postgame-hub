'use client';

// The guide maker, under the carousel (artifact parity): show/lock, add one
// guide, a grid layout (columns / rows / gutter / margin) for every slide or
// one slide, and the list of guides with editable positions. Vertical guide
// positions count from each slide's left edge (0–1080), like the rulers.

import { useEffect, useState } from 'react';
import { H, SLIDE } from '@/lib/carousel/layout';
import { gridGuides } from '@/lib/carousel/edit';
import type { Layout } from '@/lib/carousel/layout';

type G = { v: number[]; h: number[]; show: boolean; lock: boolean };

export default function GuidesPanel({
  layout, guides, view, onChange, flash,
}: {
  layout: Layout;
  guides: G;
  view: 'all' | number;
  onChange: (patch: Partial<G>) => void;
  flash: (msg: string) => void;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => { try { setOpen(localStorage.getItem('carousel-guides-open') !== '0'); } catch { /* storage off */ } }, []);
  const toggleOpen = () => setOpen((o) => { try { localStorage.setItem('carousel-guides-open', o ? '0' : '1'); } catch { /* storage off */ } return !o; });

  const [cols, setCols] = useState(2), [gut, setGut] = useState(0);
  const [rows, setRows] = useState(0), [rgut, setRgut] = useState(0);
  const [margin, setMargin] = useState(60);
  const [where, setWhere] = useState<'all' | 'one'>('all');
  const [replace, setReplace] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const slide = typeof view === 'number' ? view : 0;

  const locked = () => { if (guides.lock) { flash('Guides are locked — unlock them first'); return true; } return false; };
  const addOne = (axis: 'v' | 'h') => {
    if (locked()) return;
    const pos = axis === 'v' ? slide * SLIDE + SLIDE / 2 : H / 2;
    onChange({ [axis]: [...guides[axis], pos].sort((a, b) => a - b), show: true });
  };
  const make = () => {
    if (locked()) return;
    const g = gridGuides(layout, { cols, gut, rows, rgut, margin, slide: where === 'all' ? 'all' : slide, replace });
    onChange({ ...g, show: true });
    flash(`Guides added — ${g.v.length} vertical, ${g.h.length} horizontal`);
  };
  const move = (axis: 'v' | 'h', i: number, pos: number) => {
    if (locked() || !Number.isFinite(pos)) return;
    const list = guides[axis].slice(); list[i] = pos;
    onChange({ [axis]: list });
  };
  const remove = (axis: 'v' | 'h', i: number) => {
    if (locked()) return;
    onChange({ [axis]: guides[axis].filter((_, j) => j !== i) });
  };

  const seg = (on: boolean) => `min-h-[34px] rounded-full px-3.5 text-[11px] font-bold uppercase tracking-[.12em] ${on ? 'bg-ink-1 text-ground' : 'text-ink-3 hover:text-ink-1'}`;
  const btn = 'min-h-[34px] rounded-full border border-hairline-soft px-3.5 text-[11px] font-bold uppercase tracking-[.12em] text-ink-2 hover:border-ink-3 hover:text-ink-1';
  const num = 'w-[72px] rounded-lg border border-hairline-soft bg-surface-raised px-2 py-1.5 text-[14px] text-ink-1';
  const lab = 'text-[13px] text-ink-3';
  const total = guides.v.length + guides.h.length;
  const chips = [
    ...guides.v.map((x, i) => ({ axis: 'v' as const, i, label: `S${Math.min(5, Math.floor(x / SLIDE) + 1)} │`, val: Math.round(x - Math.min(4, Math.floor(x / SLIDE)) * SLIDE), base: Math.min(4, Math.floor(x / SLIDE)) * SLIDE })),
    ...guides.h.map((y, i) => ({ axis: 'h' as const, i, label: '─', val: Math.round(y), base: 0 })),
  ];
  const shown = showAll ? chips : chips.slice(0, 12);

  return (
    <section aria-label="Guides" className="rounded-2xl border border-hairline-soft bg-surface-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={toggleOpen} aria-expanded={open} className="flex items-baseline gap-2 text-left">
          <span aria-hidden className={`inline-block w-3 text-ink-3 transition-transform ${open ? '' : '-rotate-90'}`}>▾</span>
          <h2 className="text-[15px] font-bold text-ink-1">Guides</h2>
          <span className="text-[13px] text-ink-4">{total ? `${guides.v.length} vertical · ${guides.h.length} horizontal` : 'none yet'}</span>
        </button>
        <div className="ml-auto flex gap-1 rounded-full border border-hairline-soft p-[3px]">
          <button type="button" aria-pressed={guides.show} className={seg(guides.show)} onClick={() => onChange({ show: !guides.show })}>Show</button>
          <button type="button" aria-pressed={guides.lock} className={seg(guides.lock)} onClick={() => onChange({ lock: !guides.lock })}>{guides.lock ? 'Locked' : 'Lock'}</button>
        </div>
      </div>

      {open && (
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-ink-1">Add one guide</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btn} onClick={() => addOne('v')}>+ Vertical</button>
                <button type="button" className={btn} onClick={() => addOne('h')}>+ Horizontal</button>
                {total > 0 && <button type="button" className={btn} onClick={() => { if (!locked()) onChange({ v: [], h: [] }); }}>Clear all</button>}
              </div>
              <p className="mt-2 text-[12px] text-ink-4">Or drag one out of the rulers. Drag a guide off the canvas to delete it.</p>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-ink-1">Grid layout</p>
              <div className="grid grid-cols-[auto_auto_auto_auto] items-center justify-start gap-x-3 gap-y-2">
                <label className={lab} htmlFor="g-cols">Columns</label><input id="g-cols" type="number" min={0} max={12} className={num} value={cols} onChange={(e) => setCols(+e.target.value)} />
                <label className={lab} htmlFor="g-gut">Gutter</label><input id="g-gut" type="number" min={0} max={400} className={num} value={gut} onChange={(e) => setGut(+e.target.value)} />
                <label className={lab} htmlFor="g-rows">Rows</label><input id="g-rows" type="number" min={0} max={12} className={num} value={rows} onChange={(e) => setRows(+e.target.value)} />
                <label className={lab} htmlFor="g-rgut">Gutter</label><input id="g-rgut" type="number" min={0} max={400} className={num} value={rgut} onChange={(e) => setRgut(+e.target.value)} />
                <label className={lab} htmlFor="g-mar">Margin</label><input id="g-mar" type="number" min={0} max={500} className={num} value={margin} onChange={(e) => setMargin(+e.target.value)} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex gap-1 rounded-full border border-hairline-soft p-[3px]">
                  <button type="button" aria-pressed={where === 'all'} className={seg(where === 'all')} onClick={() => setWhere('all')}>Every slide</button>
                  <button type="button" aria-pressed={where === 'one'} className={seg(where === 'one')} onClick={() => setWhere('one')}>Slide {slide + 1} only</button>
                </div>
                <label className="flex items-center gap-2 text-[13px] text-ink-2">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="h-4 w-4 accent-[#FAF8F5]" />
                  Replace the guides that are there now
                </label>
              </div>
              <button type="button" onClick={make} className="mt-3 min-h-[38px] rounded-full bg-accent px-4 text-[11px] font-bold uppercase tracking-[.12em] text-white hover:brightness-110">Add guides</button>
              {where === 'one' && view === 'all' && <p className="mt-2 text-[12px] text-ink-4">Pick a slide (1–5) in the toolbar to choose which one.</p>}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-ink-1">
              Guides on the canvas <span className="font-normal normal-case tracking-normal text-ink-4">· positions count from each slide&apos;s left edge</span>
            </p>
            {chips.length ? (
              <div className="flex flex-wrap gap-1.5">
                {shown.map((c) => (
                  <span key={`${c.axis}${c.i}`} className="flex items-center gap-1.5 rounded-lg border border-hairline-soft py-1 pl-2 pr-1 text-[12px] text-ink-3">
                    {c.label}
                    <input type="number" aria-label={`${c.axis === 'v' ? 'Vertical' : 'Horizontal'} guide position`} disabled={guides.lock}
                      className="w-[64px] rounded-md border border-hairline-soft bg-surface-raised px-1.5 py-0.5 text-[13px] text-ink-1 disabled:opacity-50"
                      value={c.val} onChange={(e) => move(c.axis, c.i, c.base + +e.target.value)} />
                    <button type="button" aria-label="Delete this guide" disabled={guides.lock} onClick={() => remove(c.axis, c.i)}
                      className="grid h-6 w-6 place-items-center rounded text-ink-4 hover:text-ink-1 disabled:opacity-40">×</button>
                  </span>
                ))}
                {chips.length > 12 && (
                  <button type="button" onClick={() => setShowAll((s) => !s)} className="rounded-lg border border-hairline-soft px-2.5 py-1 text-[12px] text-ink-3 hover:text-ink-1">
                    {showAll ? 'Show fewer' : `… ${chips.length - 12} more`}
                  </button>
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-hairline p-3.5 text-[14px] text-ink-4">No guides yet — add one, or make a grid layout.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
