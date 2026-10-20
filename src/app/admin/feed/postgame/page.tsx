// ============================================================
// /admin/feed/postgame — Social · Postgame feed (prototype S.social).
// Reads instagram_posts (migration 083). Until that table is live
// the tab says so — no placeholder tiles.
// ============================================================

import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { safeQuery, sanitizeFilterValue } from "@/lib/admin/db";
import { ErrorNote } from "@/components/admin/ui";
import { TablePending, Toolbar, timeAgo } from "@/components/admin/ops-bits";
import { SocialShell, PostGrid } from "@/components/admin/tools/social";

export const dynamic = "force-dynamic";

interface PostRow {
  id: string;
  ig_username: string | null;
  author_username: string | null;
  source: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  like_count: number | null;
  posted_at: string | null;
}

export default async function PostgameFeedPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin("staff");
  const supabase = createServiceSupabase();
  const q = sanitizeFilterValue(searchParams.q ?? "");

  const res = await safeQuery<PostRow[]>(() => {
    let query = supabase
      .from("instagram_posts")
      .select("id, ig_username, author_username, source, media_type, media_url, thumbnail_url, permalink, like_count, posted_at")
      .order("posted_at", { ascending: false })
      .limit(60);
    if (q) query = query.ilike("caption", `%${q}%`);
    return query;
  });

  const rows = res.data ?? [];

  return (
    <SocialShell
      current="postgame"
      foot={res.pending ? null : <span>Showing {rows.length} newest posts</span>}
    >
      {res.pending ? (
        <TablePending table="instagram_posts" feature="Postgame's Instagram posts" />
      ) : res.error ? (
        <div className="p-4">
          <ErrorNote message={res.error} />
        </div>
      ) : (
        <>
          <Toolbar action="/admin/feed/postgame" placeholder="Filter by caption or tag" q={q} />
          {rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-stone-500">
              No posts imported yet. Posts appear here once an Instagram account is connected in Settings.
            </div>
          ) : (
            <PostGrid
              ago={timeAgo}
              posts={rows.map((p) => ({
                id: p.id,
                who: p.source === "owned" ? p.ig_username : p.author_username ?? p.ig_username,
                image: p.thumbnail_url ?? p.media_url,
                isVideo: /video|reel/i.test(p.media_type ?? ""),
                likes: p.like_count,
                when: p.posted_at,
                href: p.permalink,
              }))}
            />
          )}
        </>
      )}
    </SocialShell>
  );
}
