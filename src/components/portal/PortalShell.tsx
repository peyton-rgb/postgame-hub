import "@/components/portal/dashboard/dashboard.css";
import { anton, arimo } from "@/components/portal/fonts";
import type { PortalPreviewChrome } from "@/components/portal/PortalFrame";

// ============================================================
// Shared chrome for every signed-in portal page (Phase 3b).
//
// Extracted from BrandDashboard so the rail, the toolbar and the admin
// preview pill exist ONCE. Six pages each carrying their own copy of a
// five-item rail is how the active state and the tooltips drift apart.
//
// The shell owns: rail, toolbar, preview pill, and the header row. A page
// supplies its title, an optional right-hand `aside` (the dashboard puts its
// KPIs there), and its body.
//
// Deliberately NOT a Next layout: a layout cannot read searchParams, and
// ?brand= is how admin preview selects a brand — so a layout could never know
// which brand's chrome to draw. Same reasoning as SessionPortalShell.
// ============================================================

export type PortalSection =
  | "home"
  | "campaigns"
  | "content"
  | "reports"
  | "athletes"
  | "settings";

const ICON = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  list: "M4 6h16M4 12h16M4 18h10",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  bars: "M4 20V10M10 20V4M16 20v-7",
  check: "M20 6 9 17l-5-5",
  trend: "M3 17l6-6 4 4 8-8",
} as const;

export function Stroke({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 15l5-5 4 4 3-3 6 6" />
    </svg>
  );
}

export function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11a3 3 0 1 0 0-6M21.5 20a5.5 5.5 0 0 0-4-5.3" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5 2 2 0 1 1-4 0 1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3 2 2 0 1 1-2.8-2.8 1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1 2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8 2 2 0 1 1 2.8-2.8 1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5 2 2 0 1 1 4 0 1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3 2 2 0 1 1 2.8 2.8 1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1 2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

/**
 * The one shared "none" mark for empty states, on every page.
 * Not the section's own icon — repeating a header icon directly beneath
 * itself reads as a rendering bug.
 */
export function TileEmpty({ line, note }: { line: string; note: string }) {
  return (
    <div className="pgd-blank">
      <span className="pgd-blank-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        </svg>
      </span>
      <b>{line}</b>
      <span>{note}</span>
    </div>
  );
}

/**
 * Every section is a real route now (Phase 3b), so every rail item links.
 * Calendar is the one exception — there is no calendar page and no dated
 * source to build one from, so it is not in the rail at all rather than
 * being a link to a 404 or a dead icon.
 */
const RAIL: { key: PortalSection; href: string; label: string; icon: React.ReactNode }[] = [
  { key: "home", href: "/portal", label: "Home", icon: <Stroke d={ICON.home} /> },
  { key: "campaigns", href: "/portal/campaigns", label: "Campaigns", icon: <Stroke d={ICON.list} /> },
  { key: "athletes", href: "/portal/athletes", label: "Athletes", icon: <PeopleIcon /> },
  { key: "content", href: "/portal/content", label: "Content", icon: <ImageIcon /> },
  { key: "reports", href: "/portal/reports", label: "Reports", icon: <Stroke d={ICON.chart} /> },
];

export default function PortalShell({
  active,
  postgameIcon,
  preview,
  title,
  subtitle,
  aside,
  searchValue,
  children,
}: {
  active: PortalSection;
  postgameIcon: string | null;
  preview?: PortalPreviewChrome | null;
  title: string;
  subtitle?: string | null;
  aside?: React.ReactNode;
  /** Prefills the toolbar box, so the search page shows the term it answered. */
  searchValue?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`pgd ${anton.variable} ${arimo.variable}`}
      style={{ fontFamily: "var(--font-arimo), Arimo, Arial, sans-serif" }}
    >
      <nav className="pgd-rail" aria-label="Portal sections">
        {/* Hard rule 1: the Postgame mark is a FILE. Square slot, so the ICON,
            not the ~5:1 wordmark. No file, nothing rendered. */}
        {postgameIcon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={postgameIcon} alt="Postgame" />
        ) : null}

        {RAIL.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={item.key === active ? "on" : undefined}
            aria-label={item.label}
            aria-current={item.key === active ? "page" : undefined}
          >
            {item.icon}
            <span className="pgd-tip" aria-hidden="true">
              {item.label}
            </span>
          </a>
        ))}

        <span className="pgd-spacer" />

        <a
          href="/portal/settings"
          className={active === "settings" ? "on" : undefined}
          aria-label="Settings"
          aria-current={active === "settings" ? "page" : undefined}
        >
          <GearIcon />
          <span className="pgd-tip" aria-hidden="true">
            Settings
          </span>
        </a>
        <span className="pgd-ava" aria-hidden="true" />
      </nav>

      <div className="pgd-main">
        <header className="pgd-head">
          <div>
            <h1 className="pgd-h1">{title}</h1>
            {subtitle ? <p className="pgd-sub">{subtitle}</p> : null}
          </div>

          <div className="pgd-headright">
            <div className="pgd-tools">
              {/* Admin preview pill, first so it sits left of search. In the
                  toolbar rather than floating: a fixed element on a full-bleed
                  grid covers data in every corner. Admin/exec only — `preview`
                  comes from one branch of resolveSessionPortal(). */}
              {preview && (
                <span className="pgd-chip" role="status" aria-label="Admin preview">
                  <span className="pgd-dot" aria-hidden="true" />
                  <span className="pgd-chip-label">Previewing {preview.brandName}</span>
                  <a href={preview.switchHref}>Switch</a>
                  <a href={preview.exitHref}>Exit</a>
                </span>
              )}

              {/* Search WORKS now. It was a decorative span through 3b, and
                  a box that ignores every keystroke teaches people the whole
                  toolbar is furniture. A plain GET form to /portal/search: no
                  client state, the query lives in the URL, and it is the only
                  control up here — the range selector and Notifications are
                  still gone until they do something.

                  No brand is carried in the query: an admin's previewed brand
                  lives in the pg_portal_preview_brand cookie, which
                  resolveSessionPortal() reads on the results page exactly as
                  it does here. Putting the brand id in the URL would also put
                  it in the address bar of every search. */}
              <form className="pgd-search-form" action="/portal/search" method="get" role="search">
                <input
                  className="pgd-t pgd-search"
                  type="search"
                  name="q"
                  defaultValue={searchValue ?? ""}
                  placeholder="Search campaigns and athletes"
                  aria-label="Search campaigns and athletes"
                />
              </form>
              <span className="pgd-av" role="img" aria-label="Your account">
                <PersonIcon />
              </span>
            </div>

            {aside}
          </div>
        </header>

        {children}
      </div>

      {/* Phone bottom tab bar. Design system: mobile nav is a bottom tab bar,
          never a hamburger, never a top nav. */}
      <nav className="pgd-tabbar" aria-label="Portal sections">
        {RAIL.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={item.key === active ? "on" : undefined}
            aria-current={item.key === active ? "page" : undefined}
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
