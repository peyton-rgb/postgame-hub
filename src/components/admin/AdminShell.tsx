// ============================================================
// AdminShell — the /admin chrome, matching the approved Hub admin
// prototype: dark left sidebar (#111318) with the REAL Postgame
// wordmark (brands.logo_light_url — never typed text), two top-level
// links, collapsible groups with chevrons (open state in localStorage,
// the active group always open), a badge on Workspace, and a footer
// (Settings · Log out · "email · level"). White top bar: global search
// (⌘K focuses it, submits to /admin/campaigns?q=), spacer, bell →
// /admin/notifications.
//
// Mobile (<768px): sidebar hidden, bottom tab bar (never a hamburger)
// + "More" sheet with the full map.
// ============================================================

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
/* eslint-disable @next/next/no-img-element */
import type { AdminNavGroup, AdminNavItem } from "@/lib/admin/nav";
import { ADMIN_FOOT } from "@/lib/admin/nav";
import type { AccessLevel } from "@/lib/admin/auth";
import { createBrowserSupabase } from "@/lib/supabase";
import NavIcon from "./NavIcon";

const RANK: Record<AccessLevel, number> = { exec: 3, admin: 2, staff: 1, athlete: 0, brand: 0 };
const NAV_STATE_KEY = "hub-admin-nav-v1";

function visible(min: AccessLevel | undefined, level: AccessLevel): boolean {
  return RANK[level] >= RANK[min ?? "staff"];
}

function matches(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

const LEVEL_LABEL: Record<AccessLevel, string> = {
  exec: "Exec",
  admin: "Admin",
  staff: "Staff",
  athlete: "Athlete",
  brand: "Brand",
};

export default function AdminShell({
  nav,
  tabs,
  logoUrl,
  userLabel,
  accessLevel,
  accessLevelPending,
  openCampaigns = null,
  children,
}: {
  nav: AdminNavGroup[];
  tabs: AdminNavItem[];
  logoUrl: string | null;
  userLabel: string;
  accessLevel: AccessLevel;
  accessLevelPending: boolean;
  /** count of open campaigns for the Workspace badge; null = unknown */
  openCampaigns?: number | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const [moreOpen, setMoreOpen] = useState(false);
  const [navOpen, setNavOpen] = useState<Record<string, boolean>>({});
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Collapsed-group memory. Read after mount so the server and first
  // client paint agree (everything open), then apply the saved state.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_STATE_KEY);
      if (raw) setNavOpen(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* private mode / blocked storage: groups just stay open */
    }
  }, []);

  // ⌘K / Ctrl+K focuses the global search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(
    () =>
      nav
        .filter((g) => visible(g.min, accessLevel))
        .map((g) => ({ ...g, items: g.items.filter((i) => visible(i.min, accessLevel)) }))
        .filter((g) => g.items.length > 0),
    [nav, accessLevel]
  );

  // Longest matching href wins, so /admin/pay/vendor lights "Invoices",
  // not "Payments overview".
  const activeHref = useMemo(() => {
    let best = "";
    for (const g of groups)
      for (const i of g.items)
        if (!i.soon && matches(pathname, i.href) && i.href.length > best.length) best = i.href;
    for (const f of ADMIN_FOOT)
      if (!f.soon && matches(pathname, f.href) && f.href.length > best.length) best = f.href;
    return best;
  }, [groups, pathname]);

  const tabItems = tabs.filter((t) => visible(t.min, accessLevel));
  const activeTab = useMemo(() => {
    let best = "";
    for (const t of tabItems) if (matches(pathname, t.href) && t.href.length > best.length) best = t.href;
    return best;
  }, [tabItems, pathname]);

  const toggleGroup = (label: string, open: boolean) => {
    const next = { ...navOpen, [label]: open };
    setNavOpen(next);
    try {
      localStorage.setItem(NAV_STATE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await createBrowserSupabase().auth.signOut();
    } finally {
      window.location.href = "/login";
    }
  };

  const badgeFor = (item: AdminNavItem) =>
    item.href === "/admin" && openCampaigns != null && openCampaigns > 0 ? openCampaigns : null;

  const whoLine = `${userLabel} · ${LEVEL_LABEL[accessLevel]}`;

  // ---- one nav link (desktop sidebar + More sheet share the look) ----
  const NavLink = ({ item, nested = false }: { item: AdminNavItem; nested?: boolean }) => {
    const base =
      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[14px] leading-5 " +
      (nested ? "pl-[22px] font-normal " : "font-medium ");
    if (item.soon) {
      return (
        <span
          title="Not built in the Hub yet"
          className={base + "cursor-default text-[#5B606B]"}
        >
          <NavIcon name={item.icon} size={nested ? 15 : 16} className={nested ? "opacity-70" : ""} />
          <span className="truncate">{item.label}</span>
          <span className="ml-auto text-[10px] uppercase tracking-wider text-[#4A4F59]">soon</span>
        </span>
      );
    }
    const active = item.href === activeHref;
    const badge = badgeFor(item);
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={() => setMoreOpen(false)}
        className={
          base +
          (active
            ? "bg-[#22262E] text-white shadow-[inset_2px_0_0_#D73F09]"
            : "text-[#B4B9C2] hover:bg-[#1B1E25] hover:text-[#EEF0F3]")
        }
      >
        <NavIcon name={item.icon} size={nested ? 15 : 16} className={nested ? "opacity-80" : ""} />
        <span className="truncate">{item.label}</span>
        {badge != null && (
          <span className="ml-auto rounded-full bg-[#D73F09] px-[7px] text-[12px] font-semibold leading-5 text-white tabular-nums">
            {badge.toLocaleString("en-US")}
          </span>
        )}
      </Link>
    );
  };

  const renderGroups = (compact: boolean) =>
    groups.map((group, gi) => {
      if (!group.label) {
        return (
          <div key={`top-${gi}`} className="flex flex-col gap-px">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        );
      }
      const hasActive = group.items.some((i) => i.href === activeHref);
      const open = hasActive || navOpen[group.label] !== false;
      const bodyId = `admin-nav-${compact ? "m" : "d"}-${gi}`;
      return (
        <div key={group.label}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => toggleGroup(group.label, !open)}
            className={
              "mt-1.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[12px] font-semibold hover:bg-[#1B1E25] " +
              (hasActive ? "text-[#EEF0F3]" : "text-[#747A85] hover:text-[#EEF0F3]")
            }
          >
            <span>{group.label}</span>
            {group.isNew && <span className="text-[12px] font-medium text-[#FDBA74]">New</span>}
            <NavIcon
              name="chev"
              size={16}
              className={"ml-auto transition-transform " + (open ? "rotate-180" : "")}
            />
          </button>
          <div id={bodyId} hidden={!open} className="flex flex-col gap-px pb-1 pt-px">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} nested />
            ))}
          </div>
        </div>
      );
    });

  const footer = (
    <div className="flex flex-col gap-px border-t border-[#22262E] p-2">
      {ADMIN_FOOT.map((item) => (
        <NavLink key={item.href} item={item} />
      ))}
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[14px] font-medium text-[#B4B9C2] hover:bg-[#1B1E25] hover:text-[#EEF0F3] disabled:opacity-60"
      >
        <NavIcon name="out" />
        {signingOut ? "Logging out…" : "Log out"}
      </button>
      <div className="truncate px-2.5 pb-0.5 pt-2 text-[12px] text-[#747A85]" title={whoLine}>
        {whoLine}
        {accessLevelPending && (
          <span
            className="ml-1 text-status-warn"
            title="Access levels run on the legacy role column until migration 022 is applied."
          >
            · pending 022
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-stone-900 font-sans">
      {/* Desktop sidebar */}
      <aside
        aria-label="Admin menu"
        className="hidden md:flex fixed inset-y-0 left-0 z-50 w-60 flex-col bg-[#111318] text-[#B4B9C2]"
      >
        <div className="flex h-[60px] shrink-0 items-center border-b border-[#22262E] px-[18px]">
          <Link href="/admin" aria-label="Workspace" className="flex items-center">
            {logoUrl ? (
              <img src={logoUrl} alt="Postgame" className="h-[22px] w-auto" />
            ) : (
              // Logo loads from the brands table; if unavailable we show
              // nothing rather than typing the wordmark (standing brand rule).
              <span className="block h-[22px]" />
            )}
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2.5 [scrollbar-width:thin]">{renderGroups(false)}</nav>
        {footer}
      </aside>

      {/* Top bar + content */}
      <div className="md:pl-60">
        <header className="sticky top-0 z-40 flex h-[60px] items-center gap-2 border-b border-[#E3E5E9] bg-white px-4 md:gap-3 md:px-7">
          <form
            action="/admin/campaigns"
            method="get"
            role="search"
            className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#E3E5E9] bg-[#F1F2F4] px-3 text-stone-500 md:max-w-[520px]"
          >
            <NavIcon name="search" />
            <input
              ref={searchRef}
              type="search"
              name="q"
              placeholder="Search athletes, brands, campaigns…"
              aria-label="Search"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-stone-900 outline-none placeholder:text-stone-500"
            />
            <kbd className="hidden rounded-[5px] border border-[#E3E5E9] bg-white px-1.5 text-[12px] font-sans text-stone-500 md:inline">
              ⌘K
            </kbd>
          </form>
          <span className="flex-1" />
          <Link
            href="/admin/notifications"
            aria-label="Notifications"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-[#F1F2F4] hover:text-stone-900"
          >
            <NavIcon name="bell" size={20} />
          </Link>
        </header>

        <main className="pb-24 md:pb-0">
          <div className="px-4 py-5 md:px-7 md:py-6">{children}</div>
        </main>
      </div>

      {/* Mobile bottom tab bar — never a hamburger */}
      <nav
        aria-label="Admin tabs"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex border-t border-[#22262E] bg-[#111318] text-[#B4B9C2]"
      >
        {tabItems.map((tab) => {
          const active = tab.href === activeTab;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-center text-[11px] font-medium " +
                (active ? "text-[#FF6A3D]" : "text-[#B4B9C2]")
              }
            >
              <NavIcon name={tab.icon} size={18} />
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={moreOpen}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-center text-[11px] font-medium text-[#B4B9C2]"
        >
          <NavIcon name="menu" size={18} />
          More
        </button>
      </nav>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="absolute bottom-0 inset-x-0 flex max-h-[80vh] flex-col rounded-t-2xl bg-[#111318] text-[#B4B9C2]">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <span className="text-[11px] uppercase tracking-widest text-[#747A85]">All screens</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-[#B4B9C2] hover:bg-[#1B1E25]"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">{renderGroups(true)}</div>
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
