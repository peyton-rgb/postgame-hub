"use client";

// The live editor's chrome, reused so the builder reads as the same tool:
// section headings are text-lg font-black uppercase tracking-wide, cards are
// rounded-xl border p-4, the accent is #D73F09.
import type { ReactNode } from "react";

export function BuilderSection({
  title,
  hint,
  right,
  children,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-800 bg-[#0a0a0a] p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black uppercase tracking-wide">{title}</h3>
          {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
}) {
  const cls =
    "w-full rounded-lg border border-gray-800 bg-black px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-[#D73F09]";
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
      {hint ? <span className="mt-1 block text-[11px] text-gray-600">{hint}</span> : null}
    </label>
  );
}

/** The editor's on/off pill. */
export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
        on
          ? "border-[#D73F09] bg-[#D73F09]/15 text-[#D73F09]"
          : "border-gray-700 text-gray-500 hover:border-gray-500"
      }`}
    >
      {label}
    </button>
  );
}

/** Move an item within an ordered list. Used by sections and by content. */
export function ReorderButtons({
  index,
  length,
  onMove,
}: {
  index: number;
  length: number;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <span className="flex gap-1">
      <button
        type="button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label="Move up"
        className="rounded border border-gray-700 px-1.5 text-xs text-gray-400 disabled:opacity-25"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === length - 1}
        aria-label="Move down"
        className="rounded border border-gray-700 px-1.5 text-xs text-gray-400 disabled:opacity-25"
      >
        ↓
      </button>
    </span>
  );
}
