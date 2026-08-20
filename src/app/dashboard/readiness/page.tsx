// ============================================================
// /dashboard/readiness — Campaign Readiness
//
// The Hub's landing page: one row per campaign showing what it still needs.
// Every icon is a link that opens the thing, or opens where you'd create it.
//
// Staff-gated with requireStaff(), matching the pattern already used by
// /dashboard/campaigns, /dashboard/athlete-deals and /dashboard/notifications.
// The middleware guard on /dashboard/:path* only excludes brand logins — it
// does not check role — so a page that is now the first screen of every session
// gates itself rather than relying on that.
//
// Data is read in bulk (7 queries for all 626 campaigns, no per-row lookups).
// ============================================================

import { requireStaff } from "@/lib/staff-auth";
import { getReadiness } from "@/lib/campaign-readiness-data";
import ReadinessClient from "@/components/readiness/ReadinessClient";

// Readiness reflects what was just edited elsewhere in the Hub; a cached
// landing page would show stale gaps.
export const dynamic = "force-dynamic";

export default async function ReadinessPage() {
  await requireStaff();
  const { rows, liveCount, totalCount } = await getReadiness();
  return <ReadinessClient rows={rows} liveCount={liveCount} totalCount={totalCount} />;
}
