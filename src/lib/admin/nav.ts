// ============================================================
// /admin navigation — mirrors the CF admin's nav groups, minus the
// killed sections (NIL Coin, Account Types, Mass Invite download)
// and the four open-question families (Orders/ShipBob, Coupons,
// Cards+Templates, Invites — pending Slack answers; not built).
//
// CF one-screen-four-identities (Users / Ambassadors / Admins /
// Device IDs) collapses into /admin/users with filter presets.
// ============================================================

import type { AccessLevel } from "@/lib/admin/auth";

export interface AdminNavItem {
  label: string;
  href: string;
  min?: AccessLevel; // hidden below this level (default staff)
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
      { label: "Admin Dashboard", href: "/admin" },
      { label: "Company Dashboard", href: "/admin/company" },
    ],
  },
  {
    label: "Accounts",
    items: [
      { label: "Brands", href: "/admin/brands" },
      { label: "Campaigns", href: "/admin/campaigns" },
    ],
  },
  {
    label: "Athletes",
    items: [
      { label: "Users", href: "/admin/users" },
      { label: "Athlete Search", href: "/admin/athletes" },
      { label: "Audiences", href: "/admin/audiences" },
      { label: "Affiliate Links", href: "/admin/affiliate-links" },
    ],
  },
  {
    label: "Non-Athletes",
    items: [
      { label: "Agents", href: "/admin/agents" },
      // Absorbs the CF Admins view: external brand/agency access lives here,
      // staff accounts stay in /admin/users. admin+ only — this screen grants
      // and revokes access.
      { label: "Access Management", href: "/admin/access", min: "admin" },
    ],
  },
  {
    label: "Pay",
    min: "exec",
    items: [
      { label: "Pay Athletes", href: "/admin/pay" },
      { label: "Pay Vendor", href: "/admin/pay/vendor" },
      { label: "Affiliate Payments", href: "/admin/pay/affiliate" },
      { label: "Bonus Payments", href: "/admin/pay/bonus" },
      { label: "ACH / Wire / Zelle", href: "/admin/pay/ach" },
      { label: "1099 Report", href: "/admin/pay/1099" },
    ],
  },
  {
    label: "Profiles",
    items: [
      { label: "Profiles", href: "/admin/profiles" },
      { label: "Upload Profiles", href: "/admin/profiles/upload" },
    ],
  },
  {
    label: "Notifications",
    items: [
      { label: "Inbox", href: "/admin/notifications/inbox" },
      { label: "Mass Send", href: "/admin/notifications/send" },
      { label: "Notifications", href: "/admin/notifications" },
      { label: "Unsubscribes", href: "/admin/notifications/unsubscribes" },
    ],
  },
  {
    label: "App",
    items: [{ label: "App Viewer", href: "/admin/app" }],
  },
  {
    label: "Database",
    items: [{ label: "Colleges", href: "/admin/colleges" }],
  },
];

// Mobile bottom tab bar — five tabs max; "More" opens the full nav sheet.
export const ADMIN_TABS: AdminNavItem[] = [
  { label: "Home", href: "/admin" },
  { label: "Campaigns", href: "/admin/campaigns" },
  { label: "Users", href: "/admin/users" },
  { label: "Pay", href: "/admin/pay", min: "exec" },
];
