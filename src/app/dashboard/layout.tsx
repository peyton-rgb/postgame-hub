// ============================================================
// Dashboard Layout — wraps all /dashboard/* pages
//
// Uses DashboardShell to conditionally show the sidebar:
//   - Blueprint v2 pages → sidebar + content pushed right
//   - Pre-existing pages → no sidebar (they have their own)
//
// THEME. profiles.theme is read here, server-side, and written onto the wrapper
// as data-theme before the HTML is sent — so the correct palette is in the first
// paint and there is no flash of the wrong theme. The token layer in globals.css
// keys off [data-theme], and custom properties cascade, so putting the attribute
// on this wrapper themes every /dashboard route and nothing else.
//
// That scoping is the point: deliverables — recaps, pitch pages, portals — sit
// outside this layout and stay dark whatever a staff member picked. A client
// opening a recap sees the brand presentation, not someone's preference.
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
import ThemeMirror from '@/components/dashboard/ThemeMirror';
import { createServerSupabase } from '@/lib/supabase-server';

// Only these two are real; anything else in the column falls back to dark.
const THEMES = ['dark', 'light'] as const;

async function getTheme(): Promise<string> {
  try {
    const supabase = createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 'dark';

    const { data } = await supabase
      .from('profiles')
      .select('theme')
      .eq('id', user.id)
      .maybeSingle();

    const theme = (data as { theme?: string } | null)?.theme;
    return THEMES.includes(theme as (typeof THEMES)[number]) ? theme! : 'dark';
  } catch {
    // Never let a theme lookup take the dashboard down — dark is the default
    // and the existing appearance, so failing closed costs nothing.
    return 'dark';
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getTheme();

  return (
    <div data-theme={theme} className="min-h-screen bg-ground text-ink-1">
      <ThemeMirror theme={theme} />
      <StaffNotificationBell />
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
