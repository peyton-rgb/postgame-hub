"use client";

// ============================================================
// Make an audience — the form half of /admin/audiences/new (the
// prototype's S["audience-new"], which copies ColdFusion's
// audiences_edit form onto one page).
//
// The form keeps its own state and mirrors it into the URL (debounced),
// so the server page re-renders the "Who's in it" panel with an exact
// count from `people`. `side` is that server-rendered panel, passed in
// as a child. Saving posts the same params to the saveAudience action.
// ============================================================

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AudienceDraft, BuilderOptions } from "./audience-types";
import { saveAudience } from "@/app/admin/audiences/actions";

const LEVELS: Array<{ key: AudienceDraft["levels"][number]; label: string }> = [
  { key: "college", label: "College" },
  { key: "high_school", label: "High school" },
  { key: "pro", label: "Pro" },
  { key: "former", label: "Former" },
];
const GENDERS = [
  { value: "M", label: "Men" },
  { value: "W", label: "Women" },
  { value: "N", label: "Non-binary" },
];

const inputCls = "h-[36px] w-full rounded-md border border-stone-300 bg-white px-3 text-[13px] text-stone-800";
const labelCls = "mb-1 block text-[12px] font-medium text-stone-700";

function toParams(d: AudienceDraft): Record<string, string> {
  const p: Record<string, string> = {};
  const put = (k: string, v: string) => {
    if (v) p[k] = v;
  };
  put("levels", d.levels.join("|") || "college|high_school|pro|former");
  put("influencers", d.influencers ? "1" : "");
  put("include", d.include !== "all" ? d.include : "");
  put("handles", d.handles.split(/[\s,;]+/).filter(Boolean).join("|"));
  put("state", d.states.join("|"));
  put("gender", d.genders.join("|"));
  put("college", d.colleges.join("|"));
  put("sport", d.sports.join("|"));
  put("min", d.min.replace(/\D/g, ""));
  put("max", d.max.replace(/\D/g, ""));
  put("rating", d.rating);
  put("exclude", d.exclude.split(/[\s,;]+/).filter(Boolean).join("|"));
  put("exclude_campaigns", d.excludeCampaigns.join("|"));
  return p;
}

function MultiField({
  id,
  label,
  options,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
  hint?: string;
}) {
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <select
        id={id}
        className={inputCls}
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v && !value.includes(v)) onChange([...value, v]);
        }}
      >
        <option value="">{hint ?? `Add ${label.toLowerCase()}…`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={value.includes(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="mt-1.5 flex min-h-[24px] flex-wrap gap-1.5">
        {value.length === 0 ? (
          <span className="text-[12px] text-stone-400">Any</span>
        ) : (
          value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-stone-100 py-0.5 pl-2.5 pr-1 text-[12px] text-stone-700">
              {labelOf(v)}
              <button
                type="button"
                aria-label={`Remove ${labelOf(v)}`}
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="grid h-4 w-4 place-items-center rounded-full text-stone-500 hover:bg-stone-200 hover:text-stone-800"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function AudienceBuilder({
  initial,
  options,
  side,
  pickedNote,
}: {
  initial: AudienceDraft;
  options: BuilderOptions;
  /** the server-rendered "Who's in it" panel */
  side: React.ReactNode;
  /** how many athletes came over from the Athletes page pick bar */
  pickedNote: number | null;
}) {
  const router = useRouter();
  const [d, setD] = useState<AudienceDraft>(initial);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState<"" | "save" | "dl">("");
  const first = useRef(true);

  const params = useMemo(() => toParams(d), [d]);
  const set = <K extends keyof AudienceDraft>(k: K, v: AudienceDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  // Mirror filters into the URL so the server recounts (name stays out of the count).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (d.id) u.set("id", d.id);
      if (d.name) u.set("name", d.name);
      startTransition(() => router.replace(`/admin/audiences/new?${u.toString()}`, { scroll: false }));
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const handleCount = d.handles.split(/[\s,;]+/).filter(Boolean).length;

  return (
    <form
      action={saveAudience}
      onSubmit={(e) => {
        const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        setSaving(btn?.value === "1" ? "dl" : "save");
      }}
    >
      <input type="hidden" name="id" value={d.id ?? ""} />
      <input type="hidden" name="params" value={JSON.stringify(params)} />

      <div className="flex flex-wrap items-end justify-between gap-3 pb-5">
        <div>
          <div className="mb-1 text-[12px] text-stone-500">
            <a href="/admin/audiences" className="hover:text-stone-800 hover:underline">
              Audiences
            </a>
          </div>
          <h1 className="text-xl font-semibold text-stone-900">{d.id ? "Edit audience" : "Make an audience"}</h1>
          <p className="mt-1 text-[13px] text-stone-500">
            Build a reusable list of athletes. Use it to invite athletes to a campaign or to target an app card.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a href={d.id ? `/admin/audiences/${d.id}` : "/admin/audiences"} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-stone-600 hover:bg-stone-100">
            Cancel
          </a>
          <button
            type="submit"
            name="download"
            value="1"
            disabled={!!saving}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400 disabled:opacity-60"
          >
            {saving === "dl" ? "Saving…" : "Save & download CSV"}
          </button>
          <button
            type="submit"
            name="download"
            value="0"
            disabled={!!saving}
            className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#B33407] disabled:opacity-60"
          >
            {saving === "save" ? "Saving…" : "Save audience"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-xl border border-stone-200 bg-white p-4 md:p-5">
          {pickedNote != null && pickedNote > 0 && (
            <div className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-[13px] text-stone-600">
              Started with the <b>{pickedNote}</b> athletes you picked on the Athletes page. Add filters to grow the list, or save it as is.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="au-name" className={labelCls}>
                Audience name
              </label>
              <input
                id="au-name"
                name="name"
                className={inputCls}
                placeholder="e.g. SEC football, 10K+ followers"
                value={d.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <span className={labelCls}>Who to include</span>
              <div className="inline-flex flex-wrap rounded-md border border-stone-300 bg-stone-50 p-0.5" role="group">
                {(
                  [
                    ["all", "All athletes"],
                    ["app", "App users only"],
                    ["noapp", "Athletes without the app"],
                  ] as const
                ).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={d.include === k}
                    onClick={() => set("include", k)}
                    className={
                      "rounded px-3 py-1 text-[13px] font-medium " +
                      (d.include === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800")
                    }
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[12px] text-stone-500">
                &quot;All athletes&quot; means everyone at the levels you pick, not just app users. If you use this audience on an app
                card, only the ones with the app will see it.
              </p>
            </div>

            <div className="md:col-span-2">
              <span className={labelCls}>Levels</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-stone-700">
                {LEVELS.map((l) => (
                  <label key={l.key} className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="accent-[#D73F09]"
                      checked={d.levels.includes(l.key)}
                      onChange={(e) =>
                        set("levels", e.target.checked ? [...d.levels, l.key] : d.levels.filter((x) => x !== l.key))
                      }
                    />
                    {l.label}
                    {options.levelCounts[l.key] != null && (
                      <span className="text-[11px] tabular-nums text-stone-400">{options.levelCounts[l.key]!.toLocaleString("en-US")}</span>
                    )}
                  </label>
                ))}
                <label className="inline-flex items-center gap-1.5 text-stone-500">
                  <input
                    type="checkbox"
                    className="accent-[#D73F09]"
                    checked={d.influencers}
                    onChange={(e) =>
                      setD((x) => ({
                        ...x,
                        influencers: e.target.checked,
                        levels: e.target.checked && !x.levels.includes("former") ? [...x.levels, "former"] : x.levels,
                      }))
                    }
                  />
                  only sports influencers (10K+)
                </label>
              </div>
              <p className="mt-1 text-[12px] text-stone-500">
                College only unless the brand wants rising high school athletes, pros or former athletes too.
              </p>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="au-handles" className={labelCls}>
                Add Instagram handles
              </label>
              <textarea
                id="au-handles"
                rows={4}
                className={inputCls + " h-auto py-2"}
                placeholder="Paste a column, or a comma-separated list"
                value={d.handles}
                onChange={(e) => set("handles", e.target.value)}
              />
              <p className="mt-1 text-[12px] text-stone-500">
                {handleCount} {handleCount === 1 ? "handle" : "handles"} · up to 500
              </p>
            </div>

            <div className="border-b border-stone-200 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 md:col-span-2">
              Filters
            </div>
            <MultiField id="au-states" label="States" options={options.states.map((s) => ({ value: s, label: s }))} value={d.states} onChange={(v) => set("states", v)} />
            <MultiField id="au-gender" label="Gender" options={GENDERS} value={d.genders} onChange={(v) => set("genders", v)} />
            <MultiField id="au-colleges" label="Colleges" options={options.colleges.map((s) => ({ value: s, label: s }))} value={d.colleges} onChange={(v) => set("colleges", v)} />
            <MultiField id="au-sports" label="Sports" options={options.sports.map((s) => ({ value: s, label: s }))} value={d.sports} onChange={(v) => set("sports", v)} />
            <div>
              <label htmlFor="au-min" className={labelCls}>
                Followers from
              </label>
              <input id="au-min" inputMode="numeric" className={inputCls} placeholder="0" value={d.min} onChange={(e) => set("min", e.target.value)} />
            </div>
            <div>
              <label htmlFor="au-max" className={labelCls}>
                Followers to
              </label>
              <input id="au-max" inputMode="numeric" className={inputCls} placeholder="No limit" value={d.max} onChange={(e) => set("max", e.target.value)} />
            </div>
            <div>
              <label htmlFor="au-rating" className={labelCls}>
                Minimum rating
              </label>
              <select id="au-rating" className={inputCls} value={d.rating} onChange={(e) => set("rating", e.target.value)}>
                <option value="">Any</option>
                {["1", "2", "3", "4"].map((r) => (
                  <option key={r} value={r}>
                    {r}+
                  </option>
                ))}
                <option value="5">5</option>
              </select>
            </div>
            <div className="hidden md:block" />

            <div className="border-b border-stone-200 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 md:col-span-2">
              Leave out
            </div>
            <div className="md:col-span-2">
              <label htmlFor="au-exclude" className={labelCls}>
                Exclude Instagram handles
              </label>
              <textarea
                id="au-exclude"
                rows={3}
                className={inputCls + " h-auto py-2"}
                placeholder="Athletes you do NOT want in this audience. Paste a column or a comma-separated list"
                value={d.exclude}
                onChange={(e) => set("exclude", e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <MultiField
                id="au-excamp"
                label="Exclude athletes selected in these campaigns"
                hint="Pick a campaign…"
                options={options.campaigns.map((c) => ({ value: c.id, label: c.label }))}
                value={d.excludeCampaigns}
                onChange={(v) => set("excludeCampaigns", v)}
              />
              <p className="mt-1 text-[12px] text-stone-500">Uses each campaign&apos;s recap roster.</p>
            </div>
          </div>
        </section>

        <div className={"lg:sticky lg:top-4 lg:self-start " + (isPending ? "opacity-60 transition-opacity" : "")} aria-busy={isPending}>
          {side}
        </div>
      </div>
    </form>
  );
}
