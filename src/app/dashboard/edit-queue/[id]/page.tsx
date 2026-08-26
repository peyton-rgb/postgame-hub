// ============================================================
// One edit job — /dashboard/edit-queue/[id]
//
// [id] is the edit_jobs row id. Staff-only; the API behind it enforces that,
// and the workspace renders nothing without it.
// ============================================================

import EditJobWorkspace from "@/components/edit-queue/EditJobWorkspace";

export const dynamic = "force-dynamic";

export default function EditJobPage({ params }: { params: { id: string } }) {
  return <EditJobWorkspace jobId={params.id} />;
}
