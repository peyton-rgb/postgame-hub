// ============================================================
// Public videographer upload — shell
//
// Reuses the athlete app's scoped dark "Liquid Glass" styling but is fully
// public (no auth, no nav). The marketing SiteNav is hidden on /v via
// SiteNav's HIDDEN_ROUTES.
// ============================================================

import "../athlete/athlete.css";

export default function VideographerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="athlete-app">
      <div className="a-frame">{children}</div>
    </div>
  );
}
