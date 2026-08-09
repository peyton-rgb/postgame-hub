"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ORANGE, OFFWHITE, RAISED, RAISED_B, HAIR, INK_LABEL, MONO } from "@/lib/portal";

// Tab nav for the portal's private frame. Five tabs, rendered twice: a
// horizontal row in the header on desktop, and a bottom tab bar on mobile.
//
// The design file drops its nav entirely below 1000px with nothing replacing
// it, which would strand every tab on a phone. Per the design system, Hub
// surfaces get a BOTTOM TAB BAR on mobile — never a hamburger, never a top
// nav. Active tab is orange there (orange marks where the eye lands; it is
// never used as a surface or a large fill — hard rule 5).

type Tab = { label: string; href: string; icon: React.ReactNode };

export default function PortalNav({ token }: { token: string }) {
  const pathname = usePathname();
  const base = `/portal/${token}`;

  // NOTE: the Assets tab points at /library, not /assets. AssetModal lives in
  // that directory and is imported by src/components/CampaignRecap.tsx, which
  // is a protected file — renaming the directory would break an import we are
  // not allowed to touch.
  const tabs: Tab[] = [
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
    {
      label: "Campaigns",
      href: `${base}/campaigns`,
      icon: <path d="M4 6h16M4 12h16M4 18h10" />,
    },
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
    {
      label: "Reports",
      href: `${base}/reports`,
      icon: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
    },
  ];

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  const Icon = ({ children }: { children: React.ReactNode }) => (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{ stroke: "currentColor", fill: "none", strokeWidth: 1.6 }}
      className="w-[15px] h-[15px] flex-none"
    >
      {children}
    </svg>
  );

  return (
    <>
      {/* Desktop / tablet: horizontal tabs in the header. */}
      <nav className="hidden md:flex gap-[2px]" aria-label="Portal sections">
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
            </Link>
          );
        })}
      </nav>

      {/* Mobile: bottom tab bar. Every target is >= 44px tall. */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5"
        aria-label="Portal sections"
        style={{
          background: "rgba(7,7,10,.94)",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          borderTop: `1px solid ${HAIR}`,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {tabs.map((t) => {
          const active = isActive(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-[5px] min-h-[56px] px-1"
              style={{
                ...MONO,
                fontSize: 9,
                letterSpacing: ".10em",
                textDecoration: "none",
                color: active ? ORANGE : INK_LABEL,
              }}
            >
              <Icon>{t.icon}</Icon>
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
