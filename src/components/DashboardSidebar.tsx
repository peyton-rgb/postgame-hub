// ============================================================
// Unified Dashboard Sidebar — single nav for ALL /dashboard/* pages
//
// Combines the Blueprint v2 pipeline sections (Creative Brain,
// Production, Review, Distribution, Analytics) with the
// pre-existing Pages and Tools sections + Sign Out.
//
// This is the ONLY sidebar in the app — pre-existing pages
// no longer render their own.
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

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

// Case Studies (briefcase-style icon)
const BriefcaseIcon = () => (
  <Icon>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
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

// Tools
const FilesIcon = () => (
  <Icon>
    <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M3 7.6v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8" />
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

// Collapse chevron
const ChevronLeftIcon = () => (
  <Icon>
    <polyline points="15 18 9 12 15 6" />
  </Icon>
);

// ------------------------------------------------------------
// Navigation structure
// ------------------------------------------------------------

type NavLink = {
  name: string;
  href: string;
  icon: React.FC;
  staffOnly?: boolean; // hidden unless the viewer is staff (role !== 'athlete')
};

type NavSection = {
  label: string;
  links: NavLink[];
};

// Pipeline sections (Blueprint v2)
const PIPELINE_SECTIONS: NavSection[] = [
  {
    label: 'Creative Brain',
    links: [
      { name: 'Brand Briefs', href: '/dashboard/briefs', icon: FileTextIcon },
      { name: 'Inspo Library', href: '/dashboard/inspo', icon: SparklesIcon },
      { name: 'Intake', href: '/dashboard/intake', icon: UploadIcon },
    ],
  },
  {
    label: 'Production',
    links: [
      { name: 'AI Editing', href: '/dashboard/ai-editing', icon: WandIcon },
      { name: 'Manual Editing', href: '/dashboard/editing', icon: ScissorsIcon },
      { name: 'Composer', href: '/dashboard/composer', icon: GridIcon },
    ],
  },
  {
    label: 'Review',
    links: [
      { name: 'Brand Approval', href: '/dashboard/brand-approval', icon: CheckCircleIcon },
      { name: 'Athlete Deals', href: '/dashboard/athlete-deals', icon: UserCheckIcon, staffOnly: true },
      { name: 'Reviews', href: '/dashboard/reviews', icon: EyeIcon },
      { name: 'Final Assets', href: '/dashboard/assets', icon: PackageIcon },
    ],
  },
  {
    label: 'Distribution',
    links: [
      { name: 'Captions', href: '/dashboard/captions', icon: MessageIcon },
      { name: 'Publishing', href: '/dashboard/publishing', icon: CalendarIcon },
    ],
  },
  {
    label: 'Analytics',
    links: [
      { name: 'Performance', href: '/dashboard/performance', icon: BarChartIcon },
      { name: 'ROI', href: '/dashboard/roi', icon: DollarIcon },
    ],
  },
];

// Pages section (pre-existing pages)
const PAGES_SECTION: NavSection = {
  label: 'Pages',
  links: [
    { name: 'Recaps', href: '/dashboard/recaps', icon: PresentationIcon },
    { name: 'Performance Trackers', href: '/dashboard/performance-trackers', icon: TrendingUpIcon },
    { name: 'Run of Shows', href: '/dashboard/run-of-shows', icon: ListCheckIcon },
    { name: 'Legacy Briefs', href: '/dashboard/legacy-briefs', icon: NotebookIcon },
    { name: 'Pitches', href: '/dashboard/pitches', icon: StarIcon },
    { name: 'Newsletter', href: '/dashboard/newsletter', icon: MailIcon },
    { name: 'Campaign Instructions', href: '/dashboard/campaign-instructions', icon: ClipboardIcon },
    { name: 'Campaign Opt-In', href: '/dashboard/campaign-opt-in', icon: UserCheckIcon },
  ],
};

// Tools section (pre-existing tools)
const TOOLS_SECTION: NavSection = {
  label: 'Tools',
  links: [
    { name: 'Campaign Briefs', href: '/dashboard/campaign-briefs', icon: FilesIcon },
    { name: 'Brands', href: '/dashboard/brands', icon: BuildingIcon },
    { name: 'Brand Portals', href: '/dashboard/brand-portals', icon: ExternalLinkIcon },
    { name: 'Media Library', href: '/media-library', icon: PhotoIcon },
    { name: 'BTS Submissions', href: '/dashboard/bts', icon: CameraIcon },
    { name: 'Website Editor', href: '/dashboard/website', icon: BrowserIcon },
    { name: 'Campaign Pages', href: '/dashboard/website/campaigns', icon: PhotoIcon },
  ],
};

// ------------------------------------------------------------
// Sidebar component
// ------------------------------------------------------------

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createBrowserSupabase();

  // Holds the Postgame logo URL once fetched from Supabase.
  // Starts as null (nothing loaded yet) so we can fall back to the
  // text wordmark during loading or if the fetch fails.
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Whether the current viewer is staff (role !== 'athlete'), mirroring the
  // is_staff() DB helper. staffOnly nav links stay hidden until this is
  // confirmed true, so they never flash for a non-staff user.
  const [isStaff, setIsStaff] = useState(false);

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // Clear the auth cookie so middleware redirects to login
    document.cookie = 'sb-auth-token=; path=/; max-age=0';
    router.push('/login');
  };

  // Highlight a nav link when the current path matches
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname?.startsWith(href) ?? false;
  };

  const renderSection = (section: NavSection, idx: number) => (
    <div key={section.label}>
      <div
        className={`text-[10px] uppercase tracking-widest text-white/30 px-3 mb-1 ${
          idx === 0 ? 'mt-0' : 'mt-4'
        }`}
      >
        {section.label}
      </div>
      {section.links
        .filter((link) => !link.staffOnly || isStaff)
        .map((link) => {
        const active = isActive(link.href);
        const LinkIcon = link.icon;
        return (
          <Link
            key={link.href + link.name}
            href={link.href}
            className={`flex items-center gap-3 text-sm py-2 px-3 rounded-lg transition-colors ${
              active
                ? 'bg-[#D73F09]/15 text-[#D73F09] font-medium'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <LinkIcon />
            {link.name}
          </Link>
        );
      })}
    </div>
  );

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-black border-r border-white/10 flex flex-col z-50">
     {/* Logo / Wordmark — pulls from Supabase, falls back to wordmark */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/[0.08]">
        <Link href="/dashboard" className="flex items-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Postgame"
              className="h-7 w-auto object-contain"
            />
          ) : (
            <span className="text-white font-medium tracking-wider text-[15px]">
              P<span className="text-[#D73F09]">+</span>STGAME
            </span>
          )}
        </Link>
      </div>
    

      {/* Scrollable navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Pipeline sections */}
        {PIPELINE_SECTIONS.map((section, idx) => renderSection(section, idx))}

        {/* Divider */}
        <div className="h-px bg-white/[0.08] mx-2 my-3" />

        {/* Pages */}
        {renderSection(PAGES_SECTION, 0)}

        {/* Divider */}
        <div className="h-px bg-white/[0.08] mx-2 my-3" />

        {/* Tools */}
        {renderSection(TOOLS_SECTION, 0)}
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
