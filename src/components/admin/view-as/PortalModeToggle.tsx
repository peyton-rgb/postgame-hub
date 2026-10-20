// ============================================================
// PortalModeToggle — "Postgame view | Brand view" on the brand portal
// preview. Postgame view keeps the admin shell plus a staff panel;
// Brand view shows the portal full-screen exactly as the brand's
// employees see it. Remembered in a cookie the server layout reads.
// ============================================================

"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export type PortalMode = "postgame" | "brand";
export const PORTAL_MODE_COOKIE = "admin_portal_mode";

export default function PortalModeToggle({ mode, floating = false }: { mode: PortalMode; floating?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(next: PortalMode) {
    if (next === mode) return;
    try {
      document.cookie = `${PORTAL_MODE_COOKIE}=${next}; path=/admin; max-age=31536000; samesite=lax`;
    } catch {
      /* blocked cookies: nothing to remember */
    }
    start(() => router.refresh());
  }

  const btn = (v: PortalMode, label: string) => (
    <button
      type="button"
      onClick={() => choose(v)}
      aria-pressed={mode === v}
      disabled={pending}
      className={
        "rounded-md px-3 py-1 text-[12px] font-medium transition-colors " +
        (mode === v
          ? floating
            ? "bg-white text-stone-900"
            : "bg-white text-stone-900 shadow-sm"
          : floating
            ? "text-white/70 hover:text-white"
            : "text-stone-500 hover:text-stone-900")
      }
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label="Portal view"
      className={
        "inline-flex shrink-0 gap-0.5 rounded-lg p-0.5 " +
        (floating ? "bg-[#16181D] shadow-lg ring-1 ring-white/10" : "bg-white/60 ring-1 ring-stone-200")
      }
    >
      {btn("postgame", "Postgame view")}
      {btn("brand", "Brand view")}
    </div>
  );
}
