'use client';

// The athlete name at the top of the carousel editor, as a dropdown: click it,
// type to filter, pick an athlete to open their carousel. `onGo` lets the
// editor finish any pending save before it switches.

import { useEffect, useMemo, useRef, useState } from 'react';

export type AthleteOption = { slug: string; name: string };

export default function AthleteSwitcher({
  current,
  athletes,
  onGo,
}: {
  current: AthleteOption;
  athletes: AthleteOption[];
  onGo: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0); // highlighted row for arrow keys
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? athletes.filter((a) => a.name.toLowerCase().includes(s)) : athletes;
  }, [q, athletes]);

  // Opening: clear the search, highlight the current athlete, focus the box.
  useEffect(() => {
    if (!open) return;
    setQ('');
    setHi(Math.max(0, athletes.findIndex((a) => a.slug === current.slug)));
    requestAnimationFrame(() => input.current?.focus());
  }, [open, athletes, current.slug]);

  // Close on a click anywhere else.
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [open]);

  // Keep the highlighted row in view.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  const pick = (slug: string) => {
    setOpen(false);
    if (slug !== current.slug) onGo(slug);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(matches.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && matches[hi]) { e.preventDefault(); pick(matches[hi].slug); }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${current.name} — switch athlete`}
        className="flex items-center gap-2 rounded-xl px-2 py-1 text-left hover:bg-surface-raised"
      >
        <h1 className="text-[28px] font-bold leading-tight text-ink-1 sm:text-[30px]">{current.name}</h1>
        <span aria-hidden className={`text-[14px] text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-hairline-soft bg-surface-card p-2 shadow-2xl">
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setHi(0); }}
            onKeyDown={onKey}
            placeholder={`Search ${athletes.length} athletes`}
            aria-label="Search athletes"
            className="mb-2 min-h-[40px] w-full rounded-xl border border-hairline-soft bg-ground px-3 text-[14px] text-ink-1 placeholder:text-ink-4 focus:border-ink-3 focus:outline-none"
          />
          <ul ref={list} role="listbox" aria-label="Athletes" className="max-h-[60vh] overflow-y-auto">
            {matches.map((a, i) => {
              const isCur = a.slug === current.slug;
              return (
                <li key={a.slug} data-i={i} role="option" aria-selected={isCur}>
                  <button
                    type="button"
                    onClick={() => pick(a.slug)}
                    onMouseEnter={() => setHi(i)}
                    className={`flex min-h-[40px] w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-[14px] ${
                      i === hi ? 'bg-surface-raised text-ink-1' : 'text-ink-2'
                    } ${isCur ? 'font-bold' : ''}`}
                  >
                    <span className="truncate">{a.name}</span>
                    {isCur && <span className="text-[12px] text-ink-3">✓ editing</span>}
                  </button>
                </li>
              );
            })}
            {!matches.length && <li className="px-3 py-2.5 text-[14px] text-ink-4">No athlete matches “{q}”</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
