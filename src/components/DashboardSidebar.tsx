// ============================================================
// Unified Dashboard Sidebar — single nav for ALL /dashboard/* pages
//
// Five sections ordered by how often things are opened, with two
// collapsible groups (Reviews, Website editor). The structure lives in
// src/lib/dashboard-nav.ts — this file owns rendering, icons, auth and
// sign-out.
//
// This is the ONLY sidebar in the app — pre-existing pages
// no longer render their own.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';
import {
  DASHBOARD_NAV,
  resolveActiveHref,
  groupsContaining,
  type NavIcon,
  type NavLink,
  type NavSection,
} from '@/lib/dashboard-nav';

// ------------------------------------------------------------
// Icon components — small inline SVGs so we don't need an
// external icon library. Each one is 18×18 with stroke style.
// ------------------------------------------------------------

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      {children}
    </svg>
  );
}

// Creative Brain
const FileTextIcon = () => (
  <Icon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </Icon>
);

const SparklesIcon = () => (
  <Icon>
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
  </Icon>
);

const UploadIcon = () => (
  <Icon>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </Icon>
);

// Production
const WandIcon = () => (
  <Icon>
    <path d="M15 4V2" />
    <path d="M15 16v-2" />
    <path d="M8 9h2" />
    <path d="M20 9h2" />
    <path d="M17.8 11.8L19 13" />
    <path d="M15 9h0" />
    <path d="M17.8 6.2L19 5" />
    <path d="M3 21l9-9" />
    <path d="M12.2 6.2L11 5" />
  </Icon>
);

const ScissorsIcon = () => (
  <Icon>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="20" y1="4" x2="8.12" y2="15.88" />
    <line x1="14.47" y1="14.48" x2="20" y2="20" />
    <line x1="8.12" y1="8.12" x2="12" y2="12" />
  </Icon>
);

const GridIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </Icon>
);

// Review
const CheckCircleIcon = () => (
  <Icon>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </Icon>
);

const EyeIcon = () => (
  <Icon>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

const PackageIcon = () => (
  <Icon>
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </Icon>
);

// Distribution
const MessageIcon = () => (
  <Icon>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Icon>
);

const CalendarIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </Icon>
);

// Analytics
const BarChartIcon = () => (
  <Icon>
    <line x1="12" y1="20" x2="12" y2="10" />
    <line x1="18" y1="20" x2="18" y2="4" />
    <line x1="6" y1="20" x2="6" y2="16" />
  </Icon>
);

const DollarIcon = () => (
  <Icon>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </Icon>
);

// Pages
const PresentationIcon = () => (
  <Icon>
    <path d="M2 3h20" />
    <path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3" />
    <path d="M12 18v4" />
    <path d="M8 22h8" />
  </Icon>
);

const TrendingUpIcon = () => (
  <Icon>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </Icon>
);

const InboxIcon = () => (
  <Icon>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </Icon>
);

const ListCheckIcon = () => (
  <Icon>
    <path d="M10 6h11" />
    <path d="M10 12h11" />
    <path d="M10 18h11" />
    <path d="M3 6l1 1 2-2" />
    <path d="M3 12l1 1 2-2" />
    <path d="M3 18l1 1 2-2" />
  </Icon>
);

const NotebookIcon = () => (
  <Icon>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </Icon>
);

const StarIcon = () => (
  <Icon>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Icon>
);

const MailIcon = () => (
  <Icon>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </Icon>
);

const ClipboardIcon = () => (
  <Icon>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </Icon>
);

const UserCheckIcon = () => (
  <Icon>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <polyline points="17 11 19 13 23 9" />
  </Icon>
);

const UsersIcon = () => (
  <Icon>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

const BuildingIcon = () => (
  <Icon>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <line x1="8" y1="6" x2="8" y2="6" />
    <line x1="12" y1="6" x2="12" y2="6" />
    <line x1="16" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="8" y2="10" />
    <line x1="12" y1="10" x2="12" y2="10" />
    <line x1="16" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" />
    <line x1="12" y1="14" x2="12" y2="14" />
    <line x1="16" y1="14" x2="16" y2="14" />
  </Icon>
);

const ExternalLinkIcon = () => (
  <Icon>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </Icon>
);

const PhotoIcon = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </Icon>
);

const CameraIcon = () => (
  <Icon>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </Icon>
);

const BrowserIcon = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="3" x2="9" y2="9" />
  </Icon>
);

// Sign Out
const LogOutIcon = () => (
  <Icon>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </Icon>
);

// Collapse toggle — rotates 90 degrees when its group is open.
const ChevronRightIcon = () => (
  <Icon>
    <polyline points="9 18 15 12 9 6" />
  </Icon>
);

// Nav data names icons by key; this is where keys become components.
const ICONS: Record<NavIcon, React.FC> = {
  readiness: ListCheckIcon,
  campaigns: BarChartIcon,
  brands: BuildingIcon,
  reviews: EyeIcon,
  inbound: UserCheckIcon,
  edit: ScissorsIcon,
  approval: CheckCircleIcon,
  media: PhotoIcon,
  intake: UploadIcon,
  forms: InboxIcon,
  camera: CameraIcon,
  brief: FileTextIcon,
  optin: UsersIcon,
  runofshow: ListCheckIcon,
  instructions: ClipboardIcon,
  captions: MessageIcon,
  wand: WandIcon,
  inspo: SparklesIcon,
  recaps: PresentationIcon,
  portal: ExternalLinkIcon,
  package: PackageIcon,
  trending: TrendingUpIcon,
  photo: PhotoIcon,
  browser: BrowserIcon,
  grid: GridIcon,
  team: UsersIcon,
  mail: MailIcon,
  notebook: NotebookIcon,
  star: StarIcon,
  chart: BarChartIcon,
  dollar: DollarIcon,
  calendar: CalendarIcon,
};

// Which groups the viewer has collapsed. Storing the collapsed set (rather
// than the open set) makes "open by default" the natural state for anyone who
// has never touched a chevron, including on first render before hydration.
const COLLAPSED_KEY = 'pg.dashboard-nav.collapsed';

// ------------------------------------------------------------
// Sidebar component
// ------------------------------------------------------------

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  // Holds the Postgame logo URL once fetched from Supabase.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Whether the current viewer is staff (role !== 'athlete'), mirroring the
  // is_staff() DB helper. staffOnly nav links stay hidden until this is
  // confirmed true, so they never flash for a non-staff user.
  const [isStaff, setIsStaff] = useState(false);

  // Starts empty on both server and client render — everything open, no
  // hydration mismatch — then picks up the stored preference on mount.
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => {
    async function checkStaff() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (data && data.role !== 'athlete') setIsStaff(true);
    }
    checkStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the Postgame brand logo once when the sidebar mounts.
  // Brand ID is hardcoded — this is the Postgame brand's row in the
  // brands table, and it doesn't change.
  useEffect(() => {
    async function fetchLogo() {
      const { data } = await supabase
        .from('brands')
        .select('logo_primary_url')
        .eq('id', '7a0e28e9-d62f-427d-a207-cd22596fcf50')
        .single();
      if (data?.logo_primary_url) {
        setLogoUrl(data.logo_primary_url);
      }
    }
    fetchLogo();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCollapsed(parsed.filter((h) => typeof h === 'string'));
      }
    } catch {
      // Private browsing, blocked site data — fall back to everything open.
    }
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Clear the auth cookie so middleware redirects to login
    document.cookie = 'sb-auth-token=; path=/; max-age=0';
    router.push('/login');
  };

  const toggleGroup = (href: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href];
      try {
        window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // Preference is a convenience; failing to persist must not break the rail.
      }
      return next;
    });
  };

  // Exactly one link is active — the most specific match. See resolveActiveHref.
  const activeHref = resolveActiveHref(pathname);

  // A group holding the current path is forced open regardless of preference:
  // someone on a review page has to see where they are.
  const forcedOpen = groupsContaining(pathname);
  const isOpen = (href: string) => forcedOpen.includes(href) || !collapsed.includes(href);

  const visible = (link: NavLink) => !link.hidden && (!link.staffOnly || isStaff);

  const renderRow = (link: NavLink) => {
    const LinkIcon = ICONS[link.icon];
    const active = link.href === activeHref;
    return (
      <Link
        href={link.href}
        className={`flex flex-1 items-center gap-3 text-sm py-2 px-3 rounded-lg transition-colors min-w-0 ${
          active
            ? 'bg-white/10 text-white font-medium ring-1 ring-inset ring-white/15'
            : 'text-white/50 hover:text-white/80 hover:bg-white/5'
        }`}
      >
        <LinkIcon />
        <span className="truncate">{link.name}</span>
      </Link>
    );
  };

  const renderLink = (link: NavLink) => {
    const kids = (link.children ?? []).filter(visible);

    // Plain link.
    if (!kids.length) {
      return <div key={link.href + link.name} className="flex">{renderRow(link)}</div>;
    }

    // Collapsible group. The chevron and the label are separate targets — if
    // the whole row toggled, the parent page would be unreachable.
    const open = isOpen(link.href);
    return (
      <div key={link.href + link.name}>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => toggleGroup(link.href)}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${link.name}`}
            className="flex items-center justify-center w-6 h-8 -ml-1 text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
          >
            <span
              className={`inline-flex transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
            >
              <ChevronRightIcon />
            </span>
          </button>
          {renderRow(link)}
        </div>

        {open && (
          <div className="ml-[18px] pl-3 border-l border-white/[0.08] flex flex-col">
            {kids.map((child) => (
              <div key={child.href + child.name} className="flex">
                {renderRow(child)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (section: NavSection, idx: number) => {
    const links = section.links.filter(visible);
    if (!links.length) return null;
    return (
      <div key={section.label} className={idx === 0 ? 'mt-0' : 'mt-5'}>
        {/* Section band — the orange lives here, which is why the active state
            below is glass rather than orange: two orange cues compete. */}
        <div className="flex items-center gap-2 px-3 mb-1.5">
          <span className="block w-[3px] h-3 rounded-full bg-[#D73F09]" aria-hidden="true" />
          <span className="text-[10px] uppercase tracking-widest text-white/40">
            {section.label}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">{links.map(renderLink)}</div>
      </div>
    );
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-black border-r border-white/10 flex flex-col z-50">
     {/* Logo — pulls from Supabase. The mark is a file, never typography, so
         when the fetch fails we hold the row height with an empty box rather
         than falling back to a typed wordmark. A missing mark is acceptable;
         a typed one is not. */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/[0.08]">
        <Link href="/dashboard" className="flex items-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Postgame"
              className="h-7 w-auto object-contain"
            />
          ) : (
            <span className="block h-7" aria-hidden="true" />
          )}
        </Link>
      </div>

      {/* Scrollable navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {DASHBOARD_NAV.map((section, idx) => renderSection(section, idx))}
      </nav>

      {/* Sign Out — fixed at bottom */}
      <div className="px-3 py-3 border-t border-white/[0.08]">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 text-sm py-2 px-3 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors w-full"
        >
          <LogOutIcon />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
