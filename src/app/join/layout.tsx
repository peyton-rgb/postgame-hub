// ============================================================
// /join/* — public opt-in pages. Dark, full-bleed, no marketing chrome.
//
// SiteNav hides itself by prefix list (HIDDEN_ROUTES in SiteNav.tsx);
// /join isn't on that list and that file is outside this slice, so the
// layout hides the nav with a scoped style until the list is updated.
// Fonts: Poppins (headlines) and Inter (body) — the athlete app's faces.
// ============================================================

import type { Viewport } from "next";
import { Inter, Poppins } from "next/font/google";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0C0C10",
};

const poppins = Poppins({ weight: ["600", "700", "800"], subsets: ["latin"], variable: "--font-poppins", display: "swap" });
const inter = Inter({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--font-inter", display: "swap" });

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${poppins.variable} ${inter.variable}`} style={{ minHeight: "100vh", background: "#0C0C10", color: "#F8F8F9" }}>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: "nav.pg-nav{display:none!important}body{background:#0C0C10}" }} />
      {children}
    </div>
  );
}
