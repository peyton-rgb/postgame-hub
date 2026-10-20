// ============================================================
// ViewToggle — the Rows | Cards switch shown on every admin list.
// Writes a per-list cookie (so the page remembers) and puts ?view= in
// the URL (so the server renders the right layout and links share it).
// Server pages read it with getListView() from @/lib/admin/list-view.
// ============================================================

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ListView = "rows" | "cards";

function cookieName(listKey: string) {
  return `admin_view_${listKey.replace(/[^a-z0-9_-]/gi, "_")}`;
}

function RowsIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" strokeLinecap="round" />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

export default function ViewToggle({ listKey, view }: { listKey: string; view: ListView }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function choose(next: ListView) {
    if (next === view) return;
    try {
      document.cookie = `${cookieName(listKey)}=${next}; path=/admin; max-age=31536000; samesite=lax`;
    } catch {
      /* cookies blocked: the URL still carries the choice */
    }
    const p = new URLSearchParams(params?.toString() ?? "");
    p.set("view", next);
    router.push(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const btn = (v: ListView, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => choose(v)}
      aria-pressed={view === v}
      title={`Show as ${label.toLowerCase()}`}
      className={
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors " +
        (view === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900")
      }
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div role="group" aria-label="Layout" className="inline-flex shrink-0 gap-0.5 rounded-lg bg-stone-100 p-0.5">
      {btn("rows", "Rows", <RowsIcon />)}
      {btn("cards", "Cards", <CardsIcon />)}
    </div>
  );
}
