// ============================================================
// Manager notifications — fan-out to staff (in-app now, Slack in Phase 3)
//
// notifyManagers() is the SINGLE funnel for manager-facing events. It writes a
// row into the EXISTING notifications table for every staff user (role <>
// 'athlete') — surfaced in the staff bell/inbox — and (Phase 3) forwards the
// same event to Slack. Audience is tiny (admins), so per-user rows are fine.
//
// Follows the athlete-side pattern (notify.ts): related_campaign_id is NOT set
// (it FKs campaign_recaps, not optin_campaigns); the campaign lives in link_url.
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";
import { sendSlack, formatSlack } from "@/lib/slack";
import { getManagerOverview } from "@/lib/manager-overview";

export type ManagerEvent = {
  type: string;
  title: string;
  message?: string;
  linkUrl?: string;
  // context (used for Slack formatting; optional)
  athleteName?: string | null;
  brandName?: string | null;
  campaignTitle?: string | null;
};

export async function notifyManagers(ev: ManagerEvent): Promise<void> {
  const service = createServiceSupabase();

  const { data: staff, error } = await service.from("profiles").select("id").neq("role", "athlete");
  if (error) {
    console.error("notifyManagers: staff lookup failed:", error.message);
    return;
  }
  const rows = (staff ?? []).map((s: any) => ({
    user_id: s.id,
    notification_type: ev.type,
    title: ev.title,
    message: ev.message ?? null,
    link_url: ev.linkUrl ?? null,
  }));
  if (rows.length > 0) {
    const { error: insErr } = await service.from("notifications").insert(rows);
    if (insErr) console.error("notifyManagers: insert failed:", insErr.message);
  }

  // Phase 3: same event to Slack (no-op if SLACK_WEBHOOK_URL unset).
  try {
    await sendSlack(ev.type, formatSlack(ev));
  } catch (e: any) {
    console.error("notifyManagers: slack failed:", e?.message || e);
  }
}

// Deadline check — notify managers about live campaigns that are due soon or
// overdue with incomplete deliverables. Deduped: skips a campaign that already
// got a deadline notification in the last 24h. Meant to be called on a schedule
// (Vercel cron) — see /api/staff/manager/check-deadlines. Returns # sent.
export async function checkCampaignDeadlines(): Promise<number> {
  const service = createServiceSupabase();
  const { campaigns } = await getManagerOverview();
  const due = campaigns.filter((c) => (c.deadlineState === "soon" || c.deadlineState === "overdue") && c.incomplete > 0);
  if (due.length === 0) return 0;

  // Recent deadline notifications (last 24h) to dedupe against.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: recent } = await service
    .from("notifications")
    .select("link_url")
    .in("notification_type", ["deadline_soon", "deadline_passed"])
    .gte("created_at", since);
  const recentLinks = new Set((recent ?? []).map((r: any) => r.link_url));

  let sent = 0;
  for (const c of due) {
    const link = `/dashboard/athlete-deals?campaign=${c.id}`;
    if (recentLinks.has(link)) continue; // already nudged today
    const overdue = c.deadlineState === "overdue";
    await notifyManagers({
      type: overdue ? "deadline_passed" : "deadline_soon",
      title: overdue ? `Deadline passed — ${c.title}` : `Deadline approaching — ${c.title}`,
      message: `${c.brandName ? c.brandName + " · " : ""}${c.title} ${overdue ? "is past its deadline" : "is due soon"} with ${c.incomplete} deliverable${c.incomplete === 1 ? "" : "s"} still incomplete.`,
      linkUrl: link,
      brandName: c.brandName,
      campaignTitle: c.title,
    });
    sent++;
  }
  return sent;
}

// Build display context for a deal event (athlete name + brand + campaign +
// the filtered review-queue link). Best-effort; never throws.
export async function dealContext(athleteId: string, campaignId: string): Promise<{
  athleteName: string | null;
  brandName: string | null;
  campaignTitle: string | null;
  reviewLink: string;
}> {
  const service = createServiceSupabase();
  const [{ data: ath }, { data: camp }] = await Promise.all([
    service.from("profiles").select("full_name,email").eq("id", athleteId).maybeSingle(),
    service.from("optin_campaigns").select("title,brand:brands(name)").eq("id", campaignId).maybeSingle(),
  ]);
  const brand = camp ? (Array.isArray((camp as any).brand) ? (camp as any).brand[0] : (camp as any).brand) : null;
  return {
    athleteName: ath?.full_name || ath?.email || null,
    brandName: brand?.name ?? null,
    campaignTitle: (camp as any)?.title ?? null,
    reviewLink: `/dashboard/athlete-deals?campaign=${campaignId}`,
  };
}
