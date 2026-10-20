// ============================================================
// /signup — public "which kind of account?" surfaces.
//
// Dark app style, reusing the athlete app's scoped design system
// (src/app/athlete/athlete.css: .athlete-app / .a-* classes) rather than
// a second copy of the same frosted-glass rules. Everything is scoped
// under .athlete-app, so importing it here leaks nothing into the
// marketing site that shares the root layout.
//
// The Postgame mark is the light-ink file from the brands table.
// ============================================================

import type { Viewport } from "next";
import Link from "next/link";
import { getPostgameLogos } from "@/lib/signup/postgameLogo";
import "@/app/athlete/athlete.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  title: "Join Postgame",
  robots: { index: false, follow: false },
};

export default async function SignupLayout({ children }: { children: React.ReactNode }) {
  const logos = await getPostgameLogos();
  return (
    <div className="athlete-app">
      {/* The marketing SiteNav is mounted by the root layout and hides itself
          by prefix (HIDDEN_ROUTES in src/components/SiteNav.tsx). That file is
          outside this branch, so /signup hides it locally until "/signup" is
          added there. */}
      <style>{`.pg-nav{display:none !important}`}</style>
      <div className="a-frame" style={{ padding: "0 22px" }}>
        <div style={{ textAlign: "center", padding: "34px 0 6px" }}>
          <Link href="/signup" aria-label="Postgame">
            <img src={logos.onDark} alt="Postgame" style={{ height: 30, width: "auto", objectFit: "contain", display: "inline-block" }} />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
