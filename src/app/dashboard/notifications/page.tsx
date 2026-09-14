// ============================================================
// Staff notifications inbox (staff-only)
//
// Reuses the same notifications table + helpers as the athlete bell. Lists the
// staff user's notifications and marks them read on view; each links to the
// relevant review page.
// ============================================================

import Link from "next/link";
import { requireStaff } from "@/lib/staff-auth";
import { getNotifications, markAllRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default async function StaffNotificationsPage() {
  const staff = await requireStaff();
  const items = await getNotifications(staff.id);
  await markAllRead(staff.id);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 60px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--ink-1)", marginBottom: 4 }}>Notifications</h1>
      <p style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 20 }}>Things that need a manager across the athlete pipeline.</p>

      {items.length === 0 ? (
        <div style={{ background: "var(--surface-card)", border: "1px solid var(--surface-raised)", borderRadius: 14, padding: 24, fontSize: 13, color: "var(--ink-4)" }}>
          All caught up. Submissions, posts awaiting verification, compliance flags, and deadline alerts show up here.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((n) => {
            const inner = (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--surface-card)", border: `1px solid ${n.is_read ? "var(--surface-raised)" : "var(--accent-dim)"}`, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-1)", flex: "none", fontWeight: 700 }}>P</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, color: "var(--ink-1)", fontWeight: 700 }}>{n.title}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-4)", flex: "none" }}>{timeAgo(n.created_at)}</span>
                  </div>
                  {n.message && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{n.message}</div>}
                </div>
              </div>
            );
            return n.link_url ? (
              <Link key={n.id} href={n.link_url} style={{ textDecoration: "none", color: "inherit" }}>{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
