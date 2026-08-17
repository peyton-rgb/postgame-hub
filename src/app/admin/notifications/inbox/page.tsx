// ============================================================
// /admin/notifications/inbox — Inbox (inbox.cfm rebuilt; CF's was
// empty at crawl time). Unread-first view of Hub notifications.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { formatDate } from "@/lib/admin/db";
import { PageHeader } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();

  const { data } = await supabase
    .from("notifications")
    .select("id, notification_type, title, message, is_read, created_at, actor:profiles!actor_id(full_name, email)")
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as unknown as {
    id: string;
    notification_type: string | null;
    title: string | null;
    message: string | null;
    is_read: boolean | null;
    created_at: string | null;
    actor: { full_name: string | null; email: string | null } | null;
  }[];

  return (
    <div>
      <PageHeader title="Inbox" subtitle="Latest 50, unread first" />
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="Inbox zero — no notifications."
        rowWarn={(r) => !r.is_read}
        columns={[
          { key: "date", header: "Date", render: (r) => <span className="text-stone-500">{formatDate(r.created_at)}</span> },
          { key: "from", header: "From", render: (r) => r.actor?.full_name ?? r.actor?.email ?? "System" },
          {
            key: "message",
            header: "Message",
            render: (r) => (
              <span>
                <span className="font-medium text-stone-900">{r.title ?? ""}</span>
                <span className="ml-2 text-stone-500">{(r.message ?? "").slice(0, 100)}</span>
              </span>
            ),
          },
        ]}
        mobile={{
          title: (r) => r.title ?? "Notification",
          subtitle: (r) => r.actor?.full_name ?? "System",
          figure: (r) => formatDate(r.created_at),
        }}
      />
    </div>
  );
}
