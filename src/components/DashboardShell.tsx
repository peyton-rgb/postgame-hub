// ============================================================
// Dashboard Shell — renders the unified sidebar on ALL
// /dashboard/* pages.
//
// The <style> tag below handles the "double sidebar" problem:
// Pre-existing pages (Recaps, Website Editor, Brands, etc.)
// have their own sidebar built into the page component. Instead
// of modifying every one of those files, we use CSS to:
//   1. Hide any <aside> nested inside our <main> content area
//   2. Reset the ml-60 (240px) margin on any nested <main>
//   3. Remove the min-h-screen from nested wrappers (layout
//      already provides it)
//
// This way the pre-existing pages render their content only,
// and our unified sidebar handles all the navigation.
// ============================================================

'use client';

import DashboardSidebar from './DashboardSidebar';

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DashboardSidebar />

      {/* Override styles to suppress old sidebar in pre-existing pages */}
      <style jsx global>{`
        .dashboard-content aside {
          display: none !important;
        }
        .dashboard-content > div > main {
          margin-left: 0 !important;
          width: 100% !important;
        }
        .dashboard-content > .min-h-screen {
          min-height: auto !important;
        }
      `}</style>

      <main className="ml-[240px] dashboard-content">{children}</main>
    </>
  );
}
