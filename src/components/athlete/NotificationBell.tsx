// Header bell with an unread badge (server component). Links to the
// notifications inbox.

import Link from "next/link";
import { getUnreadCount } from "@/lib/notifications";

export default async function NotificationBell({ athleteId }: { athleteId: string }) {
  const unread = await getUnreadCount(athleteId);
  return (
    <Link href="/athlete/notifications" style={{ position: "relative", display: "flex", color: "var(--a-off)" }} aria-label="Notifications">
      <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, stroke: "currentColor", strokeWidth: 1.8, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span style={{ position: "absolute", top: -4, right: -5, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--a-orange)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
