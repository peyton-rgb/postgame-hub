"use client";

// The five remaining builder sections, in the live editor's vocabulary:
// Key Takeaways, Campaign Metrics, Top Performers, Best In Class Content, and
// the visibility/order list that covers Campaign Roster and the rest.
//
// Every control writes a POSITIVE choice into recap_config. Leaving one alone
// is not "off" — it means the recap falls back to its derivation, which is what
// all 626 campaigns do today and what makes an unbuilt recap still render.
import { BuilderSection, Field, ReorderButtons, Toggle } from "./chrome";
import { MediaPicker, type PickableMedia } from "./MediaPicker";
import {
  NUMBER_LAYOUTS,
  NUMBER_METRICS,
  PERFORMER_ORDERS,
  SECTION_LABEL_EDITOR,
  type ContentConfig,
  type NumberLayout,
  type NumberMetric,
  type NumbersConfig,
  type PerformerOrder,
  type PerformersConfig,
  type SectionConfig,
  type TakeawaysConfig,
} from "@/lib/recap-v2/config";
import type { SectionId } from "@/lib/recap-v2/guards";

// ── Key Takeaways ───────────────────────────────────────────────────────────
// A headline and discrete points, each its own field. This is what replaces
// the free-text blob: 12 of 32 campaigns typed "-" and "*" by hand because
// there was no list control.
export function TakeawaysEditor({
  value,
  onChange,
  derivedNote,
}: {
  value: TakeawaysConfig | undefined;
  onChange: (next: TakeawaysConfig | undefined) => void;
  derivedNote: string | null;
}) {
  const headline = value?.headline ?? "";
  const points = value?.points ?? [];

  const set = (headlineNext: string, pointsNext: string[]) => {
    const cleaned = pointsNext.filter((p) => p.trim().length > 0 || pointsNext.length === 1);
    if (!headlineNext.trim() && cleaned.every((p) => !p.trim())) return onChange(undefined);
    onChange({ headline: headlineNext, points: cleaned });
  };

  return (
    <BuilderSection
      title="Key Takeaways"
      hint="A headline and the points under it. Leave empty to keep whatever the campaign already has."
    >
      <div className="space-y-4">
        <Field
          label="Headline"
          value={headline}
          onChange={(v) => set(v, points)}
          placeholder="The one line a client should remember"
          multiline
        />
        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Points
          </span>
          <div className="space-y-2">
            {points.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 w-6 shrink-0 font-mono text-[11px] text-[#D73F09]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <textarea
                  rows={2}
                  value={p}
                  onChange={(e) => {
                    const next = [...points];
                    next[i] = e.target.value;
                    set(headline, next);
                  }}
                  className="w-full rounded-lg border border-gray-800 bg-black px-3 py-2 text-sm text-gray-100 outline-none focus:border-[#D73F09]"
                />
                <ReorderButtons
                  index={i}
                  length={points.length}
                  onMove={(from, to) => {
                    const next = [...points];
                    const [m] = next.splice(from, 1);
                    next.splice(to, 0, m);
                    set(headline, next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => set(headline, points.filter((_, j) => j !== i))}
                  aria-label={`Remove point ${i + 1}`}
                  className="mt-1 rounded border border-gray-700 px-2 text-xs text-gray-500 hover:border-gray-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => set(headline, [...points, ""])}
            className="mt-3 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-300 hover:border-gray-500"
          >
            Add point
          </button>
        </div>
        {derivedNote ? (
          <p className="rounded-lg border border-dashed border-gray-800 p-3 text-[11px] leading-relaxed text-gray-500">
            Currently showing the existing free-text takeaways. Anything typed above replaces them
            on the recap; the original stays on the campaign untouched.
          </p>
        ) : null}
      </div>
    </BuilderSection>
  );
}

// ── Campaign Metrics ────────────────────────────────────────────────────────
export function MetricsEditor({
  value,
  onChange,
}: {
  value: NumbersConfig | undefined;
  onChange: (next: NumbersConfig | undefined) => void;
}) {
  const metrics = value?.metrics ?? [];
  const targets = value?.targets ?? {};
  const layout: NumberLayout = value?.layout ?? "standard";

  const commit = (m: NumberMetric[], t: NumbersConfig["targets"], l: NumberLayout) => {
    if (m.length === 0 && Object.keys(t).length === 0 && l === "standard") return onChange(undefined);
    onChange({ metrics: m, targets: t, layout: l });
  };

  return (
    <BuilderSection
      title="Campaign Metrics"
      hint="Which figures appear, in this order. A metric with no data behind it is still left out."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {NUMBER_METRICS.map((m) => (
            <Toggle
              key={m}
              on={metrics.includes(m)}
              label={SECTION_LABEL_EDITOR.metric[m]}
              onChange={(on) =>
                commit(
                  on ? [...metrics, m] : metrics.filter((x) => x !== m),
                  targets,
                  layout,
                )
              }
            />
          ))}
        </div>

        {metrics.length > 0 ? (
          <div className="rounded-xl border border-gray-800 p-4">
            <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-gray-400">
              Targets — optional
            </span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {metrics
                .filter((m) => m !== "headline")
                .map((m) => (
                  <label key={m} className="block">
                    <span className="mb-1 block text-[11px] text-gray-500">
                      {SECTION_LABEL_EDITOR.metric[m]}
                    </span>
                    <input
                      type="number"
                      value={targets[m] ?? ""}
                      onChange={(e) => {
                        const next = { ...targets };
                        if (e.target.value === "") delete next[m];
                        else next[m] = Number(e.target.value);
                        commit(metrics, next, layout);
                      }}
                      className="w-full rounded-lg border border-gray-800 bg-black px-2 py-1.5 text-sm outline-none focus:border-[#D73F09]"
                    />
                  </label>
                ))}
            </div>
          </div>
        ) : null}

        <div>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">
            Grouping
          </span>
          <div className="flex gap-2">
            {NUMBER_LAYOUTS.map((l) => (
              <Toggle
                key={l}
                on={layout === l}
                label={l}
                onChange={() => commit(metrics, targets, l)}
              />
            ))}
          </div>
        </div>
      </div>
    </BuilderSection>
  );
}

// ── Top Performers ──────────────────────────────────────────────────────────
export function PerformersEditor({
  value,
  onChange,
  athletes,
}: {
  value: PerformersConfig | undefined;
  onChange: (next: PerformersConfig | undefined) => void;
  athletes: { id: string; name: string; school: string | null; engagements: number }[];
}) {
  const ids = value?.athlete_ids ?? [];
  const order: PerformerOrder = value?.order ?? "manual";

  const commit = (nextIds: string[], nextOrder: PerformerOrder) => {
    if (nextIds.length === 0 && nextOrder === "manual") return onChange(undefined);
    onChange({ athlete_ids: nextIds, order: nextOrder });
  };

  return (
    <BuilderSection
      title="Top Performers"
      hint="Choose who is featured. Leave empty and the recap ranks by engagements, as it does now."
      right={
        <div className="flex gap-2">
          {PERFORMER_ORDERS.map((o) => (
            <Toggle key={o} on={order === o} label={o} onChange={() => commit(ids, o)} />
          ))}
        </div>
      }
    >
      <ol className="max-h-72 space-y-1 overflow-y-auto">
        {athletes.map((a) => {
          const pos = ids.indexOf(a.id);
          const picked = pos >= 0;
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() =>
                  commit(picked ? ids.filter((x) => x !== a.id) : [...ids, a.id], order)
                }
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  picked ? "border-[#D73F09] bg-[#D73F09]/10" : "border-gray-800 hover:border-gray-600"
                }`}
              >
                <span className="w-6 shrink-0 font-mono text-[11px] text-[#D73F09]">
                  {picked ? String(pos + 1).padStart(2, "0") : ""}
                </span>
                <span className="flex-1 truncate">{a.name}</span>
                {a.school ? (
                  <span className="hidden truncate text-xs text-gray-500 sm:block">{a.school}</span>
                ) : null}
                <span className="shrink-0 font-mono text-[11px] text-gray-500">
                  {a.engagements.toLocaleString()}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </BuilderSection>
  );
}

// ── Best In Class Content ───────────────────────────────────────────────────
export function ContentEditor({
  value,
  onChange,
  items,
}: {
  value: ContentConfig | undefined;
  onChange: (next: ContentConfig | undefined) => void;
  items: PickableMedia[];
}) {
  const ids = value?.media_ids ?? [];
  return (
    <BuilderSection
      title="Best In Class Content"
      hint="The gallery shows one box per athlete. Choosing assets here chooses which athletes appear."
    >
      <MediaPicker
        items={items}
        selected={ids}
        onChange={(next) =>
          next.length === 0 ? onChange(undefined) : onChange({ media_ids: next, order: "manual" })
        }
        emptyLabel="No photography on this campaign."
      />
    </BuilderSection>
  );
}

// ── Sections: visibility and order ──────────────────────────────────────────
export function SectionsEditor({
  value,
  onChange,
  available,
}: {
  value: SectionConfig[] | undefined;
  onChange: (next: SectionConfig[] | undefined) => void;
  /** What the data can actually support, from the guards. */
  available: SectionId[];
}) {
  const rows: SectionConfig[] =
    value ?? available.map((key, order) => ({ key, visible: true, order }));

  const commit = (next: SectionConfig[]) =>
    onChange(next.map((r, i) => ({ ...r, order: i })));

  return (
    <BuilderSection
      title="Sections"
      hint="Order and visibility. A section with no data behind it stays out either way."
    >
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.key}
            className={`flex items-center gap-3 rounded-xl border p-4 ${
              r.visible ? "border-gray-800" : "border-gray-900 bg-black/40 opacity-60"
            }`}
          >
            <ReorderButtons
              index={i}
              length={rows.length}
              onMove={(from, to) => {
                const next = [...rows];
                const [m] = next.splice(from, 1);
                next.splice(to, 0, m);
                commit(next);
              }}
            />
            <span className="flex-1 text-sm font-bold uppercase tracking-wide">
              {SECTION_LABEL_EDITOR.section[r.key]}
            </span>
            {!available.includes(r.key) ? (
              <span className="text-[11px] text-gray-600">no data</span>
            ) : null}
            <Toggle
              on={r.visible}
              label={r.visible ? "Shown" : "Hidden"}
              onChange={(on) =>
                commit(rows.map((x, j) => (j === i ? { ...x, visible: on } : x)))
              }
            />
          </li>
        ))}
      </ul>
    </BuilderSection>
  );
}
