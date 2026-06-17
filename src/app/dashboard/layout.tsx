// ============================================================
// Dashboard Layout — wraps all /dashboard/* pages
//
// Uses DashboardShell to conditionally show the sidebar:
//   - Blueprint v2 pages → sidebar + content pushed right
//   - Pre-existing pages → no sidebar (they have their own)
// ============================================================

import DashboardShell from '@/components/DashboardShell';
import StaffNotificationBell from '@/components/dashboard/StaffNotificationBell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <StaffNotificationBell />
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
