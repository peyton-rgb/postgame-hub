// ============================================================
// Edit queue — /dashboard/edit-queue
//
// The receiving end of the review hub's "send to edit queue". Sibling screen
// to /dashboard/submission-forms/[token]/review and worked alongside it.
//
// Rendered full-bleed rather than inside a max-width wrapper, for the same
// reason the review hub is: the workspace it links to is a multi-column
// layout and the two screens share a shell.
// ============================================================

import EditQueueList from "@/components/edit-queue/EditQueueList";

export const dynamic = "force-dynamic";

export default function EditQueuePage() {
  return <EditQueueList />;
}
