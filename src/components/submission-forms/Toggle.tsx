// src/components/submission-forms/Toggle.tsx
// ─────────────────────────────────────────────────────────────
// The switch used by DeliverablesField and ExpiryControl. Both need the
// identical thing, so it lives here rather than twice.
//
// The knob is the accent, never the track — #D73F09 is reserved for one
// emphatic element per surface and that is already the Save button.
// ─────────────────────────────────────────────────────────────

"use client";

export default function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  // Read by screen readers; the visible label is the caller's business.
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`w-9 h-5 rounded-full border flex items-center px-0.5 flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        on ? "bg-[#D73F09]/20 border-[#D73F09]/50" : "bg-white/5 border-white/15"
      }`}
    >
      <span
        className={`w-4 h-4 rounded-full transition-transform ${
          on ? "translate-x-4 bg-[#D73F09]" : "translate-x-0 bg-white/40"
        }`}
      />
    </button>
  );
}
