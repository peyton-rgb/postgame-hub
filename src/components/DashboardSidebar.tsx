'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_SECTIONS = [
  {
    label: 'Creative',
    links: [
      { name: 'Brand Briefs', href: '/dashboard/briefs' },
      { name: 'Intake', href: '/dashboard/intake' },
      { name: 'Inspo Library', href: '/dashboard/inspo' },
    ],
  },
  {
    label: 'Production',
    links: [
      { name: 'AI Editing', href: '/dashboard/ai-editing' },
      { name: 'Manual Editing', href: '/dashboard/editing' },
      { name: 'Composer', href: '/dashboard/composer' },
    ],
  },
  {
    label: 'Review',
    links: [
      { name: 'Approvals', href: '/dashboard/reviews' },
      { name: 'Final Assets', href: '/dashboard/assets' },
    ],
  },
  {
    label: 'Distribution',
    links: [
      { name: 'Captions', href: '/dashboard/captions' },
      { name: 'Publishing', href: '/dashboard/publishing' },
    ],
  },
  {
    label: 'Analytics',
    links: [
      { name: 'Performance', href: '/dashboard/performance' },
      { name: 'ROI', href: '/dashboard/roi' },
    ],
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-[240px] bg-black border-r border-white/10 flex flex-col z-50">
      {/* Wordmark */}
      <div className="px-5 pt-6 pb-4">
        <span className="text-white font-medium tracking-wider text-sm">
          POSTGAME
        </span>
        <Link
          href="/dashboard"
          className="block text-white/40 text-xs mt-0.5 hover:text-white/60 transition-colors"
        >
          Dashboard
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div key={section.label}>
            <div
              className={`text-[10px] uppercase tracking-widest text-white/30 px-3 mb-2 ${
                sectionIdx === 0 ? 'mt-0' : 'mt-5'
              }`}
            >
              {section.label}
            </div>
            {section.links.map((link) => {
              const isActive = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block text-sm py-2 px-3 rounded-md transition-colors ${
                    isActive
                      ? 'bg-[#D73F09]/15 text-[#D73F09] font-medium'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
