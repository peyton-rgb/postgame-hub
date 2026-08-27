"use client";

// Hero section of the recap builder: pick the stills, order them, see the
// result at the size the page will actually render them.
//
// "Preview as you edit" is the point — a builder you cannot see the result of
// is how the current recap ended up with hero photos nobody checked.
import { useEffect, useRef, useState } from "react";
import { MediaPicker, type PickableMedia } from "./MediaPicker";
import { HERO_PREVIEW_WIDTH, heroPreview } from "@/components/recap-v2/media";

/** The reference design shows at most four stills before it repeats. */
const HERO_MAX = 4;

export function HeroBuilder({
  campaignId,
  items,
  initialSelected,
}: {
  campaignId: string;
  items: PickableMedia[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);

  // Warm the picker's thumbnails once per open. Supabase generates each
  // derivative from the original on first request, so without this the first
  // person to open a campaign watches 73 full-size photos being resized one at
  // a time. Fire and forget: the grid is already loading what it can see, and
  // this is about everything below the fold being ready by the time they
  // scroll. Deliberately not awaited and deliberately not surfaced — a failed
  // warm costs nothing but the slow first view we already had.
  const warmed = useRef(false);
  useEffect(() => {
    if (warmed.current) return;
    warmed.current = true;
    void fetch("/api/recap-builder/warm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    }).catch(() => {});
  }, [campaignId]);
  const byId = new Map(items.map((m) => [m.id, m] as const));
  const chosen = selected.map((id) => byId.get(id)).filter((m): m is PickableMedia => !!m);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-300">
          Hero stills
        </h2>
        <p className="mb-4 text-xs text-neutral-500">
          Click to select. The number is the order they appear in. Videos are not
          offered here — the hero is a still frame.
        </p>
        <MediaPicker items={items} selected={selected} onChange={setSelected} max={HERO_MAX} />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-300">
          Preview
        </h2>
        <p className="mb-4 text-xs text-neutral-500">
          Rendered at {HERO_PREVIEW_WIDTH}px, the width the recap requests.
        </p>
        {chosen.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
            Nothing selected. The recap will fall back to its derived order —
            is_hero first, then sort_order, then upload date.
          </p>
        ) : (
          <ol className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2">
            {chosen.map((m, i) => (
              <li key={m.id} className="relative overflow-hidden rounded-lg border border-neutral-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroPreview(m.url)}
                  alt=""
                  className="block aspect-[16/9] w-full bg-neutral-900 object-cover"
                />
                <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                  {i + 1}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-300">
          recap_config.hero
        </h2>
        <pre className="overflow-x-auto rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-xs text-neutral-300">
{JSON.stringify({ media_ids: selected, focal: {} }, null, 2)}
        </pre>
        <p className="mt-2 text-xs text-amber-400">
          Not saved yet — writing needs the cache-invalidation decision settled
          first (a saved config will not appear on the recap until the fetch
          cache is revalidated).
        </p>
      </section>
    </div>
  );
}
