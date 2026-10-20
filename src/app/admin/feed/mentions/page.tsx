// ============================================================
// /admin/feed/mentions — Social · Mentions (prototype
// S["social-mentions"]). Reads postgame_mentions (migration 083),
// filled by the Instagram mentions webhook.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { ErrorNote } from "@/components/admin/ui";
import { TablePending, Toolbar, timeAgo } from "@/components/admin/ops-bits";
import { SocialShell, PostGrid } from "@/components/admin/tools/social";

export const dynamic = "force-dynamic";

interface MentionRow {
  id: string;
  username: string | null;
  permalink: string | null;
  media_url: string | null;
  like_count: number | null;
  received_at: string | null;
}

export default async function MentionsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const q = sanitizeFilterValue(searchParams.q ?? "");

  const res = await safeQuery<MentionRow[]>(() => {
    let query = supabase
      .from("postgame_mentions")
      .select("id, username, permalink, media_url, like_count, received_at")
      .order("received_at", { ascending: false })
      .limit(60);
    if (q) query = query.ilike("caption", `%${q}%`);
    return query;
  });
  const rows = res.data ?? [];

  return (
    <SocialShell current="mentions" foot={res.pending ? null : <span>Showing {rows.length} newest mentions</span>}>
      {res.pending ? (
        <TablePending table="postgame_mentions" feature="Posts that mention @postgame" />
      ) : res.error ? (
        <div className="p-4">
          <ErrorNote message={res.error} />
        </div>
      ) : (
        <>
          <Toolbar action="/admin/feed/mentions" placeholder="Filter by hashtag or caption" q={q} />
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-stone-500">
              No mentions captured yet. They arrive through the mentions webhook as they happen.
            </div>
          ) : (
            <PostGrid
              ago={timeAgo}
              posts={rows.map((m) => ({
                id: m.id,
                who: m.username,
                image: m.media_url,
                isVideo: false,
                likes: m.like_count,
                when: m.received_at,
                href: m.permalink,
              }))}
            />
          )}
        </>
      )}
    </SocialShell>
  );
}
