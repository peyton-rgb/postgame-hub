import type { Metadata, Viewport } from "next";

/**
 * Route-scoped chrome for the Blind Rank camera page.
 *
 * All of this lives in a nested layout rather than the root one on purpose: the
 * root layout feeds every other surface in the Hub, and none of what follows —
 * standalone display, a locked viewport, a dark theme-color, an installable
 * manifest — should apply anywhere else. Next merges nested metadata over the
 * root's, and the root sets no viewport or themeColor, so nothing is overridden.
 *
 * The page itself is a client component and cannot export metadata, which is the
 * other reason this file exists.
 */

export const metadata: Metadata = {
  title: "Blind Rank",
  description: "Film yourself ranking all 7 McDonald's drinks.",
  manifest: "/quiz/mcd-blind-rank-cam/manifest.webmanifest",
  // iOS Safari mostly ignores the manifest's display mode for Add to Home
  // Screen and reads these instead, so both are declared.
  appleWebApp: {
    capable: true,
    title: "Blind Rank",
    // Lets the page paint under the status bar for a genuinely full-screen feel;
    // the layout pads for it via env(safe-area-inset-*).
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/quiz/mcd-blind-rank-cam/effect_icon.png",
    apple: "/quiz/mcd-blind-rank-cam/effect_icon.png",
  },
  // A filming tool, not a page anyone should land on from search.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom off: a stray two-finger gesture mid-take would otherwise scale the
  // viewfinder. Deliberately scoped to this route only — it is a poor default for
  // ordinary pages.
  maximumScale: 1,
  userScalable: false,
  // Paint into the notch/home-indicator area; the page insets its own chrome.
  viewportFit: "cover",
  themeColor: "#07070A",
};

export default function BlindRankCamLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
