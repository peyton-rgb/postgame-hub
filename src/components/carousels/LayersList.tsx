'use client';

// Layers, front-most first (like the artifact). Click to select; eye hides,
// lock stops a layer being dragged; ↑ ↓ move it in front of / behind others;
// drag the ⠿ grip to drop a layer anywhere in the stack.

import { useRef, useState } from 'react';
import type { Layer } from '@/lib/carousel/layout';
import type { CanvasMedia } from './CarouselCanvas';

const KIND: Record<string, string> = { video: 'Video', image: 'Still', cutout: 'Cutout', logo: 'Logo', text: 'Text' };

export default function LayersList({
  layers, media, selectedId, selectedIds = [], onSelect, onToggle, onMove, onReorder,
}: {
  layers: Layer[];
  media: Record<string, CanvasMedia>;
  selectedId: string | null;
  selectedIds?: string[];
  onSelect: (id: string, add: boolean) => void;
  onToggle: (id: string, key: 'hidden' | 'locked') => void;
  onMove: (id: string, dir: 'fwd' | 'back') => void;
  onReorder: (id: string, displayIndex: number) => void;
}) {
  const shown = layers.slice().reverse();
  const list = useRef<HTMLUListElement>(null);
  // drag: which layer, and the gap it would drop into (0 = above the first row).
  const [drag, setDrag] = useState<{ id: string; from: number; gap: number } | null>(null);

  const gapAt = (clientY: number) => {
    const rows = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-row]') ?? []);
    const i = rows.findIndex((r) => { const b = r.getBoundingClientRect(); return clientY < b.top + b.height / 2; });
    return i < 0 ? rows.length : i;
  };
  const startDrag = (e: React.PointerEvent, id: string, from: number) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ id, from, gap: from });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const gap = gapAt(e.clientY);
    if (gap !== drag.gap) setDrag({ ...drag, gap });
  };
  const endDrag = () => {
    if (!drag) return;
    // Dropping into the gap just above or below itself is no move at all.
    const to = drag.gap > drag.from ? drag.gap - 1 : drag.gap;
    if (to !== drag.from) onReorder(drag.id, to);
    setDrag(null);
  };
  const showLine = (gap: number) => !!drag && gap !== drag.from && gap !== drag.from + 1 && drag.gap === gap;
  const icon = 'grid h-8 w-8 shrink-0 place-items-center rounded-md text-[14px] text-ink-3 hover:bg-surface-raised hover:text-ink-1';
  return (
    <ul ref={list} className="flex flex-col gap-1">
      {shown.map((L, i) => (
        <li key={L.id} data-row
          className={`relative flex items-center gap-1 rounded-lg border px-1.5 py-1 ${L.id === selectedId || selectedIds.includes(L.id) ? 'border-accent bg-surface-raised' : 'border-transparent hover:bg-surface-raised'} ${drag?.id === L.id ? 'opacity-40' : ''}`}>
          {showLine(i) && <span aria-hidden className="pointer-events-none absolute -top-[3px] left-1 right-1 h-[2px] rounded-full bg-accent" />}
          {i === shown.length - 1 && showLine(i + 1) && <span aria-hidden className="pointer-events-none absolute -bottom-[3px] left-1 right-1 h-[2px] rounded-full bg-accent" />}
          <span role="button" tabIndex={-1} aria-label={`Drag to reorder ${L.name ?? L.id}`} title="Drag to reorder"
            className="grid h-8 w-5 shrink-0 cursor-grab touch-none place-items-center text-[14px] text-ink-4 hover:text-ink-1 active:cursor-grabbing"
            onPointerDown={(e) => startDrag(e, L.id, i)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>⠿</span>
          <button type="button" aria-label={L.hidden ? `Show ${L.name}` : `Hide ${L.name}`} title={L.hidden ? 'Show' : 'Hide'}
            className={icon} onClick={() => onToggle(L.id, 'hidden')}>{L.hidden ? '◌' : '◉'}</button>
          {(() => {
            const m = media[L.media];
            const pic = L.type === 'text' ? null : m?.thumb ?? (m && m.kind !== 'video' ? m.src : null);
            return (
              <span aria-hidden className="grid h-10 w-8 shrink-0 place-items-center overflow-hidden rounded bg-surface-raised text-[12px] font-bold text-ink-3"
                style={pic ? { backgroundImage: `url(${pic})`, backgroundSize: m?.kind === 'logo' || m?.kind === 'cutout' ? 'contain' : 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}>
                {L.type === 'text' ? 'T' : null}
              </span>
            );
          })()}
          <button type="button" onClick={(e) => onSelect(L.id, e.shiftKey || e.metaKey || e.ctrlKey)} className="min-w-0 flex-1 text-left">
            <span className={`block truncate text-[13px] ${L.hidden ? 'text-ink-4 line-through' : 'text-ink-1'}`}>{L.name ?? L.id}</span>
            <span className="block text-[11px] uppercase tracking-[.12em] text-ink-4">{KIND[L.type === 'text' ? 'text' : media[L.media]?.kind ?? ''] ?? 'Layer'}</span>
          </button>
          <button type="button" aria-label="Bring forward" title="Forward" disabled={i === 0} className={`${icon} disabled:opacity-30`} onClick={() => onMove(L.id, 'fwd')}>↑</button>
          <button type="button" aria-label="Send backward" title="Backward" disabled={i === shown.length - 1} className={`${icon} disabled:opacity-30`} onClick={() => onMove(L.id, 'back')}>↓</button>
          <button type="button" aria-label={L.locked ? `Unlock ${L.name}` : `Lock ${L.name}`} title={L.locked ? 'Unlock' : 'Lock'}
            className={`${icon} ${L.locked ? '!text-accent' : ''}`} onClick={() => onToggle(L.id, 'locked')}>{L.locked ? '🔒' : '🔓'}</button>
        </li>
      ))}
    </ul>
  );
}
