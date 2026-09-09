// ============================================================
// Dashboard Layout — wraps all /dashboard/* pages
//
// Uses DashboardShell to conditionally show the sidebar:
//   - Blueprint v2 pages → sidebar + content pushed right
//   - Pre-existing pages → no sidebar (they have their own)
//
// THEME lives in ThemedShell, which reads profiles.theme server-side and sets
// data-theme on a wrapper. /packages and /media-library use the same component,
// so the resolution exists once rather than once per staff surface.
//
// This file does NO auth checking — it is presentation only. The staff boundary
// is carried by src/middleware.ts.
// ============================================================

import DashboardShell from '@/components/DashboardShell';
import StaffNotificationBell from '@/components/dashboard/StaffNotificationBell';
import ThemedShell from '@/components/ThemedShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemedShell>
      <StaffNotificationBell />
      <DashboardShell>{children}</DashboardShell>
    </ThemedShell>
  );
}
