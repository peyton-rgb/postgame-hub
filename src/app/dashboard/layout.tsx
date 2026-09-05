// ============================================================
// Dashboard Layout — wraps all /dashboard/* pages
//
// Uses DashboardShell to conditionally show the sidebar:
//   - Blueprint v2 pages → sidebar + content pushed right
//   - Pre-existing pages → no sidebar (they have their own)
//
// Ground and ink are ROLES, not literals — this wrapper sets the default for
// every /dashboard route, so a literal here would pin all of them to one theme.
// Was bg-[#0a0a0a] (not the brand ground, #07070A) and text-white (pure white,
// not the #FAF8F5 ink role).
//
// This file does NO auth checking — it is presentation only. The staff boundary
// is carried by src/middleware.ts.
// ============================================================

import DashboardShell from '@/components/DashboardShell';
import StaffNotificationBell from '@/components/dashboard/StaffNotificationBell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ground text-ink-1">
      <StaffNotificationBell />
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
