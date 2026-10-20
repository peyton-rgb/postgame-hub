// ============================================================
// The left nav of a View-as preview — the prototype swaps the shell's
// left nav for the brand portal's (BRAND_NAV) or the athlete app's
// (ATH_NAV) tabs. Here it sits as a dark rail beside the page, styled
// like the admin sidebar: a "who" block (brand logo from the brands
// row, or the athlete's avatar), the tabs, then Settings and "Back to
// staff view". On phones it collapses to a horizontal tab strip.
// ============================================================

"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon from "@/components/admin/NavIcon";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number | null;
  /** exact match only (the home tab) */
  exact?: boolean;
}

export default function PortalNav({
  who,
  sub,
  logo,
  initials,
  items,
  settings,
  footLine,
}: {
  who: string;
  sub: string;
  /** brand mark (light ink) or athlete avatar; null = empty tile / initials */
  logo: string | null;
  /** shown in a round avatar when there's no logo (athletes only) */
  initials?: string;
  items: PortalNavItem[];
  settings: PortalNavItem;
  footLine: string;
}) {
  const pathname = usePathname() ?? "";
  const isOn = (i: PortalNavItem) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/"));

  const link = (i: PortalNavItem, compact = false) => {
    const on = isOn(i);
    return (
      <Link
        key={i.href}
        href={i.href}
        aria-current={on ? "page" : undefined}
        className={
          (compact
            ? "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium "
            : "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[14px] font-medium leading-5 ") +
          (on ? "bg-[#22262E] text-white shadow-[inset_2px_0_0_#D73F09]" : "text-[#B4B9C2] hover:bg-[#1B1E25] hover:text-[#EEF0F3]")
        }
      >
        <NavIcon name={i.icon} size={compact ? 15 : 16} />
        <span className="truncate">{i.label}</span>
        {i.badge != null && i.badge > 0 && (
          <span className="ml-auto rounded-full bg-[#D73F09] px-[7px] text-[12px] font-semibold leading-5 text-white tabular-nums">
            {i.badge}
          </span>
        )}
      </Link>
    );
  };

  const mark = logo ? (
    initials ? (
      <img src={logo} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
    ) : (
      <span className="grid h-8 w-8 shrink-0 place-items-center">
        <img src={logo} alt={`${who} logo`} className="max-h-8 max-w-8 object-contain" />
      </span>
    )
  ) : initials ? (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2A2E37] text-[12px] font-semibold text-[#EEF0F3]">{initials}</span>
  ) : (
    <span className="h-8 w-8 shrink-0 rounded-[7px] bg-[#22262E]" title="No logo on file" />
  );

  return (
    <>
      {/* Desktop rail */}
      <aside aria-label="Preview menu" className="hidden w-[220px] shrink-0 self-start overflow-hidden rounded-xl bg-[#111318] text-[#B4B9C2] md:sticky md:top-[84px] md:flex md:flex-col">
        <div className="flex items-center gap-2.5 border-b border-[#22262E] px-3.5 pb-3.5 pt-3">
          {mark}
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-white">{who}</div>
            <div className="truncate text-[11px] text-[#B4B9C2] opacity-75">{sub}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-px p-2">{items.map((i) => link(i))}</nav>
        <div className="flex flex-col gap-px border-t border-[#22262E] p-2">
          {link(settings)}
          <Link href="/admin" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[14px] font-medium text-[#B4B9C2] hover:bg-[#1B1E25] hover:text-[#EEF0F3]">
            <NavIcon name="out" />
            Back to staff view
          </Link>
          <div className="truncate px-2.5 pb-0.5 pt-2 text-[12px] text-[#747A85]" title={footLine}>
            {footLine}
          </div>
        </div>
      </aside>

      {/* Phone: who line + scrolling tab strip */}
      <div className="mb-3 overflow-hidden rounded-xl bg-[#111318] text-[#B4B9C2] md:hidden">
        <div className="flex items-center gap-2.5 px-3 pb-2 pt-2.5">
          {mark}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white">{who}</div>
            <div className="truncate text-[11px] opacity-75">{sub}</div>
          </div>
          <Link href="/admin" className="shrink-0 text-[12px] font-medium text-[#B4B9C2] underline-offset-2 hover:underline">
            Staff view
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none]">
          {[...items, settings].map((i) => link(i, true))}
        </nav>
      </div>
    </>
  );
}
