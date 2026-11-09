'use client';

// The selected layer's settings — same controls as the old artifact's panel.
// `onChange(patch, commit)`: commit=false while a slider moves, true on release.

import { insetOf, type Layer } from '@/lib/carousel/layout';
import type { Action } from '@/lib/carousel/edit';
import type { CanvasMedia } from './CarouselCanvas';

type Patch = Partial<Layer>;

const label = 'text-[11px] font-bold uppercase tracking-[.14em] text-ink-3';
const num = 'w-full rounded-lg border border-hairline-soft bg-surface-raised px-2 py-1.5 text-[14px] text-ink-1';
const btn = 'min-h-[34px] rounded-full border border-hairline-soft bg-surface-card px-3 text-[11px] font-bold uppercase tracking-[.12em] text-ink-2 hover:text-ink-1';

function Slider({ name, k, min, max, step, value, onChange }: {
  name: string; k: keyof Layer; min: number; max: number; step: number; value: number;
  onChange: (p: Patch, commit: boolean) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex justify-between"><span className={label}>{name}</span><span className="text-[12px] text-ink-3">{value.toFixed(2)}</span></span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange({ [k]: +e.target.value } as Patch, false)}
        onPointerUp={(e) => onChange({ [k]: +(e.target as HTMLInputElement).value } as Patch, true)}
        onKeyUp={(e) => onChange({ [k]: +(e.target as HTMLInputElement).value } as Patch, true)}
        className="accent-[var(--accent,#D73F09)]"
      />
    </label>
  );
}

export default function LayerProps({
  layer, media, onChange, onAct, frameMode, setFrameMode,
}: {
  layer: Layer | null;
  media: CanvasMedia | undefined;
  onChange: (p: Patch, commit: boolean) => void;
  onAct: (a: Action) => void;
  frameMode: boolean;
  setFrameMode: (on: boolean) => void;
}) {
  if (!layer || !media) {
    return (
      <p className="text-[14px] leading-relaxed text-ink-3">
        Click a card, background or logo on the canvas — or pick one from Layers. Drag a background to slide its photo
        inside the slide; use Zoom to scale it.
      </p>
    );
  }
  const L = layer;
  const isLogo = media.kind === 'logo';
  const I = insetOf(L);
  const numField = (k: 'x' | 'y' | 'w' | 'h', name: string) => (
    <label className="flex flex-col gap-1">
      <span className={label}>{name}</span>
      <input type="number" className={num} value={Math.round(L[k])}
        onChange={(e) => Number.isFinite(+e.target.value) && onChange({ [k]: +e.target.value }, false)}
        onBlur={(e) => onChange({ [k]: +e.target.value }, true)} />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className={label}>Name</span>
        <input className={num} value={L.name ?? ''} onChange={(e) => onChange({ name: e.target.value }, false)} onBlur={() => onChange({}, true)} />
      </label>
      <p className="text-[12px] text-ink-4">{media.label ?? L.media} · {media.kind === 'image' ? 'still' : media.kind}</p>

      {!isLogo && (
        <div className="flex gap-1.5" role="group" aria-label="Framing">
          <button type="button" aria-pressed={!frameMode} onClick={() => setFrameMode(false)} className={`${btn} ${!frameMode ? '!border-ink-1 !bg-ink-1 !text-ground' : ''}`}>Move box</button>
          <button type="button" aria-pressed={frameMode} onClick={() => setFrameMode(true)} className={`${btn} ${frameMode ? '!border-ink-1 !bg-ink-1 !text-ground' : ''}`}>Reframe</button>
          <button type="button" onClick={() => onChange({ cx: 0.5, cy: 0.5, zoom: 1 }, true)} className={btn}>Reset</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {numField('x', 'X')}{numField('y', 'Y')}{numField('w', 'Width')}{numField('h', 'Height')}
      </div>

      {!isLogo && (
        <>
          <Slider name="Crop focus ↔" k="cx" min={0} max={1} step={0.01} value={L.cx ?? 0.5} onChange={onChange} />
          <Slider name="Crop focus ↕" k="cy" min={0} max={1} step={0.01} value={L.cy ?? 0.5} onChange={onChange} />
          <Slider name="Zoom" k="zoom" min={1} max={4} step={0.01} value={L.zoom ?? 1} onChange={onChange} />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-[14px] text-ink-2">
              <input type="checkbox" checked={!!L.bw} onChange={(e) => onChange({ bw: e.target.checked }, true)} /> Black &amp; white
            </label>
            <label className="flex items-center gap-2 text-[14px] text-ink-2">
              <input type="checkbox" checked={!!L.shadow} onChange={(e) => onChange({ shadow: e.target.checked }, true)} /> Drop shadow
            </label>
          </div>
          <Slider name="Brightness" k="bright" min={0.3} max={1.5} step={0.01} value={L.bright ?? 1} onChange={onChange} />
          <Slider name="Contrast" k="contrast" min={0.5} max={1.8} step={0.01} value={L.contrast ?? 1} onChange={onChange} />
          <Slider name="Saturation" k="sat" min={0} max={2} step={0.01} value={L.sat ?? 1} onChange={onChange} />
          <Slider name="Blur" k="blur" min={0} max={20} step={0.1} value={L.blur ?? 0} onChange={onChange} />

          <div className="flex flex-col gap-1">
            <span className={label}>Cropped edges</span>
            <div className="grid grid-cols-4 gap-1.5">
              {(['l', 't', 'r', 'b'] as const).map((k) => (
                <label key={k} className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-ink-4">{{ l: 'Left', t: 'Top', r: 'Right', b: 'Bottom' }[k]}</span>
                  <input type="number" min={0} className={num} value={Math.round(I[k])}
                    onChange={(e) => onChange({ inset: { ...I, [k]: Math.max(0, +e.target.value || 0) } }, false)}
                    onBlur={() => onChange({}, true)} />
                </label>
              ))}
            </div>
            <p className="text-[12px] text-ink-4">Drag the orange edge tabs to pull an edge in. The photo doesn&apos;t move, so it stays lined up with its cutout.</p>
            {(I.l || I.t || I.r || I.b) ? <div><button type="button" className={btn} onClick={() => onAct('uncrop')}>Uncrop edges</button></div> : null}
          </div>

          <label className="flex flex-col gap-1">
            <span className={label}>Seam split</span>
            <select className={num} value={L.clip ?? ''} onChange={(e) => onChange({ clip: e.target.value as Layer['clip'] }, true)}>
              <option value="">Show everywhere</option>
              <option value="left">Only left of the seam</option>
              <option value="right">Only right of the seam</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn} onClick={() => onAct('fill')}>Fill slide</button>
            <button type="button" className={btn} onClick={() => onAct('fillstrip')}>Fill whole carousel</button>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => onAct('front')}>To front</button>
        <button type="button" className={btn} onClick={() => onAct('fwd')}>Forward</button>
        <button type="button" className={btn} onClick={() => onAct('back')}>Backward</button>
        <button type="button" className={btn} onClick={() => onAct('bottom')}>To back</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => onAct('dup')}>Duplicate</button>
        <button type="button" className={`${btn} hover:!text-status-bad-ink`} onClick={() => onAct('del')}>Delete</button>
      </div>
    </div>
  );
}
