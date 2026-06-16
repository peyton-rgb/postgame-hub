"use client";

// Mobile bottom tab bar for the athlete app: Deals / My deals / Earnings / Profile.
// Highlights the active tab based on the current path.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/athlete",
    label: "Deals",
    match: (p: string) => p === "/athlete" || p.startsWith("/athlete/deals"),
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="4" y="4" width="7" height="7" rx="1" />
        <rect x="13" y="4" width="7" height="7" rx="1" />
        <rect x="4" y="13" width="7" height="7" rx="1" />
        <rect x="13" y="13" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/athlete/my-deals",
    label: "My deals",
    match: (p: string) => p.startsWith("/athlete/my-deals"),
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 6h11M4 12h11M4 18h11" />
        <path d="M18 5l1.5 1.5L21 4" />
      </svg>
    ),
  },
  {
    href: "/athlete/earnings",
    label: "Earnings",
    match: (p: string) => p.startsWith("/athlete/earnings"),
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <circle cx="17" cy="14" r="1.2" />
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
        <path d="M5 21c0-4 3.5-6 7-6s7 2 7 6" />
      </svg>
    ),
  },
];

export default function AthleteTabBar() {
  const pathname = usePathname() || "/athlete";
  return (
    <nav className="a-tabbar">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`a-tab${t.match(pathname) ? " active" : ""}`}
        >
          {t.icon}
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
