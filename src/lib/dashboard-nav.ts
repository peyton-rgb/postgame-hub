// ============================================================
// /dashboard navigation structure
//
// Structure only — DashboardSidebar.tsx owns rendering, icons, auth
// and sign-out. Mirrors src/lib/admin/nav.ts, which is likewise pure
// data with no JSX, so the two rails share one convention.
//
// Sections are ordered by how often things are opened, and labelled as
// verb phrases in sentence case.
//
// This is the ONLY nav for /dashboard/* — DashboardShell CSS-hides each
// page's own <aside> — so anything missing here is unreachable by
// clicking. `hidden: true` keeps a route live while taking its link off
// the rail; nothing here deletes a route.
// ============================================================

// Icons live in the component. Referencing them by key keeps this file
// pure data (no JSX, no React import) and avoids a circular import
// between the component and its own nav.
export type NavIcon =
  | "readiness"
  | "campaigns"
  | "brands"
  | "reviews"
  | "inbound"
  | "edit"
  | "approval"
  | "media"
  | "intake"
  | "forms"
  | "camera"
  | "brief"
  | "optin"
  | "runofshow"
  | "instructions"
  | "captions"
  | "wand"
  | "inspo"
  | "recaps"
  | "portal"
  | "package"
  | "trending"
  | "photo"
  | "browser"
  | "grid"
  | "team"
  | "mail"
  | "notebook"
  | "star"
  | "chart"
  | "dollar"
  | "calendar";

export type NavLink = {
  name: string;
  href: string;
  icon: NavIcon;
  staffOnly?: boolean; // hidden unless the viewer is staff (role !== 'athlete')
  hidden?: boolean; // route stays live, link is not rendered
  children?: NavLink[]; // collapsible group
};

export type NavSection = {
  label: string;
  links: NavLink[];
};

export const DASHBOARD_NAV: NavSection[] = [
  {
    label: "Daily work",
    links: [
      { name: "Campaign dashboard", href: "/dashboard/readiness", icon: "readiness", staffOnly: true },
      { name: "Campaigns", href: "/dashboard/campaigns", icon: "campaigns", staffOnly: true },
      { name: "Brands", href: "/dashboard/brands", icon: "brands" },
      {
        // Child labels mirror athlete_deliverables.status values (in_review,
        // in_edit, brand_review) on purpose, so screen and data use the same
        // words. "Inbound" is the staff deliverable queue.
        name: "Reviews",
        href: "/dashboard/reviews/campaigns",
        icon: "reviews",
        children: [
          { name: "Inbound", href: "/dashboard/athlete-deals", icon: "inbound", staffOnly: true },
          // No route yet — Phase 3 of the content review pipeline.
          { name: "In edit", href: "/dashboard/in-edit", icon: "edit", hidden: true },
          { name: "Brand approval", href: "/dashboard/brand-approval", icon: "approval" },
        ],
      },
      { name: "Media library", href: "/media-library", icon: "media" },
      { name: "Intake", href: "/dashboard/intake", icon: "intake" },
      { name: "Submission forms", href: "/dashboard/submission-forms", icon: "forms" },
      // The receiving end of the review hub's "send to edit queue". Sits here
      // rather than under Reviews because that group's child labels mirror
      // athlete_deliverables.status values, and this lane is tier3_submissions.
      { name: "Edit queue", href: "/dashboard/edit-queue", icon: "edit", staffOnly: true },
      { name: "BTS submissions", href: "/dashboard/bts", icon: "camera" },
    ],
  },
  {
    label: "Set up a campaign",
    links: [
      { name: "Briefs", href: "/dashboard/briefs", icon: "brief" },
      // ?tab=optin renders <OptInList> (live `optin_campaigns`). Deliberately
      // NOT /dashboard/campaign-optin — that index page is the legacy
      // `campaign_optins` product. See claude_REPO-REUSE-MAP.md.
      { name: "Campaign opt-in", href: "/dashboard?tab=optin", icon: "optin" },
      // Also a ?tab= surface on /dashboard, not a route of its own —
      // /dashboard/run-of-show is a 5-line stub.
      { name: "Run of shows", href: "/dashboard?tab=ros", icon: "runofshow" },
      { name: "Campaign instructions", href: "/dashboard/campaign-instructions", icon: "instructions" },
      // Page does not exist yet.
      { name: "Posting instructions", href: "/dashboard/posting-instructions", icon: "instructions", hidden: true },
    ],
  },
  {
    label: "Make content",
    links: [
      { name: "Captions", href: "/dashboard/captions", icon: "captions" },
      { name: "Manual editing", href: "/dashboard/editing", icon: "edit" },
      // Phase 3 of the content review pipeline.
      { name: "AI editing", href: "/dashboard/ai-editing", icon: "wand", hidden: true },
      { name: "Inspo library", href: "/dashboard/inspo", icon: "inspo" },
      { name: "Inspo triage", href: "/dashboard/inspo/triage", icon: "inspo" },
      // Built, not yet wired to data. Route stays live for bookmarks.
      { name: "Publishing", href: "/dashboard/publishing", icon: "calendar", hidden: true },
      { name: "Composer", href: "/dashboard/composer", icon: "grid", hidden: true },
    ],
  },
  {
    label: "Send to brand",
    links: [
      { name: "Recaps", href: "/dashboard/recaps", icon: "recaps" },
      { name: "Brand portals", href: "/dashboard/brand-portals", icon: "portal" },
      { name: "Asset packages", href: "/packages", icon: "package" },
      { name: "Performance trackers", href: "/dashboard?tab=trackers", icon: "trending" },
      // Built, not yet wired to data. Routes stay live for bookmarks.
      { name: "Final assets", href: "/dashboard/assets", icon: "package", hidden: true },
      { name: "Performance", href: "/dashboard/performance", icon: "chart", hidden: true },
      { name: "ROI", href: "/dashboard/roi", icon: "dollar", hidden: true },
    ],
  },
  {
    label: "Graphics & website",
    links: [
      { name: "Draft graphics", href: "/dashboard/graphic-creation/draft", icon: "photo" },
      { name: "Throwback thursday", href: "/dashboard/graphic-creation/throwback", icon: "photo" },
      { name: "Campaign opt-in graphics", href: "/dashboard/graphic-creation/optin", icon: "photo" },
      {
        name: "Website editor",
        href: "/dashboard/website",
        icon: "browser",
        children: [
          { name: "Homepage", href: "/dashboard/homepage", icon: "browser" },
          { name: "Services", href: "/dashboard/services", icon: "grid" },
          { name: "Team", href: "/dashboard/team", icon: "team" },
          { name: "Contact", href: "/dashboard/contact", icon: "mail" },
          { name: "Case studies", href: "/dashboard/case-studies", icon: "notebook" },
          // No page.tsx exists.
          { name: "Press", href: "/dashboard/website/press", icon: "brief", hidden: true },
          // Hidden, NOT as briefed: /dashboard/website/campaigns has no index
          // page — only campaigns/[id]/hero — so linking it renders a 404.
          // Same state as Press above, so it gets the same treatment. The
          // route is untouched; un-hide once an index page exists.
          { name: "Campaign pages", href: "/dashboard/website/campaigns", icon: "photo", hidden: true },
        ],
      },
      { name: "Pitches", href: "/dashboard/pitches", icon: "star" },
      { name: "Newsletter", href: "/dashboard/newsletter", icon: "mail" },
      // Real pages that came off the rail in this pass. Not in the brief's
      // hidden list, recorded here so the file stays a complete map of
      // /dashboard/* and the routes remain reachable by URL.
      { name: "Athletes", href: "/dashboard/athletes", icon: "team", staffOnly: true, hidden: true },
      { name: "Campaign briefs", href: "/dashboard/campaign-briefs", icon: "brief", hidden: true },
    ],
  },
];

// Every link that renders, flattened parent-first. Children of a group follow
// their parent. staffOnly filtering stays in the component, where isStaff lives.
export function visibleLinks(sections: NavSection[] = DASHBOARD_NAV): NavLink[] {
  const out: NavLink[] = [];
  for (const section of sections) {
    for (const link of section.links) {
      if (link.hidden) continue;
      out.push(link);
      for (const child of link.children ?? []) {
        if (!child.hidden) out.push(child);
      }
    }
  }
  return out;
}

// The single active href for a path, or null.
//
// Exact match first, then the longest prefix match — so
// /dashboard/website/campaigns resolves to Campaign pages alone, where a plain
// startsWith highlighted Website editor at the same time. Only ever one winner.
//
// Tab links (/dashboard?tab=…) never match: telling them apart needs the ?tab=
// value, and useSearchParams() in this shell would need a Suspense boundary it
// does not have. Matching on path alone would light all three at once, which is
// worse than none. They navigate correctly regardless.
export function resolveActiveHref(
  pathname: string | null | undefined,
  sections: NavSection[] = DASHBOARD_NAV
): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const link of visibleLinks(sections)) {
    const href = link.href;
    if (href.includes("?")) continue;
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) continue;
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}

// Groups whose parent or any child owns the current path. Used to force a
// collapsed group open — someone on a review page has to see where they are,
// whatever their stored preference says.
export function groupsContaining(
  pathname: string | null | undefined,
  sections: NavSection[] = DASHBOARD_NAV
): string[] {
  if (!pathname) return [];
  const active = resolveActiveHref(pathname, sections);
  if (!active) return [];
  const open: string[] = [];
  for (const section of sections) {
    for (const link of section.links) {
      if (!link.children?.length) continue;
      const owns =
        link.href === active || link.children.some((c) => !c.hidden && c.href === active);
      if (owns) open.push(link.href);
    }
  }
  return open;
}
