"use client";

// A <select> inside a GET form that submits the form when it changes, so
// server-rendered list pages get working filters without a client state
// layer. Without JavaScript it is still a normal select; the form's
// Enter-to-submit on the search box applies it.

export default function AutoSubmitSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name={name}
      aria-label={label}
      defaultValue={value}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
      className="max-w-[200px] rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-[13px] text-stone-700"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
