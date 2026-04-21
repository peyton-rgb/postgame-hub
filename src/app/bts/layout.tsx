import type { Metadata, Viewport } from "next";

/**
 * Public-route layout for /bts and any nested routes.
 *
 * The global SiteNav in the root layout is configured to hide itself on
 * /bts via its HIDDEN_ROUTES list, so this layout only has to provide a
 * mobile-friendly container. Font, body color, and global CSS tokens
 * come from the root layout (globals.css + next/font).
 */
export const metadata: Metadata = {
  title: "BTS Video Submission · Postgame",
  description: "Upload behind-the-scenes content to Postgame.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // prevent zoom-on-focus on iOS Safari for form inputs
  themeColor: "#000000",
};

export default function BtsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {children}
    </div>
  );
}
