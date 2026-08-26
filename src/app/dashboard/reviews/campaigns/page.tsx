// ============================================================
// Reviews index — /dashboard/reviews/campaigns
//
// What needs Postgame's attention across every campaign that has a
// submission form. Each row opens that campaign in the review hub (#218),
// which is keyed by the form's token.
//
// Lives beside /dashboard/reviews rather than replacing it: that page is the
// athlete_deliverables review queue, a different pipeline with different
// tables, and whether the two ever converge is unresolved.
// ============================================================

import ReviewsIndex from "@/components/reviews/ReviewsIndex";

export const dynamic = "force-dynamic";

export default function ReviewsIndexPage() {
  return <ReviewsIndex />;
}
