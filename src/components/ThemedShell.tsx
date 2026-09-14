// ============================================================
// ThemedShell — the one place the Hub's per-user theme is applied.
//
// Reads profiles.theme server-side and writes it onto a wrapper as data-theme
// before the HTML is sent, so the correct palette is in the first paint and
// there is no flash of the wrong theme. The token layer in globals.css keys off
// [data-theme], and custom properties cascade, so everything inside this wrapper
// is themed and nothing outside it is.
//
// That scoping is deliberate. Deliverables — recaps, pitch pages, portals — sit
// outside any ThemedShell and stay dark whatever a staff member picked: a client
// opening a recap sees the brand presentation, not someone's preference.
//
// WHY THIS IS A COMPONENT RATHER THAN JUST dashboard/layout.tsx. /packages and
// /media-library are staff surfaces that live OUTSIDE /dashboard, so they never
// got the attribute and rendered dark whatever the toggle said — their colours
// had been moved onto tokens, but no theme was ever set for those tokens to
// read. Copying the logic into two more layouts would have left three places to
// keep in step; this is the one place.
// ============================================================

import ThemeMirror from '@/components/dashboard/ThemeMirror';
import { createServerSupabase } from '@/lib/supabase-server';

// Only these two are real; anything else in the column falls back to dark.
const THEMES = ['dark', 'light'] as const;

export async function getHubTheme(): Promise<string> {
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
    // Never let a theme lookup take a page down — dark is the default and the
    // existing appearance, so failing closed costs nothing.
    return 'dark';
  }
}

export default async function ThemedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getHubTheme();

  return (
    <>
      {/* The wrapper below is min-h-screen, but <body> sits OUTSIDE it and keeps
          the :root (dark) ground — visible on overscroll bounce, and behind any
          short page. Painting body from the same channel primitives keeps the
          two in step. Scoped here, so public routes and deliverables are
          untouched and stay dark.
          Keyed on :has([data-theme]) rather than baked from the server value, so
          body follows a client-side flip too — the toggle changes the attribute,
          and a server-rendered literal would not have followed it.
          Known gap: anything portalled to document.body still renders outside
          the themed scope and will read the dark tokens. Moving data-theme onto
          <html> would fix that too, but the root layout is shared with the
          public site and must not inherit a staff preference. */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            'body:has([data-theme="light"]){background-color:rgb(var(--pg-off-white-rgb))}' +
            'body:has([data-theme="dark"]){background-color:rgb(var(--pg-black-rgb))}',
        }}
      />
      <div data-theme={theme} className="min-h-screen bg-ground text-ink-1">
        <ThemeMirror theme={theme} />
        {children}
      </div>
    </>
  );
}
