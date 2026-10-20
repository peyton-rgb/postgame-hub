// ============================================================
// "More ▾" dropdown on the campaign header. Client-side only for the
// open/close state; every item is a plain link to a real screen.
// ============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface MenuItem {
  label: string;
  href: string;
  external?: boolean;
}

export interface MenuGroup {
  heading?: string;
  items: MenuItem[];
}

export default function MoreMenu({ groups, label = "More ▾" }: { groups: MenuGroup[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-[13px] font-medium text-stone-700 hover:border-stone-400"
      >
        {label}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-20 grid min-w-[220px] rounded-lg border border-stone-200 bg-white p-1.5 shadow-lg"
        >
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.heading && (
                <div className="px-2.5 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  {g.heading}
                </div>
              )}
              {g.items.map((it) =>
                it.external ? (
                  <a
                    key={it.href + it.label}
                    href={it.href}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className="block rounded-md px-2.5 py-2 text-[13px] text-stone-800 hover:bg-stone-100"
                    onClick={() => setOpen(false)}
                  >
                    {it.label}
                  </a>
                ) : (
                  <Link
                    key={it.href + it.label}
                    href={it.href}
                    role="menuitem"
                    className="block rounded-md px-2.5 py-2 text-[13px] text-stone-800 hover:bg-stone-100"
                    onClick={() => setOpen(false)}
                  >
                    {it.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
