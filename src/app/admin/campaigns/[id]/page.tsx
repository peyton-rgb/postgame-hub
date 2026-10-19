// ============================================================
// /admin/campaigns/[id] — the campaign hub (overview, setup status,
// athletes, content) is the next slice. Until it lands, opening a
// campaign goes straight to its edit screen.
// ============================================================

import { redirect } from "next/navigation";

export default function CampaignPage({ params }: { params: { id: string } }) {
  redirect(`/admin/campaigns/${params.id}/edit`);
}
