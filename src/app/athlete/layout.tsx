// ============================================================
// Athlete App — root shell
//
// Wraps EVERY /athlete/* route (auth pages + the tab-bar app) in the
// scoped dark "Liquid Glass" frame. Auth gating happens deeper:
//   - the (app) route group enforces logged-in + athlete role
//   - login / signup / onboarding handle their own access
// The marketing SiteNav is hidden on /athlete via SiteNav's HIDDEN_ROUTES.
// ============================================================

import type { Viewport } from "next";
import { Anton } from "next/font/google";
import "./athlete.css";

// Scope the mobile viewport to the athlete app so real iPhones render at
// device width (no load-zoomed-out / pinch-to-fit) and the env() safe-area
// insets used by the header + dock resolve on notched devices.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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
