import type { Metadata } from "next";
import { Bebas_Neue } from "next/font/google";
import "./globals.css";
import SiteNav from "@/components/SiteNav";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Postgame — The #1 NIL Agency",
  description: "Connecting elite college athletes with the world's most ambitious brands.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={bebasNeue.variable}>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
