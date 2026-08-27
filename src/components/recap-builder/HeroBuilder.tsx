"use client";

// The Hero section of the builder: pick the stills, order them, frame each one,
// and see the result at the size the page renders it.
//
// Controlled — the shell owns the config and the saving, so this reports
// changes upward rather than writing anything. "Preview as you edit" is the
// point: a builder you cannot see the result of is how the current recap ended
// up with hero photos nobody checked.
import { useEffect, useRef, useState } from "react";
import { MediaPicker, type PickableMedia } from "./MediaPicker";
import { CropControls } from "./CropControls";
import { pickerThumb } from "@/components/recap-v2/media";
import { FOCAL_DEFAULTS, type FocalPoint } from "@/lib/recap-v2/config";

/** The reference design shows at most four stills before it repeats. */
const HERO_MAX = 4;

export function HeroBuilder({
  campaignId,
  items,
  initialSelected,
  initialFocal,
  derived,
  onChange,
}: {
  campaignId: string;
  items: PickableMedia[];
  initialSelected: string[];
  initialFocal: Record<string, FocalPoint>;
  derived: { title: string; brand: string; lede: string };
  onChange: (mediaIds: string[], focal: Record<string, FocalPoint>) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [focal, setFocal] = useState<Record<string, FocalPoint>>(initialFocal);
  const [activeId, setActiveId] = useState<string | null>(initialSelected[0] ?? null);

  // Warm the campaign's transforms once per open. Supabase generates each
  // derivative from the original on first request, so without this the first
  // person to open a campaign watches full-size photos being resized one at a
  // time. Fire and forget — a failed warm costs only the slow first view we
  // already had.
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
  const active = activeId ? byId.get(activeId) ?? null : null;
  const activeFocal = (activeId ? focal[activeId] : undefined) ?? FOCAL_DEFAULTS;

  const commit = (ids: string[], f: Record<string, FocalPoint>) => {
    setSelected(ids);
    setFocal(f);
    onChange(ids, f);
  };

  const handleSelection = (next: string[]) => {
    // Drop framing for anything deselected, so a stale crop cannot resurface if
    // the still is added back later.
    const nextFocal = Object.fromEntries(
      Object.entries(focal).filter(([id]) => next.includes(id)),
    );
    commit(next, nextFocal);
    setActiveId((cur) => (cur && next.includes(cur) ? cur : next[next.length - 1] ?? null));
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-xs text-gray-500">
          Click to select. The number is the order they appear in. Videos are not offered — the
          hero is a still frame.
        </p>
        <MediaPicker items={items} selected={selected} onChange={handleSelection} max={HERO_MAX} />
      </div>

      {chosen.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-800 p-6 text-center text-sm text-gray-500">
          Nothing selected. The recap falls back to its derived order — is_hero first, then
          sort_order, then upload date.
        </p>
      ) : (
        <div>
          <p className="mb-3 text-xs text-gray-500">
            Each still is framed separately. Pick one to adjust it.
          </p>
          <ol className="mb-4 flex list-none flex-wrap gap-2">
            {chosen.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(m.id)}
                  aria-pressed={m.id === activeId}
                  className={`relative h-14 w-14 overflow-hidden rounded border-2 ${
                    m.id === activeId ? "border-white" : "border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pickerThumb(m.url)} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-[#D73F09] text-[9px] font-bold text-white">
                    {i + 1}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {active ? (
            <CropControls
              url={active.url}
              focal={activeFocal}
              onChange={(next) => commit(selected, { ...focal, [active.id]: next })}
              title={derived.title}
              kicker={derived.brand || null}
              lede={derived.lede}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
