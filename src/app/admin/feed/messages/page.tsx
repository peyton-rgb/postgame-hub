// ============================================================
// /admin/feed/messages — Social · Messages (prototype
// S["social-messages"]). Instagram DMs to Postgame's connected
// accounts, one row per conversation (newest message first).
// Reads instagram_messages (migration 083). Reply from Instagram.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery } from "@/lib/admin/db";
import { ErrorNote } from "@/components/admin/ui";
import { Avatar, TablePending, timeAgo } from "@/components/admin/ops-bits";
import { SocialShell, socialView } from "@/components/admin/tools/social";
import { CardGrid, SimpleCard } from "@/components/admin/tools/bits";

export const dynamic = "force-dynamic";

interface MsgRow {
  id: string;
  ig_username: string | null;
  direction: string | null;
  sender_ig_id: string | null;
  recipient_ig_id: string | null;
  text: string | null;
  sent_at: string | null;
  received_at: string | null;
}

export default async function MessagesPage({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const view = socialView(searchParams, "rows");
  const supabase = createServiceSupabase();

  const res = await safeQuery<MsgRow[]>(() =>
    supabase
      .from("instagram_messages")
      .select("id, ig_username, direction, sender_ig_id, recipient_ig_id, text, sent_at, received_at")
      .order("received_at", { ascending: false })
      .limit(500)
  );

  // Group into conversations keyed by the other party's IG id.
  const convos = new Map<string, { other: string; last: MsgRow; count: number }>();
  for (const m of res.data ?? []) {
    const other = (m.direction === "outgoing" ? m.recipient_ig_id : m.sender_ig_id) ?? "unknown";
    const cur = convos.get(other);
    if (cur) cur.count += 1;
    else convos.set(other, { other, last: m, count: 1 });
  }
  const list = Array.from(convos.values());

  return (
    <SocialShell
      current="messages"
      view={res.pending ? undefined : view}
      foot={res.pending ? null : <span>{list.length} conversations · reply from Instagram for now</span>}
    >
      {res.pending ? (
        <TablePending table="instagram_messages" feature="Instagram DMs to Postgame's connected accounts" />
      ) : res.error ? (
        <div className="p-4">
          <ErrorNote message={res.error} />
        </div>
      ) : list.length === 0 ? (
        <div className="px-4 py-10 text-center text-[13px] text-stone-500">No messages yet.</div>
      ) : view === "cards" ? (
        <CardGrid>
          {list.map((c) => (
            <li key={c.other} className="min-w-0">
              <SimpleCard
                spec={{
                  icon: <Avatar name={c.other} />,
                  title: `IG user ${c.other}`,
                  subtitle: timeAgo(c.last.sent_at ?? c.last.received_at),
                  strip: (
                    <span className="line-clamp-2 text-stone-600">
                      {c.last.direction === "outgoing" ? "You: " : ""}
                      {c.last.text ?? "(attachment)"}
                    </span>
                  ),
                  foot: (
                    <span className="text-[12px] text-stone-500">
                      {c.count} message{c.count === 1 ? "" : "s"}
                    </span>
                  ),
                }}
              />
            </li>
          ))}
        </CardGrid>
      ) : (
        <div>
          {list.map((c) => (
            <div key={c.other} className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 last:border-0">
              <Avatar name={c.other} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-stone-900">IG user {c.other}</span>
                  <span className="shrink-0 text-[12px] text-stone-500">{timeAgo(c.last.sent_at ?? c.last.received_at)}</span>
                </div>
                <div className="truncate text-[12px] text-stone-500">
                  {c.last.direction === "outgoing" ? "You: " : ""}
                  {c.last.text ?? "(attachment)"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SocialShell>
  );
}
