// ============================================================
// AdminShell — the /admin chrome. Internal admin theme:
// white background, system fonts, orange #D73F09 sole accent,
// warm neutral grays. Dark left sidebar (desktop) with the REAL
// Postgame wordmark (brands.logo_light_url — never typed text).
// Mobile: bottom tab bar (never a hamburger) + "More" sheet.
// ============================================================

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
/* eslint-disable @next/next/no-img-element */
import type { AdminNavGroup, AdminNavItem } from "@/lib/admin/nav";
import type { AccessLevel } from "@/lib/admin/auth";

const RANK: Record<AccessLevel, number> = { exec: 3, admin: 2, staff: 1, athlete: 0 };

function visible(min: AccessLevel | undefined, level: AccessLevel): boolean {
  return RANK[level] >= RANK[min ?? "staff"];
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AdminShell({
  nav,
  tabs,
  logoUrl,
  userLabel,
  accessLevel,
  accessLevelPending,
  children,
}: {
  nav: AdminNavGroup[];
  tabs: AdminNavItem[];
  logoUrl: string | null;
  userLabel: string;
  accessLevel: AccessLevel;
  accessLevelPending: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const [moreOpen, setMoreOpen] = useState(false);

  const groups = nav
    .filter((g) => visible(g.min, accessLevel))
    .map((g) => ({ ...g, items: g.items.filter((i) => visible(i.min, accessLevel)) }))
    .filter((g) => g.items.length > 0);

  const tabItems = tabs.filter((t) => visible(t.min, accessLevel));

  return (
    <div className="min-h-screen bg-white text-stone-900 font-sans">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-stone-950 text-stone-300 overflow-y-auto">
        <div className="px-5 pt-6 pb-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Postgame" className="h-7 w-auto" />
          ) : (
            // Logo row loads from the brands table; if unavailable we show
            // nothing rather than typing the wordmark (standing brand rule).
            <div className="h-7" aria-label="Postgame" />
          )}
          <div className="mt-2 text-[11px] uppercase tracking-widest text-stone-500">
            Admin
          </div>
        </div>
        <nav className="flex-1 px-3 pb-6 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                {group.label}
              </div>
              <ul>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={
                          "block rounded-md px-2 py-1.5 text-[13px] leading-5 " +
                          (active
                            ? "bg-stone-800 text-white font-medium border-l-2 border-[#D73F09] pl-[6px]"
                            : "text-stone-400 hover:text-white hover:bg-stone-900")
                        }
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-stone-800 text-[12px] text-stone-500">
          <div className="truncate text-stone-400">{userLabel}</div>
          <div className="mt-0.5 capitalize">
            {accessLevel}
            {accessLevelPending && (
              <span
                className="ml-1 text-amber-500"
                title="Access levels run on the legacy role column until migration 022 is applied."
              >
                · pending 022
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="md:pl-60 pb-20 md:pb-0">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>

      {/* Mobile bottom tab bar — never a hamburger */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-stone-950 text-stone-400 border-t border-stone-800 flex">
        {tabItems.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={
                "flex-1 py-3 text-center text-[11px] font-medium " +
                (active ? "text-[#FF6A3D]" : "text-stone-400")
              }
            >
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex-1 py-3 text-center text-[11px] font-medium text-stone-400"
        >
          More
        </button>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMoreOpen(false)}
            aria-hidden
          />
          <div className="absolute bottom-0 inset-x-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-stone-950 text-stone-300 p-5 pb-8">
            <div className="flex items-center justify-between pb-3">
              <span className="text-[11px] uppercase tracking-widest text-stone-500">
                All screens
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-stone-400 text-sm px-2 py-1"
              >
                Close
              </button>
            </div>
            {groups.map((group) => (
              <div key={group.label} className="pb-4">
                <div className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                  {group.label}
                </div>
                <ul className="grid grid-cols-2 gap-1">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className="block rounded-md px-2 py-2 text-[13px] text-stone-300 bg-stone-900"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
