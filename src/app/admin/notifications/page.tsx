// ============================================================
// /admin/notifications — Notifications list (notifications.cfm
// rebuilt). Source: the Hub's real notifications table. 50/page.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, formatDate, pageRange } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import AdminTable from "@/components/admin/AdminTable";

export const dynamic = "force-dynamic";

export default async function NotificationsListPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);

  const { from, to } = pageRange(page);
  const [{ data, error }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, notification_type, title, message, link_url, is_read, created_at, profiles!user_id(full_name, email)")
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase.from("notifications").select("id", { count: "exact", head: true }),
  ]);

  if (error) {
    return (
      <div>
        <PageHeader title="Notifications" />
        <ErrorNote message={error.message} />
      </div>
    );
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    notification_type: string | null;
    title: string | null;
    message: string | null;
    link_url: string | null;
    is_read: boolean | null;
    created_at: string | null;
    profiles: { full_name: string | null; email: string | null } | null;
  }[];

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle={`${(count ?? 0).toLocaleString()} in-app notifications sent through the Hub`}
      />
      <AdminTable
        rows={rows}
        rowKey={(r) => r.id}
        emptyLabel="No notifications yet."
        columns={[
          { key: "date", header: "Date", render: (r) => <span className="text-stone-500">{formatDate(r.created_at)}</span> },
          {
            key: "to",
            header: "To",
            render: (r) => r.profiles?.full_name ?? r.profiles?.email ?? "—",
          },
          { key: "type", header: "Type", secondary: true, render: (r) => r.notification_type ?? "—" },
          {
            key: "title",
            header: "Title / Message",
            render: (r) => (
              <span>
                <span className="font-medium text-stone-900">{r.title ?? ""}</span>
                <span className="ml-2 text-stone-500">{(r.message ?? "").slice(0, 80)}</span>
              </span>
            ),
          },
          {
            key: "read",
            header: "Read",
            align: "center",
            render: (r) => (r.is_read ? <span className="text-green-600">✓</span> : <span className="text-stone-400">—</span>),
          },
        ]}
        mobile={{
          title: (r) => r.title ?? r.notification_type ?? "Notification",
          subtitle: (r) => r.profiles?.full_name ?? r.profiles?.email ?? "",
          figure: (r) => formatDate(r.created_at),
        }}
      />
      <Paginator page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/admin/notifications" params={{}} />
    </div>
  );
}
