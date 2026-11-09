'use client';

// The content picker: only what Frame.io says this athlete may use —
// everything in their SELECTED CLIPS folder, plus clips marked Approved
// elsewhere in their folder. Data from /api/carousels/[slug]/clips.

import { useCallback, useEffect, useMemo, useState } from 'react';
import HlsVideo from './HlsVideo';

export type PickerClip = {
  id: string;
  name: string;
  kind: 'video' | 'image';
  source: 'selected' | 'approved';
  approved: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  thumb: string | null;
  play: string | null;
  viewUrl: string | null;
  folder: string;
};

type Payload = { selected: PickerClip[]; approvedElsewhere: PickerClip[]; fetchedAt: string };
type Filter = 'all' | 'video' | 'image';

const fmt = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const short = (name: string) => name.replace(/\.[^.]+$/, '');

export default function ClipPicker({
  slug,
  firstName,
  onPick,
}: {
  slug: string;
  firstName: string;
  onPick: (clip: PickerClip) => void;
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
  const elsewhere = useMemo(() => (data?.approvedElsewhere ?? []).filter(usable), [data]);
  const all = [...selected, ...elsewhere];
  const count = (k: Filter) => all.filter((c) => k === 'all' || c.kind === k).length;

  const synced = data ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null;

  const Card = (c: PickerClip) => (
    <li key={c.id}>
      <button
        type="button"
        onClick={() => onPick(c)}
        onMouseEnter={() => setHover(c.id)}
        onMouseLeave={() => setHover(null)}
        onFocus={() => setHover(c.id)}
        onBlur={() => setHover(null)}
        aria-label={`Add ${short(c.name)} to the selected slide`}
        className="group flex w-full flex-col gap-1.5 text-left"
      >
        <span className="relative block aspect-[16/10] overflow-hidden rounded-[10px] bg-surface-raised">
          {hover === c.id && c.kind === 'video' ? (
            <HlsVideo src={c.play} poster={c.thumb} className="h-full w-full object-cover" />
          ) : c.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
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
      className="flex w-full flex-col gap-4 rounded-2xl border border-hairline-soft bg-surface-card p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)]"
    >
      <div>
        <h2 className="font-display text-[30px] leading-[.95]">Add to {firstName}&apos;s carousel</h2>
        <p className="mt-1.5 text-[14px] text-ink-3">Live from Frame.io · {firstName}&apos;s SELECTED CLIPS + Approved</p>
        <p className="mt-0.5 text-[13px] text-ink-4">
          {loading ? 'Syncing…' : synced ? `Synced ${synced}` : ''}{' '}
          {!loading && (
            <button type="button" onClick={load} className="text-accent underline-offset-2 hover:underline">
              Refresh
            </button>
          )}
        </p>
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

      <div className="-mr-2 flex-1 overflow-y-auto pr-2">
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
            <h3 className="mb-2 flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-ink-1">
              Selected clips <span className="font-normal text-ink-4">{selected.filter(pass).length}</span>
            </h3>
            <ul className="grid grid-cols-2 gap-2.5">{selected.filter(pass).map(Card)}</ul>

            <h3 className="mb-2 mt-5 flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-ink-1">
              Approved in other folders <span className="font-normal text-ink-4">{elsewhere.filter(pass).length}</span>
            </h3>
            {elsewhere.filter(pass).length ? (
              <ul className="grid grid-cols-2 gap-2.5">{elsewhere.filter(pass).map(Card)}</ul>
            ) : (
              <p className="rounded-xl border border-dashed border-hairline p-3.5 text-[14px] text-ink-4">
                None right now. Mark a clip Approved anywhere in {firstName}&apos;s Frame.io folder and it shows up here.
              </p>
            )}
          </>
        )}
      </div>
      <p className="text-[13px] leading-relaxed text-ink-4">
        Only clips in SELECTED CLIPS or marked Approved in Frame.io can be added.
      </p>
    </section>
  );
}
