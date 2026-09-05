import type { Metadata } from "next";
import { Bebas_Neue, Inter, Arimo } from "next/font/google";
import "./globals.css";
import "@/styles/motion.css";
import SiteNav from "@/components/SiteNav";
import PageWrapper from "@/components/PageWrapper";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

// Inter for body copy on editorial campaign pages. Kept: those are
// client-facing and out of scope for the Hub theming pass.
const inter = Inter({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
// Arimo carries body AND labels — labels are Arimo Bold uppercase letterspaced
// .16em, not a third family. It also fills --font-mono so the 166 existing
// font-mono call sites resolve to Arimo instead of the browser default while
// they are migrated. JetBrains Mono is removed.
const arimo = Arimo({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-arimo",
  display: "swap",
});

export const metadata: Metadata = {
  // metadataBase lets the openGraph image below be set as a relative URL —
  // Next.js prepends this base when rendering the absolute og:image URL
  // that iMessage / Slack / etc. need. Override via NEXT_PUBLIC_SITE_URL
  // in env if you switch to a custom domain.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://postgame-hub.vercel.app",
  ),
  title: "Postgame — The #1 NIL Agency",
  description:
    "Connecting elite college athletes with the world's most ambitious brands.",
  // openGraph controls the link preview shown by iMessage, Slack, Twitter,
  // LinkedIn, Discord, Facebook, etc. when someone shares a Postgame URL.
  // The 1200×630 og-default.png is the Postgame logo on a black field —
  // brand-clean and not athlete-specific.
  openGraph: {
    title: "Postgame — The #1 NIL Agency",
    description:
      "Connecting elite college athletes with the world's most ambitious brands.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Postgame — The #1 NIL Agency",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Postgame — The #1 NIL Agency",
    description:
      "Connecting elite college athletes with the world's most ambitious brands.",
    images: ["/og-default.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${bebasNeue.variable} ${inter.variable} ${arimo.variable}`}>
      <body>
        <PageWrapper>
          {/* SiteNav hides itself on /dashboard, /login, /recap, /pitch, etc.
              via its own HIDDEN_ROUTES check. */}
          <SiteNav />
          {children}
        </PageWrapper>
      </body>
    </html>
  );
}
