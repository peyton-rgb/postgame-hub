"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ORANGE, OFFWHITE, RAISED, RAISED_B, INK_LABEL, MONO } from "@/lib/portal";

// Tab nav for the portal's private frame. Five tabs, rendered in two places:
// a horizontal row in the header (>=751px) and a sticky bottom tab bar
// (<=750px). Per the design system, Hub app surfaces get a bottom tab bar on
// mobile — never a hamburger, never a top nav.
//
// Visibility is driven by portal-mobile.css at the exact 750/751 boundary
// rather than by Tailwind's `md:` (768px), which would leave 751–767px with
// no nav at all.

type Tab = { label: string; href: string; icon: React.ReactNode };

function useTabs(token: string): Tab[] {
  const base = `/portal/${token}`;
  // The Assets tab points at /library: AssetModal in that directory is
  // imported by src/components/CampaignRecap.tsx, a protected file.
  return [
    {
      label: "Dashboard",
      href: base,
      icon: (
        <>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </>
      ),
    },
    { label: "Campaigns", href: `${base}/campaigns`, icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
    {
      label: "Review",
      href: `${base}/review`,
      icon: (
        <>
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="9" />
        </>
      ),
    },
    {
      label: "Assets",
      href: `${base}/library`,
      icon: (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="M21 16l-5-5-6 6" />
        </>
      ),
    },
    { label: "Reports", href: `${base}/reports`, icon: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /> },
  ];
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.6 }}
      className="w-[15px] h-[15px] flex-none"
    >
      {children}
    </svg>
  );
}

function useIsActive(base: string) {
  const pathname = usePathname();
  return (href: string) => (href === base ? pathname === base : pathname.startsWith(href));
}

function Badge({ count }: { count: number }) {
  // No badge at zero — an empty badge implies work that isn't there.
  if (!count) return null;
  return (
    <span
      className="inline-flex items-center justify-center rounded-[3px]"
      style={{ minWidth: 16, height: 16, padding: "0 5px", background: ORANGE, color: "#fff", fontSize: 10 }}
    >
      {count}
    </span>
  );
}

/** Header nav, >=751px. */
export default function PortalNav({ token, reviewCount = 0 }: { token: string; reviewCount?: number }) {
  const tabs = useTabs(token);
  const isActive = useIsActive(`/portal/${token}`);

  return (
    <nav className="pv2-nav-desktop gap-[2px]" aria-label="Portal sections">
      {tabs.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className="inline-flex items-center gap-[7px] rounded-[4px] px-[13px] py-2 transition-colors"
            style={{
              ...MONO,
              fontSize: 10,
              letterSpacing: ".15em",
              textDecoration: "none",
              color: active ? OFFWHITE : INK_LABEL,
              background: active ? RAISED : "transparent",
              border: `1px solid ${active ? RAISED_B : "transparent"}`,
            }}
          >
            <Icon>{t.icon}</Icon>
            {t.label}
            {t.label === "Review" ? <Badge count={reviewCount} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sticky bottom tab bar, <=750px. Rendered at the end of the layout. */
export function PortalTabBar({ token, reviewCount = 0 }: { token: string; reviewCount?: number }) {
  const tabs = useTabs(token);
  const isActive = useIsActive(`/portal/${token}`);

  return (
    <nav className="pv2-nav-mobile" aria-label="Portal sections">
      {tabs.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center justify-center relative"
            style={{
              ...MONO,
              textDecoration: "none",
              color: active ? ORANGE : INK_LABEL,
            }}
          >
            <Icon>{t.icon}</Icon>
            <span className="pv2-tablabel" style={{ color: active ? ORANGE : INK_LABEL }}>
              {t.label}
            </span>
            {t.label === "Review" && reviewCount > 0 ? (
              <span className="absolute top-[2px] right-[18%]">
                <Badge count={reviewCount} />
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
