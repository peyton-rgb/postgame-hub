// ============================================================
// Athlete App — root shell
//
// Wraps EVERY /athlete/* route (auth pages + the tab-bar app) in the
// scoped dark "Liquid Glass" frame. Auth gating happens deeper:
//   - the (app) route group enforces logged-in + athlete role
//   - login / signup / onboarding handle their own access
// The marketing SiteNav is hidden on /athlete via SiteNav's HIDDEN_ROUTES.
// ============================================================

import { Anton } from "next/font/google";
import "./athlete.css";

// Anton (heavy button/label face) scoped to the athlete app only. Bebas Neue
// (display) is already loaded globally as --font-bebas by the root layout;
// Arial is the body face. We attach Anton's CSS variable to the athlete
// wrapper so it never leaks into the marketing site or staff dashboard.
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

export default function AthleteRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`athlete-app ${anton.variable}`}>
      <div className="a-frame">{children}</div>
    </div>
  );
}
