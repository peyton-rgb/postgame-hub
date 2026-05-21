// ============================================================
// Public Nav — shared nav bar for all public-facing pages
//
// Used on /creator-brief/[slug], /review/[token], /deliver/[token].
// Two variants:
//   dark  — black bg, white text (for dark page backgrounds)
//   light — white bg, dark text (for light page backgrounds)
//
// Fixed to top of viewport so it stays visible on scroll.
// ============================================================

import Link from 'next/link';

interface PublicNavProps {
  variant?: 'dark' | 'light';
}

export default function PublicNav({ variant = 'dark' }: PublicNavProps) {
  const isDark = variant === 'dark';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 w-full px-6 py-4 flex items-center justify-between ${
        isDark
          ? 'bg-black/90 backdrop-blur-sm text-white border-b border-white/10'
          : 'bg-white/90 backdrop-blur-sm text-black border-b border-black/10'
      }`}
    >
      <Link
        href="/"
        className="text-sm font-medium tracking-[0.15em]"
      >
        P<span className="text-[#D73F09]">+</span>STGAME
      </Link>

      <div className="flex items-center gap-6">
        <Link
          href="/clients"
          className={`text-xs tracking-wider ${
            isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
          } transition-colors`}
        >
          Clients
        </Link>
        <Link
          href="/case-studies"
          className={`text-xs tracking-wider ${
            isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
          } transition-colors`}
        >
          Case Studies
        </Link>
        <Link
          href="/campaigns"
          className={`text-xs tracking-wider ${
            isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
          } transition-colors`}
        >
          Work
        </Link>
        <Link
          href="/press"
          className={`text-xs tracking-wider ${
            isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
          } transition-colors`}
        >
          Press
        </Link>
        <Link
          href="/about/team"
          className={`text-xs tracking-wider ${
            isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
          } transition-colors`}
        >
          About
        </Link>
      </div>
    </nav>
  );
}
