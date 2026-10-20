// ============================================================
// /admin navigation — the approved Hub admin prototype's menu
// (hub-admin-prototype NAV), in the same groups, order and labels.
//
// Two top-level links (Workspace, Overview), then collapsible groups.
// Every entry carries an `icon` key that AdminShell renders from its
// inline SVG set (src/components/admin/NavIcon.tsx).
//
// Items whose screen hasn't been built yet carry `soon: true`: they
// show greyed out in the menu (not a link) so the full map is visible
// without anyone landing on a dead page. Flip `soon` off (and the href
// to the canonical route) as each screen ships.
//
// Where a canonical route is not built yet but the Hub already has an
// equivalent page, the item points at the existing page so nothing
// that works today becomes unreachable. Those are marked "(today:)"
// in the comments below.
// ============================================================

import type { AccessLevel } from "@/lib/admin/auth";

export interface AdminNavItem {
  label: string;
  href: string;
  /** key into the NavIcon set */
  icon: string;
  min?: AccessLevel; // hidden below this level (default staff)
  /** screen not built yet — shown greyed out, not clickable */
  soon?: boolean;
}

export interface AdminNavGroup {
  /** group heading; empty string = top-level links with no heading */
  label: string;
  icon: string;
  items: AdminNavItem[];
  min?: AccessLevel;
  /** small "New" tag next to the heading */
  isNew?: boolean;
  /** Workspace badge: count of open campaigns (filled in by the layout) */
  badgeKey?: "openCampaigns";
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "",
    icon: "",
    items: [
      { label: "Workspace", href: "/admin", icon: "home" },
      { label: "Overview", href: "/admin/overview", icon: "chart" },
    ],
  },
  {
    label: "Brands",
    icon: "building",
    items: [
      { label: "All brands", href: "/admin/brands", icon: "building" },
      { label: "Campaigns", href: "/admin/campaigns", icon: "mega" },
      { label: "Brand portals", href: "/admin/brand-portals", icon: "portal" },
    ],
  },
  {
    label: "People",
    icon: "users",
    items: [
      { label: "Athletes", href: "/admin/athletes", icon: "user" },
      { label: "App users", href: "/admin/users", icon: "phone" },
      { label: "Rosters", href: "/admin/rosters", icon: "school" },
      { label: "Invites", href: "/admin/invites", icon: "send" },
      { label: "Videographers", href: "/admin/videographers", icon: "video" },
      { label: "Agents", href: "/admin/agents", icon: "handshake" },
      { label: "Audiences", href: "/admin/audiences", icon: "target" },
    ],
  },
  {
    label: "Content",
    icon: "folder",
    items: [
      { label: "Submission forms", href: "/admin/content/submissions", icon: "inbox" },
      { label: "Review & edit", href: "/admin/content/review", icon: "checkbox" },
      { label: "Posting instructions", href: "/admin/content/posting", icon: "send" },
      { label: "Recap builder", href: "/admin/content/recaps", icon: "bars" },
      { label: "Run of shows", href: "/admin/content/run-of-shows", icon: "list" },
      { label: "Media library", href: "/admin/content/media", icon: "image" },
    ],
  },
  {
    label: "Payments",
    icon: "dollar",
    min: "exec",
    items: [
      // Old routes (/admin/pay/vendor, /bonus, /affiliate, /1099, /ach) redirect to these.
      { label: "Payments overview", href: "/admin/pay", icon: "pie" },
      { label: "Pay athletes (app)", href: "/admin/pay/athletes", icon: "card" },
      { label: "Invoices", href: "/admin/pay/invoices", icon: "receipt" },
      { label: "Bonuses & affiliate", href: "/admin/pay/bonus-affiliate", icon: "gift" },
      { label: "History & 1099", href: "/admin/pay/history", icon: "history" },
    ],
  },
  {
    label: "Social",
    icon: "at",
    items: [
      { label: "Postgame feed", href: "/admin/feed/postgame", icon: "news" },
      { label: "Mentions", href: "/admin/feed/mentions", icon: "at" },
      { label: "Messages", href: "/admin/feed/messages", icon: "chat" },
    ],
  },
  {
    label: "Mobile app",
    icon: "phone",
    items: [
      { label: "Cards", href: "/admin/mobile-app/cards", icon: "grid" },
      { label: "Feed preview", href: "/admin/mobile-app/feed", icon: "phone" },
    ],
  },
  {
    label: "Hub tools",
    icon: "spark",
    isNew: true,
    items: [
      // These are the existing Hub dashboard tools until they move under /admin.
      { label: "Website & deal tracker", href: "/dashboard/website", icon: "globe" },
      { label: "Pitch pages", href: "/dashboard/pitches", icon: "present" },
      { label: "Concepts & inspo", href: "/dashboard/inspo", icon: "bulb" },
      { label: "Agents & tasks", href: "/admin/tools/agents", icon: "bot" },
    ],
  },
  {
    label: "Admin",
    icon: "shield",
    items: [
      { label: "Requests", href: "/admin/requests", icon: "ticket" },
      { label: "Team", href: "/admin/team", icon: "users" },
      { label: "Roles & permissions", href: "/admin/roles", icon: "key" },
      { label: "Access", href: "/admin/access", icon: "shield", min: "admin" },
      { label: "Schools & teams", href: "/admin/schools", icon: "school" },
      { label: "Data tools", href: "/admin/data-tools", icon: "db" },
      { label: "Instagram stats", href: "/admin/instagram", icon: "insta" },
      { label: "Notifications", href: "/admin/notifications", icon: "bell" },
      { label: "Settings", href: "/admin/settings", icon: "cog" },
    ],
  },
];

/** Sidebar footer links (Settings · Log out). Log out is handled by the shell. */
export const ADMIN_FOOT: AdminNavItem[] = [
  { label: "Settings", href: "/admin/settings", icon: "cog" },
];

// Mobile bottom tab bar — five tabs max; "More" opens the full nav sheet.
export const ADMIN_TABS: AdminNavItem[] = [
  { label: "Home", href: "/admin", icon: "home" },
  { label: "Campaigns", href: "/admin/campaigns", icon: "mega" },
  { label: "Athletes", href: "/admin/athletes", icon: "user" },
  { label: "Pay", href: "/admin/pay", icon: "dollar", min: "exec" },
];
