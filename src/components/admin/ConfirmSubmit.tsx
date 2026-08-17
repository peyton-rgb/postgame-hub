// ============================================================
// ConfirmSubmit — the confirmed-POST pattern for every admin write.
//
// CF fired money-moving writes on plain GET links. Here, every
// write is a <form action={serverAction}> POST, and this button
// interposes an explicit confirmation dialog (with a plain-English
// summary like "Mark $500.00 to Jane Doe as paid?") before the
// form is allowed to submit. No confirmation → no POST → no write.
// ============================================================

"use client";

import { useRef, useState } from "react";

export default function ConfirmSubmit({
  summary,
  confirmLabel = "Confirm",
  variant = "primary",
  disabled = false,
  children,
}: {
  /** Plain-English description of exactly what will happen. */
  summary: string;
  confirmLabel?: string;
  variant?: "primary" | "danger" | "quiet";
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const base =
    "rounded-md px-3 py-1.5 text-[13px] font-medium disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "danger"
      ? `${base} bg-red-600 text-white hover:bg-red-700`
      : variant === "quiet"
        ? `${base} border border-stone-300 text-stone-700 hover:border-stone-400`
        : `${base} bg-[#D73F09] text-white hover:bg-[#B33407]`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || busy}
        className={styles}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative w-full md:w-[420px] rounded-t-2xl md:rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-[15px] font-semibold text-stone-900">Please confirm</h2>
            <p className="mt-2 text-[13px] leading-5 text-stone-600">{summary}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  variant === "danger"
                    ? "rounded-md bg-red-600 px-3 py-1.5 text-[13px] font-medium text-white"
                    : "rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white"
                }
                onClick={() => {
                  setBusy(true);
                  setOpen(false);
                  // Submit the enclosing form as a real POST.
                  btnRef.current?.closest("form")?.requestSubmit();
                }}
              >
                {busy ? "Working…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
