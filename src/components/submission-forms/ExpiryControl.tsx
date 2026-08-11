// src/components/submission-forms/ExpiryControl.tsx
// ─────────────────────────────────────────────────────────────
// Link expiry: three presets, or a specific date.
//
// The two are mutually exclusive on purpose. With both live, "60 days" and a
// picked date can disagree about what the value is, and the operator has no
// way to tell which one won. When the custom toggle is on the chips dim and
// stop responding — one source sets the value at a time.
//
// The date input is the native one: it brings the OS calendar with no
// dependency. It needs color-scheme: dark or the popup renders as a white
// panel against the dark UI. Its min is tomorrow, because the API rejects a
// past date with a 400 and unpickable beats pick-then-error.
// ─────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import Toggle from "./Toggle";

const PRESETS: (number | null)[] = [30, 60, null];

// The date input speaks local YYYY-MM-DD. Going through toISOString() here
// would shift the day either side of UTC midnight.
function toDateValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// "Expires on the 20th" means the end of the 20th, not the instant it began —
// midnight would kill the link the evening before, to the operator's surprise.
function endOfLocalDay(dateValue: string): string | null {
  const [y, m, day] = dateValue.split("-").map(Number);
  if (!y || !m || !day) return null;
  const d = new Date(y, m - 1, day, 23, 59, 59, 999);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ExpiryControl({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  // A saved expiry is shown as the specific date it is. Presets are computed
  // from "now", so a loaded value would never match one anyway, and claiming
  // "60 days" for a date set weeks ago would be a lie.
  const [custom, setCustom] = useState(() => value != null);
  const [presetDays, setPresetDays] = useState<number | null>(null);

  const dateValue = custom && value ? toDateValue(new Date(value)) : "";
  const minDate = toDateValue(addDays(1));

  const pickPreset = (days: number | null) => {
    if (custom || disabled) return; // chips are inert while custom is on
    setPresetDays(days);
    onChange(days == null ? null : addDays(days).toISOString());
  };

  const toggleCustom = (next: boolean) => {
    setCustom(next);
    if (next) {
      // Land on a valid date immediately rather than an on-but-unset state.
      if (!value) onChange(endOfLocalDay(minDate));
    } else {
      setPresetDays(null);
      onChange(null);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map((days) => {
          const active = !custom && presetDays === days;
          return (
            <button
              key={String(days)}
              type="button"
              onClick={() => pickPreset(days)}
              disabled={disabled}
              aria-disabled={custom}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                custom
                  ? "border-white/10 bg-white/[0.02] text-[rgba(255,255,255,0.25)] cursor-not-allowed"
                  : active
                    ? "border-[#D73F09]/50 bg-[#D73F09]/10 text-white"
                    : "border-white/10 bg-white/5 text-white/55 hover:text-white/80"
              }`}
            >
              {days == null ? "Never" : `${days} days`}
            </button>
          );
        })}
        {!custom && (
          // A preset is only meaningful if you can see what date it lands on.
          <span className="ml-auto text-xs text-white/40 flex-shrink-0">
            {value ? fmtDate(value) : "No expiry"}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Toggle on={custom} onChange={toggleCustom} label="Set a specific date" disabled={disabled} />
        <span className="text-sm text-white/70 flex-1 min-w-0">Set a specific date</span>
        {custom && (
          <input
            type="date"
            value={dateValue}
            min={minDate}
            disabled={disabled}
            aria-label="Expiry date"
            onChange={(e) => onChange(e.target.value ? endOfLocalDay(e.target.value) : null)}
            style={{ colorScheme: "dark" }}
            className="flex-shrink-0 bg-white/5 border border-[#D73F09]/40 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#D73F09]/70 disabled:opacity-50"
          />
        )}
      </div>
    </div>
  );
}
