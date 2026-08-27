"use client";

// Hero section of the recap builder: pick the stills, order them, see the
// result at the size the page will actually render them.
//
// "Preview as you edit" is the point — a builder you cannot see the result of
// is how the current recap ended up with hero photos nobody checked.
import { useEffect, useRef, useState } from "react";
import { MediaPicker, type PickableMedia } from "./MediaPicker";
import { pickerThumb } from "@/components/recap-v2/media";
import { CropControls } from "./CropControls";
import {
  FOCAL_DEFAULTS,
  canonicalise,
  type FocalPoint,
  type RecapConfig,
} from "@/lib/recap-v2/config";
import { saveRecapConfig } from "@/app/dashboard/recap-builder/actions";

/** The reference design shows at most four stills before it repeats. */
const HERO_MAX = 4;

export function HeroBuilder({
  campaignId,
  items,
  initialSelected,
  initialFocal,
  initialConfig,
  derived,
}: {
  campaignId: string;
  items: PickableMedia[];
  initialSelected: string[];
  initialFocal: Record<string, FocalPoint>;
  initialConfig: RecapConfig;
  /** What the page would show with no config — the placeholders. */
  derived: { title: string; brand: string; lede: string };
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [focal, setFocal] = useState<Record<string, FocalPoint>>(initialFocal);
  const [displayName, setDisplayName] = useState(initialConfig.display_name ?? "");
  const [brand, setBrand] = useState(initialConfig.brand ?? "");
  const [lede, setLede] = useState(initialConfig.hero?.lede ?? "");
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  // Which selected still the crop controls are pointed at. Framing is
  // per-photo, so there has to be a current one.
  const [activeId, setActiveId] = useState<string | null>(initialSelected[0] ?? null);

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

  // Keep the active still valid as the selection changes, and drop framing for
  // anything deselected so a stale crop cannot resurface if it is re-added.
  const handleSelection = (next: string[]) => {
    setSelected(next);
    setFocal((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => next.includes(id))));
    setActiveId((cur) => (cur && next.includes(cur) ? cur : next[next.length - 1] ?? null));
  };

  const active = activeId ? byId.get(activeId) ?? null : null;
  const activeFocal = (activeId ? focal[activeId] : undefined) ?? FOCAL_DEFAULTS;

  // Only the fields a person has actually filled in are written. An empty box
  // means "no override" and the page falls back to its derivation — it does not
  // mean "blank title".
  const current: RecapConfig = {
    ...initialConfig,
    ...(displayName.trim() ? { display_name: displayName.trim() } : {}),
    ...(brand.trim() ? { brand: brand.trim() } : {}),
    ...(selected.length > 0 || lede.trim()
      ? { hero: { media_ids: selected, focal, ...(lede.trim() ? { lede: lede.trim() } : {}) } }
      : {}),
  };
  if (!displayName.trim()) delete current.display_name;
  if (!brand.trim()) delete current.brand;
  if (selected.length === 0 && !lede.trim()) delete current.hero;

  // #208: dirty is the normalised form of what was LOADED against the
  // normalised form of what is on screen. Opening a campaign must never be a
  // write, and key order must never read as a change.
  const dirty = canonicalise(initialConfig) !== canonicalise(current);

  async function save() {
    setSaving(true);
    setSaveNote(null);
    const res = await saveRecapConfig(campaignId, current);
    setSaving(false);
    if (!res.ok) {
      setSaveNote(res.error ?? "Could not save.");
      return;
    }
    setSaveNote(
      res.issues && res.issues.length > 0
        ? `Saved. ${res.issues.length} value(s) adjusted: ${res.issues[0]}`
        : "Saved.",
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-300">
          Overview
        </h2>
        <Field
          label="Display name — what the client sees"
          value={displayName}
          onChange={setDisplayName}
          placeholder={derived.title}
          hint={`Campaign is named "${derived.title}" in the admin.`}
        />
        <Field
          label="Brand"
          value={brand}
          onChange={setBrand}
          placeholder={derived.brand || "Brand"}
          hint="Separate from the account name on the campaign record."
        />
        <Field
          label="Hero lede — the line under the title"
          value={lede}
          onChange={setLede}
          placeholder={derived.lede}
          hint="Separate from the campaign overview. These were one field before, so the same copy printed twice."
        />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-300">
          Hero stills
        </h2>
        <p className="mb-4 text-xs text-neutral-500">
          Click to select. The number is the order they appear in. Videos are not
          offered here — the hero is a still frame.
        </p>
        <MediaPicker items={items} selected={selected} onChange={handleSelection} max={HERO_MAX} />
      </section>

      {chosen.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
          Nothing selected. The recap will fall back to its derived order —
          is_hero first, then sort_order, then upload date.
        </p>
      ) : (
        <>
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-neutral-300">
              Framing
            </h2>
            <p className="mb-4 text-xs text-neutral-500">
              Each still is framed separately. Pick one below to adjust it.
            </p>
            {/* Which still the controls act on. */}
            <ol className="mb-4 flex list-none flex-wrap gap-2">
              {chosen.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(m.id)}
                    aria-pressed={m.id === activeId}
                    className={`relative h-14 w-14 overflow-hidden rounded border-2 ${
                      m.id === activeId ? "border-white" : "border-neutral-700 hover:border-neutral-500"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pickerThumb(m.url)} alt="" className="h-full w-full object-cover" />
                    <span className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-orange-500 text-[9px] font-bold text-white">
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
                onChange={(next) => setFocal((prev) => ({ ...prev, [active.id]: next }))}
                title={displayName.trim() || derived.title}
                kicker={brand.trim() || derived.brand || null}
                lede={lede.trim() || derived.lede}
              />
            ) : null}
          </section>
        </>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-300">
          recap_config.hero
        </h2>
        <pre className="overflow-x-auto rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-xs text-neutral-300">
{JSON.stringify({ media_ids: selected, focal }, null, 2)}
        </pre>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              dirty && !saving
                ? "bg-orange-500 text-white hover:bg-orange-400"
                : "cursor-not-allowed bg-neutral-800 text-neutral-500"
            }`}
          >
            {saving ? "Saving…" : dirty ? "Save" : "All changes saved"}
          </button>
          {saveNote ? <span className="text-xs text-neutral-400">{saveNote}</span> : null}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-orange-500"
      />
      <span className="mt-1 block text-[11px] text-neutral-600">{hint}</span>
    </label>
  );
}
