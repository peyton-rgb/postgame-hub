"use client";

// Floating pill dock (matches postgame-app.html): Deals / My deals /
// Earnings / Profile. The active tab renders as an orange rounded chip.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/athlete",
    label: "Deals",
    match: (p: string) => p === "/athlete" || p.startsWith("/athlete/deals"),
    icon: (
      <svg viewBox="0 0 24 24" style={{ fill: "currentColor", stroke: "none" }}>
        <path d="M13 2 4.5 14h5.5l-1.5 8L17 10h-5.5L13 2z" />
      </svg>
    ),
  },
  {
    href: "/athlete/my-deals",
    label: "My deals",
    match: (p: string) => p.startsWith("/athlete/my-deals"),
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/athlete/earnings",
    label: "Earnings",
    match: (p: string) => p.startsWith("/athlete/earnings"),
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 2v20M17 6.5c-1-1.4-2.8-2-5-2-2.6 0-4.5 1.3-4.5 3.4 0 4.6 9.8 2.3 9.8 7 0 2.2-2 3.6-5.3 3.6-2.4 0-4.3-.8-5.3-2.2" />
      </svg>
    ),
  },
  {
    href: "/athlete/profile",
    label: "Profile",
    match: (p: string) => p.startsWith("/athlete/profile"),
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    ),
  },
];

export default function AthleteTabBar() {
  const pathname = usePathname() || "/athlete";
  return (
    <div className="a-dockwrap">
      <nav className="a-dock">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`a-dtab${t.match(pathname) ? " active" : ""}`}
          >
            {t.icon}
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
