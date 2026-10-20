// ============================================================
// /admin/notifications — Notifications (notifications.cfm rebuilt,
// restyled to the prototype's S.notifications: one card, All /
// Unread tabs, a list of alerts newest first). Source: the Hub's
// real notifications table. 50/page. Same data and links as before;
// Send and Unsubscribes keep their own routes.
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { PAGE_SIZE, pageRange } from "@/lib/admin/db";
import { PageHeader, Paginator, ErrorNote } from "@/components/admin/ui";
import { timeAgo } from "@/components/admin/ops-bits";
import { TabbedCard, btnCls } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

interface NoteRow {
  id: string;
  notification_type: string | null;
  title: string | null;
  message: string | null;
  link_url: string | null;
  is_read: boolean | null;
  created_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
}

export default async function NotificationsListPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const unread = searchParams.view === "unread";

  const { from, to } = pageRange(page);
  let list: any = supabase
    .from("notifications")
    .select("id, notification_type, title, message, link_url, is_read, created_at, profiles!user_id(full_name, email)")
    .order("created_at", { ascending: false })
    .range(from, to);
  let countQ: any = supabase.from("notifications").select("id", { count: "exact", head: true });
  if (unread) {
    list = list.not("is_read", "is", true);
    countQ = countQ.not("is_read", "is", true);
  }
  const [{ data, error }, { count }, { count: unreadCount }] = await Promise.all([
    list,
    countQ,
    supabase.from("notifications").select("id", { count: "exact", head: true }).not("is_read", "is", true),
  ]);

  const actions = (
    <>
      <Link href="/admin/notifications/unsubscribes" className={btnCls}>
        Unsubscribes
      </Link>
      <Link href="/admin/notifications/send" className={btnCls}>
        Send notification
      </Link>
    </>
  );

  if (error) {
    return (
      <div>
        <PageHeader title="Notifications" actions={actions} />
        <ErrorNote message={error.message} />
      </div>
    );
  }

  const rows = (data ?? []) as unknown as NoteRow[];

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Alerts from the Hub, newest first." actions={actions} />
      <TabbedCard
        tabs={[
          { href: "/admin/notifications", label: "All", active: !unread },
          { href: "/admin/notifications?view=unread", label: "Unread", count: unreadCount ?? null, active: unread },
        ]}
      >
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-stone-500">
            {unread ? "Nothing unread." : "No notifications yet."}
          </div>
        ) : (
          rows.map((r) => {
            const to = r.profiles?.full_name ?? r.profiles?.email ?? null;
            const inner = (
              <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-3 last:border-0">
                <span
                  className={"mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full " + (r.is_read ? "bg-stone-200" : "bg-[#D73F09]")}
                  title={r.is_read ? "Read" : "Unread"}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-stone-900">{r.title ?? r.notification_type ?? "Notification"}</div>
                  <div className="truncate text-[12px] text-stone-500">
                    {[to ? `To ${to}` : null, r.message].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <span className="shrink-0 text-[12px] text-stone-500">{timeAgo(r.created_at)}</span>
              </div>
            );
            return r.link_url ? (
              <a key={r.id} href={r.link_url} className="block hover:bg-stone-50/60">
                {inner}
              </a>
            ) : (
              <div key={r.id}>{inner}</div>
            );
          })
        )}
        <div className="border-t border-stone-200 px-3">
          <Paginator
            page={page}
            total={count ?? 0}
            pageSize={PAGE_SIZE}
            basePath="/admin/notifications"
            params={{ view: unread ? "unread" : undefined }}
          />
        </div>
      </TabbedCard>
    </div>
  );
}
