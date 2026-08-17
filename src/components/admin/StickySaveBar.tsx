// ============================================================
// StickySaveBar + AdminForm — the CF-style edit form pattern:
// grouped cards in CF field order, a sticky bar pinned to the
// bottom with an unsaved-changes state, and a confirmed POST on
// save (server action; the bar's Save asks for confirmation).
//
// AdminForm watches its own inputs; any change flips the bar to
// "Unsaved changes". Save opens the confirm dialog, then submits
// the form (a real POST to the server action).
// ============================================================

"use client";

import { useRef, useState } from "react";

export default function AdminForm({
  action,
  confirmSummary,
  children,
  saveLabel = "Save changes",
}: {
  action: (formData: FormData) => Promise<void> | void;
  confirmSummary: string;
  children: React.ReactNode;
  saveLabel?: string;
}) {
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      onChange={() => setDirty(true)}
      onSubmit={() => {
        setSaving(true);
        setDirty(false);
      }}
      className="pb-24"
    >
      {children}

      {/* Sticky save bar */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-60 z-30 border-t border-stone-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 md:px-4">
          <span
            className={
              "text-[13px] " + (dirty ? "font-medium text-amber-700" : "text-stone-400")
            }
          >
            {saving ? "Saving…" : dirty ? "Unsaved changes" : "No changes"}
          </span>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => setConfirming(true)}
            className="rounded-md bg-[#D73F09] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {saveLabel}
          </button>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirming(false)}
            aria-hidden
          />
          <div className="relative w-full md:w-[420px] rounded-t-2xl md:rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-[15px] font-semibold text-stone-900">Save changes?</h2>
            <p className="mt-2 text-[13px] leading-5 text-stone-600">{confirmSummary}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-[13px] text-stone-700"
                onClick={() => setConfirming(false)}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[13px] font-medium text-white"
                onClick={() => {
                  setConfirming(false);
                  formRef.current?.requestSubmit();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

/** A grouped card of fields, in CF field order. */
export function FieldCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
      <h2 className="pb-3 text-[13px] font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  span2 = false,
  options,
  readOnly = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: "text" | "url" | "email" | "textarea" | "select" | "date" | "number";
  placeholder?: string;
  span2?: boolean;
  options?: { value: string; label: string }[];
  readOnly?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-md border border-stone-300 px-2.5 py-1.5 text-[13px] text-stone-900 read-only:bg-stone-50 read-only:text-stone-500";
  return (
    <label className={"block text-[12px] font-medium text-stone-600 " + (span2 ? "md:col-span-2" : "")}>
      {label}
      {type === "textarea" ? (
        <textarea
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          readOnly={readOnly}
          rows={3}
          className={cls}
        />
      ) : type === "select" ? (
        <select name={name} defaultValue={defaultValue ?? ""} className={cls} disabled={readOnly}>
          {(options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          readOnly={readOnly}
          className={cls}
        />
      )}
    </label>
  );
}
