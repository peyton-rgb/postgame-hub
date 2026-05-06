import type { Metadata } from "next";
import { Bebas_Neue } from "next/font/google";
import "./globals.css";
import "@/styles/motion.css";
// import SiteNav from "@/components/SiteNav";  // removed — site not public yet
import PageWrapper from "@/components/PageWrapper";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
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
    <html lang="en" className={bebasNeue.variable}>
      <body>
        <PageWrapper>
          {/* <SiteNav /> removed — site not public yet */}
          {children}
        </PageWrapper>
      </body>
    </html>
  );
}
