// ============================================================
// Staff Settings — /dashboard/settings
//
// First settings page for the staff dashboard. Starts with one section
// (Appearance) but is built to hold more as they come up (notifications,
// account, etc.) — each just becomes another <section> below.
//
// Appearance moves the theme toggle here from the sidebar bottom (see
// DashboardSidebar.tsx). Reuses useHubTheme / setHubTheme from
// use-hub-theme.ts rather than re-implementing the read/write logic —
// that file already documents why it writes in the order it does
// (attribute -> localStorage -> profiles.theme).
// ============================================================

'use client';

import { useState } from 'react';
import { useHubTheme, setHubTheme } from '@/lib/use-hub-theme';

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

// A labelled two-option switch rather than the sidebar's single button —
// this page is the place someone comes to deliberately change a setting,
// so both states are visible at once instead of one being implied.
function AppearanceSetting() {
  const theme = useHubTheme();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(next: 'dark' | 'light') {
    if (next === theme || saving) return;
    setSaving(true);
    const res = await setHubTheme(next);
    setFailed(!res.ok);
    setSaving(false);
  }

  return (
    <section className="bg-surface-card border border-hairline-soft rounded-xl p-5">
      <h2 className="text-base font-semibold text-ink-1 mb-1">Appearance</h2>
      <p className="text-sm text-ink-4 mb-4">
        Choose how the Hub looks on this account. Your choice is saved and
        follows you the next time you sign in.
      </p>

      <div className="flex gap-3">
        <button
          onClick={() => choose('dark')}
          aria-pressed={theme === 'dark'}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
            theme === 'dark'
              ? 'border-accent bg-accent/10 text-ink-1'
              : 'border-hairline-soft text-ink-4 hover:text-ink-3 hover:bg-surface-raised'
          }`}
        >
          <MoonIcon />
          Dark
        </button>
        <button
          onClick={() => choose('light')}
          aria-pressed={theme === 'light'}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
            theme === 'light'
              ? 'border-accent bg-accent/10 text-ink-1'
              : 'border-hairline-soft text-ink-4 hover:text-ink-3 hover:bg-surface-raised'
          }`}
        >
          <SunIcon />
          Light
        </button>
      </div>

      {failed && (
        <p className="mt-3 text-xs text-accent">
          Couldn&apos;t save that — it will revert to your last saved choice on reload. Try again in a moment.
        </p>
      )}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-ground text-ink-1">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-1">Settings</h1>
        <p className="text-sm text-ink-4 mb-6">Manage your Hub account preferences.</p>

        <div className="flex flex-col gap-4">
          <AppearanceSetting />
        </div>
      </div>
    </div>
  );
}
