// /packages — the staff Editor Asset Packages index.
//
// This route sits OUTSIDE /dashboard, so it never picked up the data-theme
// attribute that layout sets, and rendered dark whatever the toggle said. Its
// colours were already on tokens; what was missing was a theme for those tokens
// to read. ThemedShell is the same component /dashboard uses.
//
// Presentation only — the staff boundary is carried by src/middleware.ts, which
// already matches this route.
import ThemedShell from '@/components/ThemedShell';

export default function PackagesLayout({ children }: { children: React.ReactNode }) {
  return <ThemedShell>{children}</ThemedShell>;
}
