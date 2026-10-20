// ============================================================
// /admin/colleges — moved. The colleges list now lives on
// Schools & teams (/admin/schools). This redirect keeps old links
// and bookmarks working, carrying the search and page across.
// College edit (/admin/colleges/[id]/edit) and the alias mapper
// (/admin/colleges/mapper) stay where they are.
// ============================================================

import { redirect } from "next/navigation";

export default function CollegesRedirect({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = new URLSearchParams();
  if (searchParams.q) q.set("q", searchParams.q);
  if (searchParams.page) q.set("page", searchParams.page);
  const qs = q.toString();
  redirect(qs ? `/admin/schools?${qs}` : "/admin/schools");
}
