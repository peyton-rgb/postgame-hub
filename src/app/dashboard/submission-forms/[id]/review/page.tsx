// ============================================================
// Submission review hub — /dashboard/submission-forms/[id]/review
//
// [id] is the link TOKEN, not an id — the same convention as the parent
// route and as ./review/[submissionId]. That is what the list has always
// linked with; it is not a bug to be tidied up.
//
// This is the campaign-wide hub: every athlete on the form, and the review
// workspace for one of them. The sibling ./review/[submissionId] route is
// the older per-file AI-editing surface and is left alone.
//
// Rendered full-bleed rather than inside DashboardContent: the workspace is
// a fixed three-column layout and max-w-6xl would leave the stage — the one
// column whose whole job is showing the photo large enough to judge —
// narrower than the two rails beside it.
// ============================================================

import ReviewHub from "@/components/submission-forms/ReviewHub";

export default function SubmissionReviewHub({ params }: { params: { id: string } }) {
  return <ReviewHub token={params.id} />;
}
