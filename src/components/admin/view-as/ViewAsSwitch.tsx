// ============================================================
// View as — the prototype's viewAsCtl(): a segmented Staff / Brand
// employee / Athlete switch, plus a brand or athlete select when one
// of those is on. Switching navigates:
//   Staff           → /admin (Workspace)
//   Brand employee  → /admin/view-as/brand/<id>      (dashboard)
//   Athlete         → /admin/view-as/athlete/<id>    (home)
// The page underneath is the brand portal / athlete app, rendered
// inside the admin shell. Client-only: takes plain option lists.
// ============================================================

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import type { PickOption, ViewMode } from "@/lib/admin/view-as/types";

const MODES: [ViewMode, string][] = [
  ["staff", "Staff"],
  ["brand", "Brand employee"],
  ["athlete", "Athlete"],
];

export default function ViewAsSwitch({
  mode,
  brands,
  athletes,
  brandId,
  athleteId,
}: {
  mode: ViewMode;
  brands: PickOption[];
  athletes: PickOption[];
  brandId?: string | null;
  athleteId?: string | null;
}) {
  const router = useRouter();
  // Keep the current section (e.g. /reports) when switching brand or
  // athlete, but drop item ids that belong to the old one.
  const pathname = usePathname() ?? "";
  const section = pathname.match(/^\/admin\/view-as\/(?:brand|athlete)\/[^/]+(\/[^/]+)?/)?.[1] ?? "";
  const subPath = section;
  const [pending, start] = useTransition();
  const go = (href: string) => start(() => router.push(href));

  const pick = (m: ViewMode) => {
    if (m === mode) return;
    if (m === "staff") return go("/admin");
    if (m === "brand") return go(brandId || brands[0] ? `/admin/view-as/brand/${brandId || brands[0].id}` : "/admin/brand-portals");
    return go(athleteId || athletes[0] ? `/admin/view-as/athlete/${athleteId || athletes[0].id}` : "/admin/view-as/athlete");
  };

  const selectCls =
    "h-[30px] max-w-[200px] rounded-lg border border-[#E3E5E9] bg-white pl-2 pr-7 text-[12px] text-stone-900 disabled:opacity-60";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" aria-busy={pending}>
      <span className="text-[12px] text-stone-500">View as</span>
      <div role="group" aria-label="View as" className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg bg-[#F1F2F4] p-[3px]">
        {MODES.map(([k, l]) => (
          <button
            key={k}
            type="button"
            aria-pressed={mode === k}
            disabled={pending}
            onClick={() => pick(k)}
            className={
              "rounded-md px-2.5 py-1 text-[12px] font-medium " +
              (mode === k ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900")
            }
          >
            {l}
          </button>
        ))}
      </div>
      {mode === "brand" && brands.length > 0 && (
        <select
          aria-label="Which brand"
          className={selectCls}
          value={brandId ?? ""}
          disabled={pending}
          onChange={(e) => go(`/admin/view-as/brand/${e.target.value}${subPath}`)}
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      )}
      {mode === "athlete" && athletes.length > 0 && (
        <select
          aria-label="Which athlete"
          className={selectCls}
          value={athleteId ?? ""}
          disabled={pending}
          onChange={(e) => go(`/admin/view-as/athlete/${e.target.value}${subPath}`)}
        >
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
