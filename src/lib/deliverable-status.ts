// ============================================================
// Deliverable status model — pure helpers (safe for client + server)
//
// Status flow per deliverable:
//   to_upload → uploaded → in_review → approved → to_post →
//   pending_verification → verified → paid   (+ changes_requested)
// A deal is only complete when ALL its deliverables reach verified/paid.
// ============================================================

export type DeliverableStatus =
  | "to_upload"
  | "uploaded"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "to_post"
  | "pending_verification"
  | "verified"
  | "paid";

export const SLOT_LABELS: Record<string, string> = {
  feed: "Feed post",
  reel: "Reel",
  story: "Story",
};

export function slotLabel(slot: string): string {
  return SLOT_LABELS[slot] || slot.charAt(0).toUpperCase() + slot.slice(1);
}

// Per-deliverable pill text + tone.
export function deliverablePill(status: DeliverableStatus): { text: string; kind: "due" | "ok" | "neutral" } {
  switch (status) {
    case "to_upload": return { text: "To upload", kind: "due" };
    case "uploaded": return { text: "Uploaded", kind: "ok" };
    case "in_review": return { text: "In review", kind: "neutral" };
    case "changes_requested": return { text: "Changes requested", kind: "due" };
    case "approved":
    case "to_post": return { text: "To post", kind: "due" };
    case "pending_verification": return { text: "Pending verification", kind: "neutral" };
    case "verified": return { text: "Verified", kind: "ok" };
    case "paid": return { text: "Paid", kind: "ok" };
    default: return { text: status, kind: "neutral" };
  }
}

// The deal's required slots, defaulting to feed + reel when unset.
export function getRequiredSlots(required: string[] | null | undefined): string[] {
  return required && required.length ? required : ["feed", "reel"];
}

const RANK: Record<DeliverableStatus, number> = {
  to_upload: 1,
  changes_requested: 1,
  uploaded: 2,
  in_review: 3,
  approved: 4,
  to_post: 4,
  pending_verification: 5,
  verified: 6,
  paid: 7,
};

export type DealStageKey =
  | "content_due"
  | "in_review"
  | "ready_to_post"
  | "awaiting_verification"
  | "verified"
  | "paid";

export type DealStage = {
  key: DealStageKey;
  pill: { text: string; kind: "due" | "ok" | "neutral" };
  // which of the 6 tracker steps are done, and which is current (0-indexed)
  doneThrough: number; // last completed step index
  currentStep: number; // step the athlete is on
};

export const TRACKER_STEPS = [
  { label: "Opted in", sub: "Confirmed to the brand" },
  { label: "Content due", sub: "Upload your content for approval" },
  { label: "Submitted", sub: "In review by Postgame + brand" },
  { label: "Approved", sub: "Greenlit by Postgame" },
  { label: "Post live", sub: "Post using your instructions" },
  { label: "Paid", sub: "After posting is verified" },
];

// Roll the deal up from its deliverables: a deal is only as far along as its
// LEAST-advanced deliverable.
export function computeDealStage(statuses: DeliverableStatus[]): DealStage {
  const minRank = statuses.length ? Math.min(...statuses.map((s) => RANK[s] ?? 1)) : 1;

  if (minRank <= 2) {
    return { key: "content_due", pill: { text: "Content due", kind: "due" }, doneThrough: 0, currentStep: 1 };
  }
  if (minRank === 3) {
    return { key: "in_review", pill: { text: "In review", kind: "neutral" }, doneThrough: 2, currentStep: 2 };
  }
  if (minRank === 4) {
    return { key: "ready_to_post", pill: { text: "Approved", kind: "ok" }, doneThrough: 3, currentStep: 4 };
  }
  if (minRank === 5) {
    return { key: "awaiting_verification", pill: { text: "Posted", kind: "due" }, doneThrough: 4, currentStep: 5 };
  }
  if (minRank === 6) {
    // All posts verified — payout is scheduled but not yet released.
    return { key: "verified", pill: { text: "Verified", kind: "ok" }, doneThrough: 4, currentStep: 5 };
  }
  return { key: "paid", pill: { text: "Paid", kind: "ok" }, doneThrough: 5, currentStep: 5 };
}
