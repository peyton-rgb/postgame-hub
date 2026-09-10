import "@/components/portal/dashboard/dashboard.css";
import { anton, arimo } from "@/components/portal/fonts";
import { initials } from "@/lib/portal/format";
import type { PortalBrand } from "@/lib/portal-data";
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
  | "recaps"
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

/** A delivered document — the recap library, not a completed task. */
function RecapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M8.5 13h7M8.5 17h4.5" />
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
 * The brand's logo FOR A DARK SURFACE.
 *
 * Not pickBrandLogo(): that helper's fallback chain reaches
 * `logo_dark_url` before `logo_light_url`, and per CLAUDE.md those names
 * describe the INK, not the background — logo_dark_url is dark ink, meant for
 * a light background. On this near-black ground it would render as an
 * invisible smudge. Brands with brand_logos rows are unaffected either way
 * (attachPortalLogo already resolved a dark-surface variant); this only
 * changes which legacy column a brand WITHOUT those rows falls back to.
 *
 * Returning null is a real outcome, not a failure: the header then sets the
 * brand's name in Bebas, which is a fact, where a placeholder square is not.
 */
function darkSurfaceLogo(brand: Record<string, unknown> | undefined): string | null {
  if (!brand) return null;
  const resolved = brand.portalLogo as { url?: string } | string | null | undefined;
  if (resolved && typeof resolved === "object" && typeof resolved.url === "string") {
    return resolved.url;
  }
  if (typeof resolved === "string") return resolved;
  for (const key of ["logo_light_url", "logo_white_url", "logo_primary_url"]) {
    const v = brand[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
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
 * Home · Campaigns · Content · Recaps · Reports.
 *
 * ATHLETES IS NOT IN THE RAIL and /portal/athletes still works. The directory
 * is a reference list of 1,501 people; a brand reaches the ones that matter
 * through a campaign's Athletes tab, the roster tile's "All athletes", the
 * Reports page's top ten, or search. Five rail items that each answer a
 * question beat six where one is a phone book.
 *
 * Calendar is still absent: there is no calendar page and no dated source to
 * build one from, so it is not a link to a 404 or a dead icon.
 */
const RAIL: { key: PortalSection; href: string; label: string; icon: React.ReactNode }[] = [
  { key: "home", href: "/portal", label: "Home", icon: <Stroke d={ICON.home} /> },
  { key: "campaigns", href: "/portal/campaigns", label: "Campaigns", icon: <Stroke d={ICON.list} /> },
  { key: "content", href: "/portal/content", label: "Content", icon: <ImageIcon /> },
  { key: "recaps", href: "/portal/recaps", label: "Recaps", icon: <RecapIcon /> },
  { key: "reports", href: "/portal/reports", label: "Reports", icon: <Stroke d={ICON.chart} /> },
];

export default function PortalShell({
  active,
  postgameIcon,
  preview,
  brand,
  accountLabel,
  title,
  subtitle,
  aside,
  searchValue,
  children,
}: {
  active: PortalSection;
  postgameIcon: string | null;
  preview?: PortalPreviewChrome | null;
  /**
   * Whose portal this is. `portalLogo` is already resolved by
   * attachPortalLogo() — a dark-surface lockup from brand_logos — so the
   * shell only has to render it. Nothing new is queried for the brand mark.
   */
  brand?: Pick<PortalBrand, "id" | "name"> & Record<string, unknown>;
  /** The signed-in person, for the account disc's initials. */
  accountLabel?: string | null;
  /**
   * The page's h1. Pass null when the page names itself in its own body —
   * campaign detail puts the name in the hero, and printing it here as well
   * put the same words on screen twice, 40px apart.
   */
  title: string | null;
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
      {/* LABELLED RAIL. 200px with icon + label down to 1100px, icons only
          below that, and the phone tab bar below 640 as before. The tooltips
          stay: they are what the collapsed rail falls back to. */}
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
            aria-current={item.key === active ? "page" : undefined}
          >
            {item.icon}
            <span className="pgd-rail-label">{item.label}</span>
            <span className="pgd-tip" aria-hidden="true">
              {item.label}
            </span>
          </a>
        ))}

        <span className="pgd-spacer" />

        <a
          href="/portal/settings"
          className={active === "settings" ? "on" : undefined}
          aria-current={active === "settings" ? "page" : undefined}
        >
          <GearIcon />
          <span className="pgd-rail-label">Settings</span>
          <span className="pgd-tip" aria-hidden="true">
            Settings
          </span>
        </a>

        {/* The account. Initials, not an empty circle — a blank disc read as a
            missing avatar; initials read as a person we have no photo of,
            which is the same rule the roster and the athletes directory
            follow. */}
        <span className="pgd-account">
          <span className="pgd-account-disc" aria-hidden="true">
            {accountLabel ? initials(accountLabel) : ""}
          </span>
          <span className="pgd-rail-label pgd-account-label">
            {accountLabel ?? "Account"}
          </span>
        </span>
      </nav>

      <div className="pgd-main">
        <header className="pgd-head">
          {/* WHOSE PORTAL THIS IS. The brand's own dark-surface lockup, left
              of the page title, with a fixed "Brand portal" under it — the
              rail carries the Postgame mark, so the two marks never compete
              for the same corner.

              brand_logos is already resolved upstream by attachPortalLogo(),
              which picks a dark-surface lockup; nothing is queried here. With
              no logo on file the brand's NAME is set in Bebas rather than a
              placeholder square, because a name is a fact and a grey box
              isn't. Hard rule: a client logo is never redrawn or generated —
              it is the file from brand_logos or it is type. */}
          {brand ? (
            <div className="pgd-brandmark">
              {(() => {
                const logo = darkSurfaceLogo(brand);
                return logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={brand.name ?? "Brand"} />
                ) : (
                  <span className="pgd-brandmark-name">{brand.name}</span>
                );
              })()}
              <span className="pgd-brandmark-sub">Brand portal</span>
            </div>
          ) : null}

          <div>
            {title !== null ? <h1 className="pgd-h1">{title}</h1> : null}
            {/* With no title the subtitle is the header's only line, so it
                leads rather than sits under something. */}
            {subtitle ? (
              <p className={`pgd-sub${title === null ? " pgd-sub-lead" : ""}`}>{subtitle}</p>
            ) : null}
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
                  placeholder="Search campaigns, athletes"
                  aria-label="Search campaigns and athletes"
                />
                {/* A real submit control beside the field. Enter already
                    submitted — verified in a browser: the input is
                    hit-testable, the form's action resolves, and Enter
                    navigates to /portal/search — but a lone unadorned box
                    gives no sign it is a control at all, and the only way to
                    find out was to guess that Enter did something. */}
                <button className="pgd-search-go" type="submit" aria-label="Search">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-4.2-4.2" />
                  </svg>
                </button>
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
