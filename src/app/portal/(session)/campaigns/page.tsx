import type { Metadata } from "next";
import SessionPortalShell from "@/components/portal/SessionPortalShell";
import CampaignsBody from "@/components/portal/CampaignsBody";

// SIGNED-IN door onto the portal's Campaigns tab (/portal/campaigns).
//
// Renders the exact same body component as the token door — the design
// is shared, not forked. The brand comes from the session's active
// attachment instead of a token; everything downstream is identical.
//
// (session) is a route group, so it does not appear in the URL and does
// NOT wrap /portal/[token], /portal/signup or /portal/denied.

export const dynamic = "force-dynamic";
// Access-deciding reads must never be answered from Next's Data Cache.
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Campaigns — Postgame",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  return <SessionPortalShell searchParams={searchParams} Body={CampaignsBody} />;
}
