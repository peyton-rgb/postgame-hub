'use client';

// ============================================================
// Mirrors the server-rendered theme into localStorage.
//
// The theme itself is applied server-side in dashboard/layout.tsx, so there is
// no flash — this component renders nothing and changes nothing on screen. It
// exists so a client-side surface can read the current choice synchronously
// without waiting on a profiles round-trip.
//
// Deliberately NOT the source of truth: profiles.theme is. If the two disagree
// the server value wins on the next load, which is why this only ever writes.
// ============================================================

import { useEffect } from 'react';

export default function ThemeMirror({ theme }: { theme: string }) {
  useEffect(() => {
    try {
      window.localStorage.setItem('pg-theme', theme);
    } catch {
      // Private mode, blocked site data, or a browser that throws on access.
      // The server-rendered attribute is already correct, so losing the mirror
      // costs nothing.
    }
  }, [theme]);

  return null;
}
