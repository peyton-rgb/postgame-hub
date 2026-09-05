'use client';

// ============================================================
// Read the active Hub theme from the DOM.
//
// The theme is server-rendered onto the dashboard wrapper as data-theme (see
// app/dashboard/layout.tsx), so it is already in the HTML before first paint.
// This hook just reads it back for the handful of client components that need
// to branch on it in JS rather than CSS — picking a brand logo file being the
// case that forced it, since you cannot choose between two image URLs in CSS
// without downloading both.
//
// Starts at "dark" so the first render matches what the server sent for the
// default, then corrects on mount if the wrapper says otherwise. That ordering
// avoids a hydration mismatch: the server has no DOM to read, so it must be a
// constant, and dark is the default the column carries.
//
// Follows later changes too — the toggle flips the attribute rather than
// reloading, so a MutationObserver keeps this in step.
// ============================================================

import { useEffect, useState } from 'react';
import type { HubTheme } from '@/lib/brand-logo';

function themeNode(): Element | null {
  if (typeof document === 'undefined') return null;
  // LAST match, not first. CSS resolves [data-theme] by the innermost ancestor,
  // and querySelector returns document order — so a stray attribute higher up
  // (the root <html>, say) would otherwise shadow the wrapper that carries the
  // real per-user value. Taking the last match matches the cascade.
  const all = document.querySelectorAll('[data-theme]');
  return all.length ? all[all.length - 1] : null;
}

function readTheme(): HubTheme {
  return themeNode()?.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function useHubTheme(): HubTheme {
  const [theme, setTheme] = useState<HubTheme>('dark');

  useEffect(() => {
    setTheme(readTheme());

    const el = themeNode();
    if (!el) return;

    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return theme;
}
