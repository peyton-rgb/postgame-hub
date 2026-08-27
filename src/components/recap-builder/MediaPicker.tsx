"use client";

// The builder's media picker.
//
// NOT CampaignMediaPicker — that file is protected and the old editor keeps
// using it. This is the new one, built alongside.
//
// Two things make it different from a naive grid:
//
//  1. It transforms. There are no thumbnails for photographs: on Ghost Amp all
//     73 photo rows have thumbnail_url byte-identical to file_url, and its 72
//     measured photos total 422MB with a median of 4.3MB. A grid of originals
//     would pull the lot. Every tile is requested at width=320&quality=70 with
//     resize=contain, which turns a 22MB original into 14KB.
//
//  2. It says when an asset cannot be previewed AT SELECTION TIME. Over a
//     source-file ceiling measured between 22.0MB and 24.2MB — lower than the
//     25MB usually quoted — the transformer answers 400 InvalidRequest "The
//     source image file is too large to process", and no width or quality
//     setting changes it because the limit is on the input. Ghost Amp has two:
//     a 31.5MB and a 24.2MB photo, both Christian Weddington's shoot. Left
//     alone they would be picked happily in the builder and then silently
//     vanish from the rendered hero. Here they are marked unusable, cannot be
//     selected, and say why.
//
// Detection costs no extra requests: the grid already loads the transform, so
// a tile that errors IS the signal.
import { useCallback, useMemo, useState } from "react";
import { pickerThumb } from "@/components/recap-v2/media";

export interface PickableMedia {
  id: string;
  /** The still to preview — a photo's own file, or a video's thumbnail. */
  url: string;
  athleteName: string | null;
  isVideo: boolean;
}

export function MediaPicker({
  items,
  selected,
  onChange,
  max,
  emptyLabel = "No assets on this campaign.",
}: {
  items: PickableMedia[];
  /** Ordered. Position in this array is the display order. */
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  emptyLabel?: string;
}) {
  const [unusable, setUnusable] = useState<Set<string>>(new Set());
  const selectedIndex = useMemo(() => {
    const m = new Map<string, number>();
    selected.forEach((id, i) => m.set(id, i));
    return m;
  }, [selected]);

  const markUnusable = useCallback(
    (id: string) => {
      setUnusable((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
      // If it was already picked — from an older config, or picked in the
      // instant before the transform failed — take it back out rather than
      // leaving a selection that cannot render.
      onChange(selected.filter((s) => s !== id));
    },
    [onChange, selected],
  );

  const toggle = (id: string) => {
    if (unusable.has(id)) return;
    if (selectedIndex.has(id)) {
      onChange(selected.filter((s) => s !== id));
      return;
    }
    if (max != null && selected.length >= max) return;
    onChange([...selected, id]);
  };

  if (items.length === 0) {
    return <p className="text-sm text-neutral-400">{emptyLabel}</p>;
  }

  const atLimit = max != null && selected.length >= max;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-neutral-400">
        <span>
          {selected.length} selected
          {max != null ? ` of ${max}` : ""}
        </span>
        <span>{items.length} available</span>
        {unusable.size > 0 ? (
          <span className="text-amber-400">
            {unusable.size} cannot be previewed — too large for the image transformer to render
          </span>
        ) : null}
      </div>

      <ul className="grid list-none grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((m) => {
          const order = selectedIndex.get(m.id);
          const isSelected = order != null;
          const dead = unusable.has(m.id);
          const blocked = dead || (atLimit && !isSelected);
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => toggle(m.id)}
                disabled={blocked}
                aria-pressed={isSelected}
                title={
                  dead
                    ? "Too large to preview or render — the image transformer refuses source files this big (the ceiling measures between 22.0MB and 24.2MB)"
                    : m.athleteName ?? undefined
                }
                className={`relative block aspect-[4/5] w-full overflow-hidden rounded-lg border text-left transition ${
                  isSelected
                    ? "border-orange-500 ring-2 ring-orange-500/50"
                    : "border-neutral-700 hover:border-neutral-500"
                } ${blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              >
                {dead ? (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-neutral-900 p-2 text-center">
                    <span className="text-lg leading-none">⚠</span>
                    <span className="text-[10px] leading-tight text-amber-400">
                      Too large to preview
                    </span>
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pickerThumb(m.url)}
                    alt={m.athleteName ? `${m.athleteName} — campaign asset` : "Campaign asset"}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full bg-neutral-900 object-cover"
                    onError={() => markUnusable(m.id)}
                  />
                )}

                {isSelected ? (
                  <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                    {order + 1}
                  </span>
                ) : null}
                {m.isVideo ? (
                  <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white">
                    Video
                  </span>
                ) : null}
                {m.athleteName ? (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white">
                    {m.athleteName}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
