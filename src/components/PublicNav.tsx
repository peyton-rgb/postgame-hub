import Link from 'next/link';

interface PublicNavProps {
  variant?: 'dark' | 'light';
}

export default function PublicNav({ variant = 'dark' }: PublicNavProps) {
  const isDark = variant === 'dark';

  return (
    <nav
      className={`w-full px-6 py-4 flex items-center justify-between ${
        isDark
          ? 'bg-black/90 backdrop-blur-sm text-white border-b border-white/10'
          : 'bg-white text-black border-b border-black/10'
      }`}
    >
      <Link
        href="/"
        className="text-sm font-medium tracking-[0.15em]"
      >
        POSTGAME
      </Link>

      <div className="flex items-center gap-6">
        <a
          href="#"
          className={`text-xs tracking-wider ${
            isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
          } transition-colors`}
        >
          Work
        </a>
        <a
          href="#"
          className={`text-xs tracking-wider ${
            isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
          } transition-colors`}
        >
          Press
        </a>
        <a
          href="#"
          className={`text-xs tracking-wider ${
            isDark ? 'text-white/50 hover:text-white' : 'text-black/50 hover:text-black'
          } transition-colors`}
        >
          About
        </a>
      </div>
    </nav>
  );
}
