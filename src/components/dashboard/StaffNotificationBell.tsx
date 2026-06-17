// Staff notification bell (server component) — fixed top-right on the
// dashboard. Shows the staff user's unread count, links to the inbox. Renders
// nothing for non-staff / logged-out (the dashboard pages gate access anyway).

import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { getUnreadCount } from "@/lib/notifications";

export default async function StaffNotificationBell() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "athlete") return null;

  const unread = await getUnreadCount(user.id);

  return (
    <Link
      href="/dashboard/notifications"
      aria-label="Notifications"
      style={{ position: "fixed", top: 16, right: 20, zIndex: 60, display: "flex", color: "#fff", background: "rgba(20,20,22,0.9)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: 9 }}
    >
      <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "currentColor", strokeWidth: 1.8, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "#D73F09", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
