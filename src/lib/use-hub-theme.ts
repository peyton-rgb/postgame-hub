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
import { createBrowserSupabase } from '@/lib/supabase';

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

// ============================================================
// Writing the theme.
//
// profiles.theme is the source of truth — dashboard/layout.tsx reads it
// server-side so the first paint is already correct. This writes all three
// places that need to agree, in the order that keeps the UI honest:
//
//   1. the data-theme attribute, so the flip is instant. The token layer keys
//      off it and useHubTheme's MutationObserver is watching, so every themed
//      surface and every logo variant follows without a reload.
//   2. localStorage, matching what ThemeMirror writes, so a client surface that
//      reads the mirror synchronously does not see a stale value until the next
//      server render.
//   3. profiles.theme, so the choice survives the reload.
//
// The attribute is set BEFORE the round-trip on purpose: a theme toggle that
// waits on the network to repaint feels broken. If the write fails the UI is
// briefly ahead of the database, and the server value wins on the next load —
// the same direction of truth ThemeMirror already documents. The failure is
// returned rather than swallowed so the caller can say so.
// ============================================================

function themedWrapper(): Element | null {
  return themeNode();
}

export async function setHubTheme(theme: HubTheme): Promise<{ ok: boolean; error?: string }> {
  themedWrapper()?.setAttribute('data-theme', theme);

  try {
    window.localStorage.setItem('pg-theme', theme);
  } catch {
    // Private mode or blocked site data. The attribute above already carries
    // the change, and the server value is authoritative anyway.
  }

  try {
    const supabase = createBrowserSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'not signed in' };

    const { error } = await supabase
      .from('profiles')
      .update({ theme })
      .eq('id', user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
