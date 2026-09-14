'use client';

// ============================================================
// The Postgame mark, picking its ink from the active theme.
//
// PostgameLogo takes an explicit `ink` and defaults to the white mark, which is
// right for the surfaces it was written for — recaps, pitch pages and the public
// site are dark whatever a staff member picked. This wrapper is for the STAFF
// surfaces that follow the toggle, where the white mark on a light bar is simply
// invisible (which is what /media-library's header was doing).
//
// It is a separate component rather than an `ink="auto"` option on PostgameLogo
// because a hook cannot be called conditionally: folding it in would run a
// MutationObserver inside every recap and pitch page that renders the mark, none
// of which are themed. Opt in here, pay for it here.
//
// The ink name is the INK, not the ground — the same inversion the brand-logo
// columns use. Light theme => dark mark.
// ============================================================

import { PostgameLogo } from '@/components/PostgameLogo';
import { useHubTheme } from '@/lib/use-hub-theme';

export function PostgameLogoAuto({
  className = '',
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  const theme = useHubTheme();
  return (
    <PostgameLogo size={size} className={className} ink={theme === 'light' ? 'dark' : 'light'} />
  );
}
