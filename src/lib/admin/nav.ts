// ============================================================
// /admin navigation — the postgame1.com (Lovable) admin's menu,
// rebuilt inside the Hub. Same groups, same order, same labels,
// so the ops team finds everything where they already look.
//
// Items whose screen hasn't been rebuilt yet carry `soon: true`:
// they show greyed out in the menu (not a link) so the full map is
// visible without anyone landing on a dead page. Remove `soon` as
// each screen ships.
//
// A few existing Hub admin screens with no Lovable equivalent
// (Company dashboard, ACH / 1099, App Viewer, Access, Notifications)
// are kept, placed in the closest group.
// ============================================================

import type { AccessLevel } from "@/lib/admin/auth";

export interface AdminNavItem {
  label: string;
  href: string;
  min?: AccessLevel; // hidden below this level (default staff)
  /** screen not rebuilt yet — shown greyed out, not clickable */
  soon?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
  min?: AccessLevel;
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { label: "Workspace", href: "/admin/workspace", soon: true },
      { label: "User", href: "/admin" },
      { label: "Campaign", href: "/admin/dashboard/campaigns", soon: true },
      { label: "Payments", href: "/admin/dashboard/payments", soon: true },
      { label: "Instagram", href: "/admin/dashboard/instagram", soon: true },
      { label: "Company", href: "/admin/company" },
    ],
  },
  {
    label: "Registered Users",
    items: [
      { label: "Athletes", href: "/admin/athletes" },
      { label: "Videographers", href: "/admin/videographers" },
      { label: "Agents", href: "/admin/agents" },
      { label: "Admins", href: "/admin/users" },
    ],
  },
  {
    label: "", // standalone items in the Lovable menu (no group heading)
    items: [
      { label: "Profiles", href: "/admin/profiles" },
      { label: "Create Audience", href: "/admin/audiences" },
      { label: "Accounts", href: "/admin/brands" },
      { label: "Campaigns", href: "/admin/campaigns" },
    ],
  },
  {
    label: "Content Management",
    items: [
      { label: "Run of shows", href: "/admin/content/run-of-shows", soon: true },
      { label: "Submission forms", href: "/admin/content/submissions", soon: true },
      { label: "Review & Edit", href: "/admin/content/review", soon: true },
      { label: "Posting instructions", href: "/admin/content/posting", soon: true },
      { label: "Recap builder", href: "/admin/content/recaps", soon: true },
      { label: "Media library", href: "/admin/content/media", soon: true },
    ],
  },
  {
    label: "Payments",
    min: "exec",
    items: [
      { label: "Pay Athletes (App)", href: "/admin/pay" },
      { label: "Submit Invoices", href: "/admin/pay/vendor" },
      { label: "Pay Invoices (Bill)", href: "/admin/pay/invoices", soon: true },
      { label: "Affiliate Payments", href: "/admin/pay/affiliate" },
      { label: "Bonus Payments", href: "/admin/pay/bonus" },
      { label: "ACH / Wire / Zelle", href: "/admin/pay/ach" },
      { label: "1099 Report", href: "/admin/pay/1099" },
    ],
  },
  {
    label: "",
    items: [{ label: "Reports", href: "/admin/reports", soon: true }],
  },
  {
    label: "Feed",
    items: [
      { label: "Postgame Feed", href: "/admin/feed/postgame", soon: true },
      { label: "Mentions", href: "/admin/feed/mentions", soon: true },
      { label: "Messages", href: "/admin/feed/messages", soon: true },
    ],
  },
  {
    label: "Mobile App",
    items: [
      { label: "Cards", href: "/admin/mobile-app/cards", soon: true },
      { label: "App Viewer", href: "/admin/app" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Colleges", href: "/admin/colleges" },
      { label: "Teams", href: "/admin/teams", soon: true },
      { label: "Instagram", href: "/admin/instagram", soon: true },
      { label: "Database", href: "/admin/database", soon: true },
      { label: "Upload", href: "/admin/profiles/upload" },
      { label: "Tickets", href: "/admin/tickets", soon: true },
      { label: "Notifications", href: "/admin/notifications" },
      { label: "Access Management", href: "/admin/access", min: "admin" },
      { label: "API", href: "/admin/api", min: "admin", soon: true },
    ],
  },
];

// Mobile bottom tab bar — five tabs max; "More" opens the full nav sheet.
export const ADMIN_TABS: AdminNavItem[] = [
  { label: "Home", href: "/admin" },
  { label: "Campaigns", href: "/admin/campaigns" },
  { label: "Athletes", href: "/admin/athletes" },
  { label: "Pay", href: "/admin/pay", min: "exec" },
];
