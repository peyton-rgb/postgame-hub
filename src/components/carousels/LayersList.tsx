'use client';

// Layers, front-most first (like the artifact). Click to select; eye hides,
// lock stops a layer being dragged; ↑ ↓ move it in front of / behind others.

import type { Layer } from '@/lib/carousel/layout';
import type { CanvasMedia } from './CarouselCanvas';

const KIND: Record<string, string> = { video: 'Video', image: 'Still', cutout: 'Cutout', logo: 'Logo' };

export default function LayersList({
  layers, media, selectedId, onSelect, onToggle, onMove,
}: {
  layers: Layer[];
  media: Record<string, CanvasMedia>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, key: 'hidden' | 'locked') => void;
  onMove: (id: string, dir: 'fwd' | 'back') => void;
}) {
  const shown = layers.slice().reverse();
  const icon = 'grid h-8 w-8 shrink-0 place-items-center rounded-md text-[14px] text-ink-3 hover:bg-surface-raised hover:text-ink-1';
  return (
    <ul className="flex flex-col gap-1">
      {shown.map((L, i) => (
        <li key={L.id}
          className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 ${L.id === selectedId ? 'border-accent bg-surface-raised' : 'border-transparent hover:bg-surface-raised'}`}>
          <button type="button" aria-label={L.hidden ? `Show ${L.name}` : `Hide ${L.name}`} title={L.hidden ? 'Show' : 'Hide'}
            className={icon} onClick={() => onToggle(L.id, 'hidden')}>{L.hidden ? '◌' : '◉'}</button>
          <button type="button" onClick={() => onSelect(L.id)} className="min-w-0 flex-1 text-left">
            <span className={`block truncate text-[13px] ${L.hidden ? 'text-ink-4 line-through' : 'text-ink-1'}`}>{L.name ?? L.id}</span>
            <span className="block text-[11px] uppercase tracking-[.12em] text-ink-4">{KIND[media[L.media]?.kind ?? ''] ?? 'Layer'}</span>
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
