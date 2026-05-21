// ============================================================
// Dashboard Layout — wraps all /dashboard/* pages
//
// Provides:
//   - Fixed sidebar navigation (DashboardSidebar)
//   - Main content area pushed right by sidebar width (240px)
//   - Consistent dark background
// ============================================================

import DashboardSidebar from '@/components/DashboardSidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <DashboardSidebar />
      <main className="ml-[240px]">
        {children}
      </main>
    </div>
  );
}
