'use client';

// The carousel editor page body. Step 2 scope: draw the athlete's saved
// carousel (carried over from the old artifact) exactly as it was, playing.
// Editing tools, the phone preview and saving arrive in the next steps; the
// Frame.io picker is shown for browsing but doesn't add to the canvas yet.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import ClipPicker from './ClipPicker';
import CarouselCanvas, { type CanvasMedia } from './CarouselCanvas';
import type { Layout } from '@/lib/carousel/layout';

type Athlete = { slug: string; name: string; campaign: string | null };
type Saved = { layout: Layout | null; media: Record<string, CanvasMedia>; savedAt?: string | null };

export default function CarouselEditor({
  athlete,
  position,
  total,
  prevSlug,
  nextSlug,
}: {
  athlete: Athlete;
  position: number;
  total: number;
  prevSlug: string;
  nextSlug: string;
}) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [seams, setSeams] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const firstName = athlete.name.split(' ')[0];

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/carousels/${athlete.slug}/layout`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setSaved(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the carousel');
    }
  }, [athlete.slug]);

  useEffect(() => {
    setSaved(null);
    load();
  }, [load]);

  const layout = saved?.layout ?? null;
  const visible = layout?.layers.filter((l) => !l.hidden).length ?? 0;
  const savedAt = saved?.savedAt
    ? new Date(saved.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  const arrow =
    'grid h-10 w-10 place-items-center rounded-full border border-hairline-soft bg-surface-card text-[18px] text-ink-2 hover:text-ink-1';
  const chip = (on: boolean) =>
    `min-h-[36px] rounded-full border px-4 text-[12px] font-bold uppercase tracking-[.12em] ${
      on ? 'border-ink-1 bg-ink-1 text-ground' : 'border-hairline-soft bg-surface-card text-ink-3'
    }`;

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Link href="/dashboard/carousels" className="text-[11px] font-bold uppercase tracking-[.16em] text-ink-3 hover:text-ink-1">
          {athlete.campaign ?? "Raising Cane's Basketball 2027"} · IG feed carousel
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/carousels/${prevSlug}`} aria-label="Previous athlete" className={arrow}>‹</Link>
          <h1 className="font-display text-[44px] leading-none sm:text-[56px]">{athlete.name}</h1>
          <Link href={`/dashboard/carousels/${nextSlug}`} aria-label="Next athlete" className={arrow}>›</Link>
          <span className="text-[14px] text-ink-3">{position} of {total}</span>
          {savedAt && (
            <span className="rounded-full border border-hairline-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-ink-3">
              Saved {savedAt}
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Carousel canvas" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)} className={chip(playing)}>
              {playing ? '❚❚ Pause' : '▶ Play'}
            </button>
            <button type="button" aria-pressed={seams} onClick={() => setSeams((s) => !s)} className={chip(seams)}>
              Slide edges
            </button>
            {layout && <span className="ml-2 text-[13px] text-ink-4">{visible} layers · 5 slides</span>}
          </div>

          <div className="overflow-hidden rounded-2xl border border-hairline-soft bg-surface-card p-3">
            {error && <p className="p-6 text-[14px] text-status-bad-ink">{error}</p>}
            {!error && !saved && <div className="aspect-[4/1] animate-pulse rounded-lg bg-surface-raised" />}
            {saved && !layout && (
              <p className="p-6 text-[14px] text-ink-3">{firstName} doesn&apos;t have a saved carousel yet.</p>
            )}
            {layout && <CarouselCanvas layout={layout} media={saved!.media} playing={playing} showSeams={seams} />}
          </div>

          {note && <p className="text-[13px] text-ink-3">{note}</p>}
          <p className="text-[13px] text-ink-4">
            This is {firstName}&apos;s carousel as last saved in the old editor. Editing tools and the phone preview come next.
          </p>
        </section>

        <ClipPicker
          slug={athlete.slug}
          firstName={firstName}
          onPick={(c) => setNote(`Adding clips to the canvas comes with the editing tools — "${c.name}" is ready for that.`)}
        />
      </div>
    </div>
  );
}
