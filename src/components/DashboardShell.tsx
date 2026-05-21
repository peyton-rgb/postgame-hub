// ============================================================
// Dashboard Shell — conditionally renders sidebar
//
// The sidebar only appears on Blueprint v2 pages (the ones we
// built). Pre-existing pages (recaps, website editor, brands,
// etc.) already have their own sidebar built into the page, so
// we skip ours to avoid a double-sidebar situation.
// ============================================================

'use client';

import { usePathname } from 'next/navigation';
import DashboardSidebar from './DashboardSidebar';

// Blueprint v2 routes — these get our sidebar
const BLUEPRINT_ROUTES = [
  '/dashboard/briefs',
  '/dashboard/intake',
  '/dashboard/inspo',
  '/dashboard/ai-editing',
  '/dashboard/editing',
  '/dashboard/reviews',
  '/dashboard/assets',
  '/dashboard/captions',
  '/dashboard/publishing',
  '/dashboard/performance',
  '/dashboard/roi',
  '/dashboard/composer',
];

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Check if current path matches any Blueprint v2 route
  const showSidebar = BLUEPRINT_ROUTES.some((route) =>
    pathname?.startsWith(route)
  );

  if (!showSidebar) {
    // Pre-existing pages — render without our sidebar
    return <>{children}</>;
  }

  // Blueprint v2 pages — render with sidebar
  return (
    <>
      <DashboardSidebar />
      <main className="ml-[240px]">{children}</main>
    </>
  );
}
