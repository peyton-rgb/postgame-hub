// ============================================================
// Social — the prototype's S.social / S["social-mentions"] /
// S["social-messages"]: one "Social" header, one card, three
// bookmarkable tabs. Server-safe.
// ============================================================

import { PageHeader } from "@/components/admin/ui";
import { CardFoot } from "@/components/admin/ops-bits";
import { TabbedCard, btnDisabledCls } from "@/components/admin/tools/bits";

export type SocialTab = "postgame" | "mentions" | "messages";

export function SocialShell({
  current,
  children,
  foot,
  counts = {},
}: {
  current: SocialTab;
  children: React.ReactNode;
  foot?: React.ReactNode;
  counts?: Partial<Record<SocialTab, number | null>>;
}) {
  return (
    <div>
      <PageHeader
        title="Social"
        subtitle="Postgame's Instagram: our posts, posts that mention us, and DMs."
        actions={
          current === "postgame" ? (
            <span className={btnDisabledCls} title="Instagram import runs once the Instagram tables (migration 083) are applied">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
              </svg>
              Import now
            </span>
          ) : undefined
        }
      />
      <TabbedCard
        tabs={[
          { href: "/admin/feed/postgame", label: "Postgame feed", count: counts.postgame ?? null, active: current === "postgame" },
          { href: "/admin/feed/mentions", label: "Mentions", count: counts.mentions ?? null, active: current === "mentions" },
          { href: "/admin/feed/messages", label: "Messages", count: counts.messages ?? null, active: current === "messages" },
        ]}
      >
        {children}
        {foot && <CardFoot>{foot}</CardFoot>}
      </TabbedCard>
    </div>
  );
}

export interface PostTile {
  id: string;
  who: string | null;
  image: string | null;
  isVideo: boolean;
  likes: number | null;
  when: string | null;
  href: string | null;
}

export function PostGrid({ posts, ago }: { posts: PostTile[]; ago: (v: string | null) => string }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
      {posts.map((p) => {
        const body = (
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
            <div className="relative aspect-square bg-stone-800">
              {p.image && <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
              {p.isVideo && (
                <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">▶ Reel</span>
              )}
            </div>
            <div className="px-2.5 py-2 text-[12px]">
              <div className="truncate font-semibold text-stone-900">{p.who ? `@${p.who.replace(/^@/, "")}` : "—"}</div>
              <div className="truncate text-stone-500">
                {p.likes != null ? `${p.likes.toLocaleString()} likes · ` : ""}
                {ago(p.when)}
              </div>
            </div>
          </div>
        );
        return p.href ? (
          <a key={p.id} href={p.href} target="_blank" rel="noreferrer" className="block hover:opacity-90">
            {body}
          </a>
        ) : (
          <div key={p.id}>{body}</div>
        );
      })}
    </div>
  );
}
