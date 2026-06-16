// ============================================================
// Notifications — server-side emit helper
//
// Writes to the existing public.notifications table (athletes read their own
// via RLS). Used for next-step nudges (content approved, changes requested,
// post verified, payout scheduled). The "new deal dropped" broadcast is a DB
// trigger (see migration 005).
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";

export async function notifyAthlete(
  athleteId: string,
  opts: { type: string; title: string; message?: string; linkUrl?: string; campaignId?: string }
): Promise<void> {
  const service = createServiceSupabase();
  const { error } = await service.from("notifications").insert({
    user_id: athleteId,
    notification_type: opts.type,
    title: opts.title,
    message: opts.message ?? null,
    link_url: opts.linkUrl ?? null,
    related_campaign_id: opts.campaignId ?? null,
  });
  if (error) console.error("notifyAthlete error:", error.message);
}
