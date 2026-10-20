// ============================================================
// "Viewing as" select on the Workspace — switching a person reloads
// the page with ?as=<profile id>, keeping the other query params.
// ============================================================

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export default function ViewAsSelect({
  options,
  value,
  params,
}: {
  options: { id: string; label: string }[];
  value: string;
  /** the other query params to keep (scope, sort, q) */
  params: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <select
      aria-label="Viewing as"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
        q.set("as", e.target.value);
        start(() => router.push(`/admin?${q.toString()}`));
      }}
      className="h-[34px] max-w-[220px] rounded-lg border border-[#E3E5E9] bg-white pl-2.5 pr-7 text-[13px] text-stone-900 disabled:opacity-60"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
