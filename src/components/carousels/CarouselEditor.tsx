'use client';

// The carousel editor page body. Step 3 scope: header with athlete arrows,
// a 5-slide 4:5 canvas, and the live Frame.io picker. Picking a clip puts it
// on the selected slide. Layouts are held in memory only — saving and the
// 36 existing layouts arrive in step 4, the Andres grade in step 5.

import Link from 'next/link';
import { useState } from 'react';
import ClipPicker, { type PickerClip } from './ClipPicker';
import HlsVideo from './HlsVideo';

type Athlete = { slug: string; name: string; campaign: string | null };

const SLIDES = 5;

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
  const [slides, setSlides] = useState<(PickerClip | null)[]>(() => Array(SLIDES).fill(null));
  const [active, setActive] = useState(0);
  const firstName = athlete.name.split(' ')[0];

  const place = (clip: PickerClip) => {
    setSlides((s) => s.map((c, i) => (i === active ? clip : c)));
    // Move on to the next empty slide so picking several clips in a row fills the carousel.
    setActive((a) => {
      const next = slides.findIndex((c, i) => i > a && !c);
      return next === -1 ? a : next;
    });
  };
  const clear = (i: number) => setSlides((s) => s.map((c, j) => (j === i ? null : c)));

  const arrow =
    'grid h-10 w-10 place-items-center rounded-full border border-hairline-soft bg-surface-card text-[18px] text-ink-2 hover:text-ink-1';

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <Link href="/dashboard/carousels" className="text-[11px] font-bold uppercase tracking-[.16em] text-ink-3 hover:text-ink-1">
          {athlete.campaign ?? "Raising Cane's Basketball 2027"} · IG feed carousel
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/dashboard/carousels/${prevSlug}`} aria-label="Previous athlete" className={arrow}>
            ‹
          </Link>
          <h1 className="font-display text-[44px] leading-none sm:text-[56px]">{athlete.name}</h1>
          <Link href={`/dashboard/carousels/${nextSlug}`} aria-label="Next athlete" className={arrow}>
            ›
          </Link>
          <span className="text-[14px] text-ink-3">
            {position} of {total}
          </span>
          <span className="rounded-full border border-hairline-soft px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-ink-3">
            Draft · not saved yet
          </span>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Carousel canvas" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Slides">
            {slides.map((c, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active === i}
                onClick={() => setActive(i)}
                className={`min-h-[36px] rounded-full border px-4 text-[12px] font-bold uppercase tracking-[.12em] ${
                  active === i ? 'border-ink-1 bg-ink-1 text-ground' : 'border-hairline-soft bg-surface-card text-ink-3'
                }`}
              >
                Slide {i + 1}
                {c ? ' ●' : ''}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-hairline-soft bg-surface-card p-4">
            <div className="flex gap-1" style={{ minWidth: `${SLIDES * 180}px` }}>
              {slides.map((c, i) => (
                <div
                  key={i}
                  onClick={() => setActive(i)}
                  className={`relative aspect-[4/5] flex-1 cursor-pointer overflow-hidden bg-ground outline outline-2 -outline-offset-2 ${
                    active === i ? 'outline-accent' : 'outline-transparent'
                  }`}
                >
                  {c ? (
                    c.kind === 'video' ? (
                      <HlsVideo src={c.play} poster={c.thumb} className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumb ?? ''} alt={c.name} className="h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="grid h-full place-items-center p-3 text-center text-[13px] text-ink-4">
                      {active === i ? 'Pick a clip from the right →' : `Slide ${i + 1}`}
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-ground/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.14em] text-ink-1">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {slides[active] && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline-soft bg-surface-card p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[.16em] text-ink-3">Slide {active + 1}</p>
                <p className="truncate text-[15px] text-ink-1">{slides[active]!.name}</p>
              </div>
              {slides[active]!.viewUrl && (
                <a href={slides[active]!.viewUrl!} target="_blank" rel="noreferrer" className="text-[14px] text-ink-2 underline-offset-2 hover:underline">
                  Open in Frame.io
                </a>
              )}
              <button
                type="button"
                onClick={() => clear(active)}
                className="min-h-[36px] rounded-full border border-hairline-soft px-4 text-[12px] font-bold uppercase tracking-[.12em] text-ink-2 hover:text-ink-1"
              >
                Remove
              </button>
            </div>
          )}
          <p className="text-[13px] text-ink-4">
            Layouts aren&apos;t saved yet — that&apos;s the next step. Your existing layouts are still in the old editor.
          </p>
        </section>

        <ClipPicker slug={athlete.slug} firstName={firstName} onPick={place} />
      </div>
    </div>
  );
}
