'use client';

// The content picker: every clip and photo in the athlete's Frame.io folder,
// one section per folder (Selected clips, Main folder, Camera originals,
// Photos…). Data from /api/carousels/[slug]/clips.

import { autoLook, type Look } from '@/lib/carousel/grade';
import { useGraded } from './gradeImage';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  scrub?: unknown;
  viewUrl: string | null;
  folder: string;
};

// A tile's picture, shown through the clip's Andres grade once it's ready.
function GradedThumb({ url, look }: { url: string; look: Look | null }) {
  const src = useGraded(url, look, 640);
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src ?? url} alt="" loading="lazy" className="h-full w-full object-cover" />;
}

type Payload = { selected: PickerClip[]; elsewhere: PickerClip[]; photos?: PickerClip[]; fetchedAt: string };
type Filter = 'all' | 'video' | 'image';

const fmt = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const short = (name: string) => name.replace(/\.[^.]+$/, '');

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
  const [hover, setHover] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/carousels/${slug}/clips`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
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

  const Card = (c: PickerClip, tall = false) => (
    <li key={c.id}>
      <button
        type="button"
        onClick={() => onPick(c)}
        onMouseEnter={() => setHover(c.id)}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover(c.id)}
        onBlur={() => setHover(null)}
        aria-label={replacing ? `Swap in ${short(c.name)}` : `Add ${short(c.name)} to the selected slide`}
        disabled={!!busyId}
        className={`group flex w-full flex-col gap-1.5 text-left disabled:cursor-wait ${busyId === c.id ? 'opacity-50' : ''}`}
      >
        <span className={`relative block overflow-hidden rounded-[10px] bg-surface-raised ${tall ? 'aspect-[4/5]' : 'aspect-[16/10]'}`}>
          {hover === c.id && c.kind === 'video' ? (
            <HlsVideo src={c.play} poster={c.thumb} className="h-full w-full object-cover" />
          ) : c.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <GradedThumb url={c.thumb} look={c.kind === 'video' ? autoLook(c.name) : null} />
          ) : null}
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
        <span className="truncate text-[13px] leading-snug text-ink-1 group-hover:text-accent">{short(c.name)}</span>
        <span className="truncate text-[12px] text-ink-4">{c.folder}</span>
      </button>
    </li>
  );

  return (
    <section
      aria-label="Content picker"
      className="flex w-full flex-col gap-3 rounded-2xl border border-hairline-soft bg-surface-card p-4"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-[16px] font-bold text-ink-1">{replacing ? <>Replace <span className="text-accent">{replacing}</span></> : 'Add from Frame.io'}</h2>
        <p className="text-[13px] text-ink-4">
          Everything in {firstName}&apos;s Frame.io folder · {loading ? 'syncing…' : synced ? `synced ${synced}` : ''}{' '}
          {!loading && <button type="button" onClick={load} className="text-accent underline-offset-2 hover:underline">Refresh</button>}
        </p>
        {onClose && <button type="button" onClick={onClose} className="ml-auto min-h-[32px] rounded-full border border-hairline-soft px-3 text-[11px] font-bold uppercase tracking-[.12em] text-ink-2 hover:text-ink-1">Close</button>}
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

      <div className="-mr-2 max-h-[460px] overflow-y-auto pr-2">
        {error && (
          <p className="rounded-xl border border-status-bad/40 bg-status-bad/10 p-3 text-[14px] text-status-bad-ink">{error}</p>
        )}
        {loading && !data && (
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6" aria-hidden>
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
                    <ul className={sec.tall ? 'grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-8' : 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6'}>
                      {items.map((c) => Card(c, sec.tall))}
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
