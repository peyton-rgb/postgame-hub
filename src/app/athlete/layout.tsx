// ============================================================
// Athlete App — root shell
//
// Wraps EVERY /athlete/* route (auth pages + the tab-bar app) in the
// scoped dark "Liquid Glass" frame. Auth gating happens deeper:
//   - the (app) route group enforces logged-in + athlete role
//   - login / signup / onboarding handle their own access
// The marketing SiteNav is hidden on /athlete via SiteNav's HIDDEN_ROUTES.
// ============================================================

import "./athlete.css";

export default function AthleteRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="athlete-app">
      <div className="a-frame">{children}</div>
    </div>
  );
}
