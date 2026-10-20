// ============================================================
// Opt-ins tab: the pick-and-select form. Rows render "+ Select"
// toggles (checkboxes) inside this form; the footer counts picks and
// posts them to the selectAthletes server action, with or without
// the in-app notification. Nothing is written until a footer button
// is pressed.
// ============================================================

"use client";

import { useRef, useState } from "react";

export default function SelectOptinsForm({
  campaignId,
  action,
  children,
}: {
  campaignId: number;
  action: (formData: FormData) => Promise<void> | void;
  children: React.ReactNode;
}) {
  const [picked, setPicked] = useState(0);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const recount = () => {
    const form = formRef.current;
    if (!form) return;
    const ids = new Set<string>();
    form.querySelectorAll<HTMLInputElement>('input[name="opt_in_id"]:checked').forEach((el) => ids.add(el.value));
    setPicked(ids.size);
  };

  const clear = () => {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[name="opt_in_id"]').forEach((el) => (el.checked = false));
    setPicked(0);
  };

  return (
    <form ref={formRef} action={action} onChange={recount} onSubmit={() => setBusy(true)}>
      <input type="hidden" name="campaign_id" value={campaignId} />
      {children}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-4 py-2.5 text-[13px] text-stone-600 md:px-5">
        {picked > 0 ? (
          <>
            <span>
              <b className="text-stone-900">{picked}</b> picked · not saved or sent yet
            </span>
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={clear}
                className="rounded-md px-2.5 py-1 text-[12px] font-medium text-stone-600 hover:bg-stone-100"
              >
                Clear
              </button>
              <button
                type="submit"
                name="notify"
                value="0"
                disabled={busy}
                className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 hover:border-stone-400 disabled:opacity-50"
              >
                Select {picked} quietly
              </button>
              <button
                type="submit"
                name="notify"
                value="1"
                disabled={busy}
                className="rounded-md bg-[#D73F09] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#B33407] disabled:opacity-50"
              >
                {busy ? "Working…" : `Select & notify ${picked}`}
              </button>
            </span>
          </>
        ) : (
          <span>Tick athletes to select them. They&apos;re told in the app and sign the contract there.</span>
        )}
      </div>
    </form>
  );
}

/** The per-row "+ Select" toggle (a styled checkbox). */
export function PickToggle({ id }: { id: number }) {
  return (
    <label className="inline-flex cursor-pointer select-none">
      <input type="checkbox" name="opt_in_id" value={id} className="peer sr-only" />
      <span className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-medium text-stone-700 peer-checked:hidden">
        + Select
      </span>
      <span className="hidden rounded-md bg-[#D73F09] px-2.5 py-1 text-[12px] font-medium text-white peer-checked:inline">
        ✓ Picked
      </span>
    </label>
  );
}
