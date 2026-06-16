// ============================================================
// Notifications inbox (mockup screens 8/9, in-app)
//
// Lists the athlete's notifications and marks them read on view. Each links
// to the next step (deal, earnings, etc.).
//
// Note: these are IN-APP notifications. Native push (lock-screen) needs APNs/
// FCM + a native wrapper — out of scope here; see TODO in the orientation doc.
// ============================================================

import Link from "next/link";
import { requireAthlete } from "@/lib/athlete-auth";
import { getNotifications, markAllRead } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default async function NotificationsPage() {
  const profile = await requireAthlete();
  const items = await getNotifications(profile.id);
  // Mark read after fetching so unread styling shows once, then clears.
  await markAllRead(profile.id);

  return (
    <div style={{ padding: "10px 18px 0" }}>
      <div className="a-d" style={{ fontSize: 26, padding: "4px 0 16px" }}>NOTIFICATIONS</div>

      {items.length === 0 ? (
        <div className="a-card" style={{ textAlign: "center", padding: "34px 18px" }}>
          <div className="a-d" style={{ fontSize: 20 }}>ALL CAUGHT UP</div>
          <p className="a-muted" style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
            New deals and updates on your content — approvals, posting reminders, payouts — show up here.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((n) => {
            const inner = (
              <div className="a-card" style={{ display: "flex", gap: 11, alignItems: "flex-start", borderColor: n.is_read ? "rgba(255,255,255,0.09)" : "rgba(215,63,9,0.4)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--a-orange)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flex: "none" }} className="a-d">
                  <span style={{ fontSize: 18 }}>P</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--a-off)", fontWeight: 700 }}>{n.title}</span>
                    <span className="a-muted" style={{ fontSize: 11, flex: "none" }}>{timeAgo(n.created_at)}</span>
                  </div>
                  {n.message && <div style={{ fontSize: 12, color: "rgba(250,248,245,0.72)", lineHeight: 1.4, marginTop: 2 }}>{n.message}</div>}
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
