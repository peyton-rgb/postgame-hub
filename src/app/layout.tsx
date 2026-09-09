import type { Metadata } from "next";
import { Anton, Arimo, Bebas_Neue, JetBrains_Mono } from "next/font/google";
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

// The design system is FOUR fonts and this is where all four are loaded, so a
// page never has to reach for a fifth or re-import one it already has.
//
//   Bebas Neue     display — hero lines, H1/H2, athlete names, card titles
//   Anton          heavy — campaign titles and stat figures ONLY
//   Arimo          body — everything read at length (Arial is its metric twin
//                  and the correct fallback, which is why body looked "fine"
//                  while Arimo was never actually loaded)
//   JetBrains Mono label — eyebrows, stat labels, captions, nav, buttons, tags
//
// Inter used to sit here as a fifth face, loaded on every public page in three
// weights and used on exactly one. It is gone; its single consumer now takes
// the body font.
const anton = Anton({
  weight: "400",            // Anton ships one weight only.
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
const arimo = Arimo({
  weight: ["400", "700"],   // 700 is the pull-quote cut.
  subsets: ["latin"],
  variable: "--font-arimo",
  display: "swap",
});
const mono = JetBrains_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
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
    <html lang="en" className={`${bebasNeue.variable} ${anton.variable} ${arimo.variable} ${mono.variable}`}>
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
