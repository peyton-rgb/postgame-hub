'use client';

// The content picker: every clip and photo in the athlete's Frame.io folder,
// one section per folder (Selected clips, Main folder, Camera originals,
// Photos…). Data from /api/carousels/[slug]/clips.
//
// It lives in the editor's side panel, so it is built to stay cheap while the
// editor re-renders around it (the playback clock ticks 4x a second):
//  - the folder listing is fetched once per athlete per visit (Refresh re-reads it);
//  - each tile is memoised and keeps its own hover state;
//  - a tile only loads / grades its picture once it scrolls near the panel.

import { autoLook, needsScene, refineLook, type Look } from '@/lib/carousel/grade';
import { useGraded, useScenes } from './gradeImage';
import type { ScrubSheet } from '@/lib/carousel/frameio-clips';
import GradeCanvas from './GradeCanvas';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import HlsVideo from './HlsVideo';

export type PickerClip = {
  id: string;
  name: string;
  kind: 'video' | 'image';
  source: 'selected' | 'folder' | 'photos';
  approved: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  thumb: string | null;
  play: string | null;
  scrub?: ScrubSheet | null;
  viewUrl: string | null;
  folder: string;
};

// A tile's picture, shown through the clip's grade once it's ready.
function GradedThumb({ url, look }: { url: string; look: Look | null }) {
  const src = useGraded(url, look, 400);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src ?? url} alt="" loading="lazy" crossOrigin={look ? 'anonymous' : undefined} className="h-full w-full object-cover" />;
}

// The hover-play preview, drawn through the same grade as the canvas.
function HoverPreview({ c, look }: { c: PickerClip; look: Look | null }) {
  const [failed, setFailed] = useState(false);
  const cover: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
  return (
    <span className="absolute inset-0">
      <HlsVideo src={c.play} poster={c.thumb} cors={!!look || !!autoLook(c.name)} className="h-full w-full object-cover" />
      {look && !failed && <GradeCanvas look={look} style={cover} onFail={() => setFailed(true)} />}
    </span>
  );
}

// Hover scrub: slide the mouse across a tile to run through the clip. The frames come from
// Frame.io's scrub sheet (one picture holding ~100 small frames of the clip), drawn through the
// clip's grade; a red line and the time mark where you are.
function ScrubPreview({ sheet, look, at, w, h, dur }: { sheet: ScrubSheet; look: Look | null; at: number; w: number; h: number; dur: number | null }) {
  const url = useGraded(sheet.url, look, 2600) ?? sheet.url;
  const f = Math.min(sheet.frames - 1, Math.max(0, Math.floor(at * sheet.frames)));
  const col = f % sheet.tx, row = Math.floor(f / sheet.tx);
  const k = Math.max(w / sheet.tw, h / sheet.th);                       // cover the tile, like the thumbnail does
  const stepX = (sheet.tw + sheet.pad) * k, stepY = (sheet.th + sheet.pad) * k;
  return (
    <span className="pointer-events-none absolute inset-0">
      <span className="absolute inset-0" style={{
        backgroundImage: `url(${url})`, backgroundRepeat: 'no-repeat',
        backgroundSize: `${sheet.tx * stepX}px ${sheet.ty * stepY}px`,
        backgroundPosition: `${-col * stepX - (sheet.tw * k - w) / 2}px ${-row * stepY - (sheet.th * k - h) / 2}px`,
      }} />
      <span className="absolute inset-y-0 w-[2px] bg-accent shadow-[0_0_0_1px_rgba(7,7,10,.45)]" style={{ left: `calc(${at * 100}% - 1px)` }} />
      <span className="absolute inset-x-0 bottom-0 h-[3px] bg-ground/60"><span className="block h-full bg-accent" style={{ width: `${at * 100}%` }} /></span>
      {dur != null && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-ground/75 px-2 py-0.5 text-[10px] font-bold tracking-[.08em] text-ink-1">{fmt(at * dur)}</span>
      )}
    </span>
  );
}

type Payload = { selected: PickerClip[]; elsewhere: PickerClip[]; photos?: PickerClip[]; fetchedAt: string };
type Filter = 'all' | 'video' | 'image';

const fmt = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const short = (name: string) => name.replace(/\.[^.]+$/, '');

// The folder listing per athlete, kept for the visit so reopening the panel is instant.
const listCache = new Map<string, Payload>();

type TileProps = {
  c: PickerClip;
  tall: boolean;
  /** The panel's scroller: tiles wake up when they come within reach of it. */
  root: RefObject<HTMLDivElement>;
  disabled: boolean;
  busy: boolean;
  swapping: boolean;
  onPick: (clip: PickerClip) => void;
};

// One clip or photo. Memoised: with stable props it sits out the editor's re-renders.
const Tile = memo(function Tile({ c, tall, root, disabled, busy, swapping, onPick }: TileProps) {
  const ref = useRef<HTMLLIElement>(null);
  const [seen, setSeen] = useState(false);
  const [hover, setHover] = useState(false);
  // Where the mouse is across the thumbnail (0–1) and the thumbnail's size, for the hover scrub.
  const [scrubAt, setScrubAt] = useState<{ at: number; w: number; h: number } | null>(null);

  // Nothing is fetched or graded for a tile until it is near the visible part of the panel.
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } },
      { root: root.current, rootMargin: '500px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, root]);

  // The tile's grade; Canon clips wait for the green-screen check (only once seen).
  const base = c.kind === 'video' ? autoLook(c.name) : null;
  const scenes = useScenes(seen && needsScene(base) ? [c.thumb] : []);
  const look: Look | null = seen && c.kind === 'video' ? refineLook(base, true, c.thumb ? scenes[c.thumb] : false) : null;

  return (
    <li ref={ref}>
      <button
        type="button"
        onClick={() => onPick(c)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setScrubAt(null); }}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={swapping ? `Swap in ${short(c.name)}` : `Add ${short(c.name)} to the selected slide`}
        disabled={disabled}
        className={`group flex w-full flex-col gap-1 text-left disabled:cursor-wait ${busy ? 'opacity-50' : ''}`}
      >
        <span
          className={`relative block overflow-hidden rounded-[10px] bg-surface-raised ${tall ? 'aspect-[4/5]' : 'aspect-[16/10]'}`}
          onMouseMove={c.kind === 'video' && c.scrub ? (e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setScrubAt({ at: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), w: r.width, h: r.height });
          } : undefined}
        >
          {!seen ? null : hover && c.kind === 'video' && !c.scrub ? (
            <HoverPreview c={c} look={look} />
          ) : c.thumb ? (
            <GradedThumb url={c.thumb} look={look} />
          ) : null}
          {seen && hover && c.kind === 'video' && c.scrub && scrubAt && (
            <ScrubPreview sheet={c.scrub} look={look} at={scrubAt.at} w={scrubAt.w} h={scrubAt.h} dur={c.duration} />
          )}
          {c.duration != null && (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-ground/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.14em] text-ink-1">
              ▶ {fmt(c.duration)}
            </span>
          )}
          {c.approved && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ground/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.14em] text-status-ok">
              ✓ Approved
            </span>
          )}
        </span>
        <span className="truncate text-[12px] leading-snug text-ink-1 group-hover:text-accent">{short(c.name)}</span>
      </button>
    </li>
  );
});

export default function ClipPicker({
  slug,
  firstName,
  onPick,
  onClose,
  replacing,
  busyId,
}: {
  slug: string;
  firstName: string;
  onPick: (clip: PickerClip) => void;
  onClose?: () => void;
  /** Set when the drawer is picking a replacement for an existing layer. */
  replacing?: string | null;
  busyId?: string | null;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const scroller = useRef<HTMLDivElement>(null);

  // The editor hands us a new onPick every render; tiles get one that never changes.
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const pick = useCallback((c: PickerClip) => pickRef.current(c), []);

  // `fresh` re-reads Frame.io (the Refresh link); otherwise a listing already
  // fetched for this athlete during the visit is shown straight away.
  const load = useCallback(async (fresh = false) => {
    const cached = fresh ? undefined : listCache.get(slug);
    if (cached) { setData(cached); setError(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/carousels/${slug}/clips`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      listCache.set(slug, body);
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load clips');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // Files Frame.io can't stream (no play link, e.g. a .webm) are never offered.
  const usable = (c: PickerClip) => (c.kind === 'video' ? Boolean(c.play) : Boolean(c.thumb));
  const pass = (c: PickerClip) => filter === 'all' || c.kind === filter;
  const selected = useMemo(() => (data?.selected ?? []).filter(usable), [data]);
  const elsewhere = useMemo(() => (data?.elsewhere ?? []).filter(usable), [data]);
  const photos = useMemo(() => (data?.photos ?? []).filter(usable), [data]);
  const all = [...selected, ...elsewhere, ...photos];
  const count = (k: Filter) => all.filter((c) => k === 'all' || c.kind === k).length;

  // One section per folder: SELECTED CLIPS, then the main folder, then each
  // sub-folder (CAMERA ORIGINALS first), then PHOTOS. Click a heading to fold it.
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setClosed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  type Section = { key: string; title: string; clips: PickerClip[]; tall?: boolean; always?: boolean; empty?: string };
  const sections = useMemo<Section[]>(() => {
    const byFolder = new Map<string, PickerClip[]>();
    for (const c of elsewhere) byFolder.set(c.folder, [...(byFolder.get(c.folder) ?? []), c]);
    const rank = (f: string) => (f === 'main folder' ? 0 : /^camera originals/i.test(f) ? 1 : 2);
    const folders = Array.from(byFolder.keys()).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return [
      { key: 'selected', title: 'Selected clips', clips: selected, always: true, empty: `Nothing in ${firstName}'s SELECTED CLIPS folder yet.` },
      ...folders.map((f) => ({ key: `f:${f}`, title: f === 'main folder' ? 'Main folder' : f, clips: byFolder.get(f) ?? [] })),
      ...(filter === 'video' ? [] : [{ key: 'photos', title: 'Photos', clips: photos, tall: true, always: true,
        empty: `No photos yet. Put images in a PHOTOS folder inside ${firstName}'s Frame.io folder and they show up here.` }]),
    ];
  }, [selected, elsewhere, photos, filter, firstName]);

  const synced = data ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <section
      aria-label="Content picker"
      className="flex min-h-0 w-full flex-1 flex-col gap-3 rounded-2xl border border-hairline-soft bg-surface-card p-4"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-bold text-ink-1">{replacing ? <>Replace <span className="text-accent">{replacing}</span></> : 'Add from Frame.io'}</h2>
          <p className="text-[12px] text-ink-4">
            {firstName}&apos;s Frame.io folder · {loading ? 'syncing…' : synced ? `synced ${synced}` : ''}{' '}
            {!loading && <button type="button" onClick={() => load(true)} className="text-accent underline-offset-2 hover:underline">Refresh</button>}
          </p>
        </div>
        {onClose && <button type="button" onClick={onClose} className="min-h-[32px] shrink-0 rounded-full border border-hairline-soft px-3 text-[11px] font-bold uppercase tracking-[.12em] text-ink-2 hover:text-ink-1">Close</button>}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
        {(['all', 'video', 'image'] as Filter[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`min-h-[34px] rounded-full border px-3 text-[11px] font-bold uppercase tracking-[.12em] ${
              filter === k ? 'border-ink-1 bg-ink-1 text-ground' : 'border-hairline-soft bg-surface-card text-ink-3'
            }`}
          >
            {k === 'all' ? 'All' : k === 'video' ? 'Video' : 'Photos'} {data ? count(k) : ''}
          </button>
        ))}
      </div>

      <div ref={scroller} className="-mr-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
        {error && (
          <p className="rounded-xl border border-status-bad/40 bg-status-bad/10 p-3 text-[14px] text-status-bad-ink">{error}</p>
        )}
        {loading && !data && (
          <ul className="grid grid-cols-2 gap-2.5" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="aspect-[16/10] animate-pulse rounded-[10px] bg-surface-raised" />
            ))}
          </ul>
        )}
        {data && (
          <>
            {sections.map((sec) => {
              const items = sec.clips.filter(pass);
              if (!items.length && !sec.always) return null;
              const shut = closed.has(sec.key);
              return (
                <div key={sec.key} className="mb-4">
                  <button type="button" onClick={() => toggle(sec.key)} aria-expanded={!shut}
                    className="mb-2 flex w-full items-baseline gap-2 text-left text-[11px] font-bold uppercase tracking-[.16em] text-ink-1 hover:text-accent">
                    <span aria-hidden className={`inline-block w-3 text-ink-3 transition-transform ${shut ? '-rotate-90' : ''}`}>▾</span>
                    {sec.title} <span className="font-normal text-ink-4">{items.length}</span>
                  </button>
                  {shut ? null : items.length ? (
                    <ul className={sec.tall ? 'grid grid-cols-3 gap-2.5' : 'grid grid-cols-2 gap-2.5'}>
                      {items.map((c) => (
                        <Tile key={c.id} c={c} tall={!!sec.tall} root={scroller} disabled={!!busyId} busy={busyId === c.id} swapping={!!replacing} onPick={pick} />
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-xl border border-dashed border-hairline p-3.5 text-[14px] text-ink-4">{sec.empty}</p>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      <p className="text-[12px] text-ink-4">{replacing ? 'Click a clip or photo to put it into that layer’s frame.' : 'Click a clip to drop it on the slide you’re viewing.'} Click a folder heading to fold it away.</p>
    </section>
  );
}
