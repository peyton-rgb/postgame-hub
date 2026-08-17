// ============================================================
// FilterPopover — the locked filter pattern: a Filter button opens
// a popover (hidden by default; outside-click dismisses when
// nothing changed), Apply commits → filters land in the URL as
// query params (server does the filtering) → active filters render
// as chips + a count badge on the button.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface FilterField {
  key: string;
  label: string;
  type: "text" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export default function FilterPopover({ fields }: { fields: FilterField[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement>(null);

  // Seed the draft from the URL each time the popover opens.
  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const f of fields) next[f.key] = search?.get(f.key) ?? "";
    setDraft(next);
  }, [open, fields, search]);

  // Outside click dismisses.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const active = fields.filter((f) => (search?.get(f.key) ?? "") !== "");

  function apply() {
    const q = new URLSearchParams(search?.toString() ?? "");
    for (const f of fields) {
      const v = (draft[f.key] ?? "").trim();
      if (v) q.set(f.key, v);
      else q.delete(f.key);
    }
    q.delete("page"); // new filters restart at page 1
    setOpen(false);
    router.push(q.toString() ? `${pathname}?${q}` : pathname);
  }

  function clearOne(key: string) {
    const q = new URLSearchParams(search?.toString() ?? "");
    q.delete(key);
    q.delete("page");
    router.push(q.toString() ? `${pathname}?${q}` : pathname);
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
        >
          Filter
          {active.length > 0 && (
            <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#D73F09] px-1 text-[11px] font-semibold text-white">
              {active.length}
            </span>
          )}
        </button>
        {active.map((f) => (
          <span
            key={f.key}
            className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[12px] text-stone-700"
          >
            {f.label}:{" "}
            {f.type === "select"
              ? (f.options?.find((o) => o.value === search?.get(f.key))?.label ??
                search?.get(f.key))
              : f.type === "checkbox"
                ? "yes"
                : search?.get(f.key)}
            <button
              type="button"
              aria-label={`Clear ${f.label}`}
              className="text-stone-400 hover:text-stone-700"
              onClick={() => clearOne(f.key)}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {open && (
        <div
          ref={boxRef}
          className="absolute left-0 z-30 mt-2 w-[300px] rounded-lg border border-stone-200 bg-white p-4 shadow-lg"
        >
          <div className="space-y-3">
            {fields.map((f) => (
              <label key={f.key} className="block text-[12px] font-medium text-stone-600">
                {f.type !== "checkbox" && <span>{f.label}</span>}
                {f.type === "text" && (
                  <input
                    type="text"
                    value={draft[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900"
                  />
                )}
                {f.type === "select" && (
                  <select
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    className="mt-1 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-[13px] text-stone-900"
                  >
                    <option value="">Any</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
                {f.type === "checkbox" && (
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(draft[f.key] ?? "") === "1"}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.checked ? "1" : "" })}
                    />
                    <span>{f.label}</span>
                  </span>
                )}
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white"
              onClick={apply}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
