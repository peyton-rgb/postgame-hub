// ============================================================
// Notifications — athlete read helpers (service-role, session-scoped)
// ============================================================

import { createServiceSupabase } from "@/lib/supabase-server";

export type AppNotification = {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  link_url: string | null;
  is_read: boolean;
  created_at: string;
};

export async function getNotifications(athleteId: string, limit = 50): Promise<AppNotification[]> {
  const service = createServiceSupabase();
  const { data, error } = await service
    .from("notifications")
    .select("id,notification_type,title,message,link_url,is_read,created_at")
    .eq("user_id", athleteId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getNotifications error:", error.message);
    return [];
  }
  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(athleteId: string): Promise<number> {
  const service = createServiceSupabase();
  const { count, error } = await service
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", athleteId)
    .eq("is_read", false);
  if (error) {
    console.error("getUnreadCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function markAllRead(athleteId: string): Promise<void> {
  const service = createServiceSupabase();
  const { error } = await service
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", athleteId)
    .eq("is_read", false);
  if (error) console.error("markAllRead error:", error.message);
}
