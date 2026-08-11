// src/components/submission-forms/DeliverablesField.tsx
// ─────────────────────────────────────────────────────────────
// Deliverables: a toggle plus a number, because the honest value is often
// "unstated". Some athletes negotiate their deliverables up or down from the
// campaign standard, and one number on a form the whole roster shares is
// then wrong for them.
//
// A plain number field cannot express this: 0 renders "This covers 0 posts"
// on the athlete page, which is worse than silence. Off means null, and the
// athlete page omits the line entirely.
//
// Off is the default, which reproduces every row that exists today.
// ─────────────────────────────────────────────────────────────

"use client";

import Toggle from "./Toggle";

export default function DeliverablesField({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  const on = value != null;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors ${
        on ? "border-[rgba(215,63,9,0.40)] bg-[rgba(215,63,9,0.06)]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-3">
        <Toggle
          on={on}
          // Toggling off clears the number rather than stashing it: the parent
          // must never hold a deliverables count while the toggle reads off.
          onChange={(next) => onChange(next ? 1 : null)}
          label="State deliverables on the form"
          disabled={disabled}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white">State deliverables on the form</div>
          {!on && <div className="text-[11px] text-white/35 mt-0.5">Off when athletes negotiate their own</div>}
        </div>
        {on && (
          <input
            type="number"
            min={1}
            max={99}
            value={value}
            disabled={disabled}
            aria-label="Number of posts"
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              // Empty or junk holds at 1 — the toggle, not the input, is how
              // you get back to null.
              onChange(Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1);
            }}
            className="w-16 flex-shrink-0 bg-white/5 border border-[rgba(215,63,9,0.40)] rounded-lg px-2 py-2 text-sm text-white text-center outline-none focus:border-[#D73F09]/70 disabled:opacity-50"
          />
        )}
      </div>
    </div>
  );
}
