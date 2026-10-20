// ============================================================
// /admin/content/posting/[campaignId] — one campaign's posting roster.
// Matches prototype S["posting-campaign"]: tiles (Not ready / Ready to
// send / Sent / Posted), then Athlete · Post date · Files · Status ·
// Copy link / Mark sent. Filter by tile via ?status=.
//
// Captions, files and per-post editing stay in the existing Hub editor
// (/dashboard/posting-instructions/[id]) — linked as "Edit posts".
// ============================================================

import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { loadPostingRoster } from "@/lib/admin/content/queries";
import { ErrorNote, EmptyRows, PageHeader } from "@/components/admin/ui";
import { Avatar, Toolbar } from "@/components/admin/ops-bits";
import { BtnLink, Card, CardGrid, Crumb, ListCard, Pill, TableWrap, Td, Th } from "@/components/admin/content/bits";
import CopyButton from "@/components/admin/CopyButton";
import PostingRowActions from "@/components/admin/content/PostingRowActions";
import type { PostingRosterRow } from "@/lib/admin/content/types";
import ViewToggle from "@/components/admin/ViewToggle";
import { getListView } from "@/lib/admin/list-view";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;
const TILES: { key: PostingRosterRow["status"]; label: string }[] = [
  { key: "not_ready", label: "Not ready" },
  { key: "ready", label: "Ready to send" },
  { key: "sent", label: "Sent" },
  { key: "posted", label: "Posted" },
];

export default async function PostingCampaignPage({
  params,
  searchParams,
}: {
  params: { campaignId: string };
  searchParams: { status?: string; q?: string; view?: string };
}) {
  await requireAdmin("staff");
  const view = getListView("content-posting-roster", searchParams);
  const back = <Crumb href="/admin/content/posting" label="Posting instructions" />;
  const detail = UUID.test(params.campaignId)
    ? await loadPostingRoster(createServiceSupabase(), params.campaignId)
    : null;
  if (!detail) {
    return (
      <div>
        {back}
        <PageHeader title="Posting" />
        <ErrorNote message="Posting campaign not found." />
      </div>
    );
  }

  const status = TILES.some((t) => t.key === searchParams.status) ? (searchParams.status as PostingRosterRow["status"]) : null;
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const shown = detail.rows.filter(
    (r) =>
      (!status || r.status === status) &&
      (!q || `${r.name} ${r.school ?? ""} ${r.handle ?? ""}`.toLowerCase().includes(q))
  );
  const readyLinks = detail.rows
    .filter((r) => r.status === "ready")
    .map((r) => `${r.name} — ${r.link}`)
    .join("\n");
  const base = `/admin/content/posting/${detail.id}`;

  return (
    <div>
      {back}
      <PageHeader
        title={`${detail.title} · posting`}
        subtitle={[detail.brandName, detail.tag && `tag @${detail.tag.replace(/^@/, "")}`, detail.hashtag && `#${detail.hashtag.replace(/^#/, "")}`, detail.ftc]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <BtnLink href={`/dashboard/posting-instructions/${detail.id}`}>Edit posts</BtnLink>
            {readyLinks && (
              <CopyButton
                value={readyLinks}
                label="Copy all ready links"
                className="rounded-md bg-[#D73F09] px-3 py-1.5 text-[12px] font-medium text-white"
              />
            )}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {TILES.map((t) => {
          const n = detail.rows.filter((r) => r.status === t.key).length;
          const active = status === t.key;
          return (
            <Link
              key={t.key}
              href={active ? base : `${base}?status=${t.key}`}
              className={
                "rounded-lg border bg-white p-4 " + (active ? "border-[#D73F09]" : "border-stone-200 hover:border-stone-300")
              }
            >
              <div className="text-2xl font-semibold tabular-nums text-stone-900">{n}</div>
              <div className="mt-1 text-[12px] uppercase tracking-wide text-stone-500">{t.label}</div>
            </Link>
          );
        })}
      </div>

      <Card>
        <Toolbar action={base} placeholder="Search athlete or school" q={searchParams.q} hidden={{ status: status ?? undefined }} right={<ViewToggle listKey="content-posting-roster" view={view} />} />
        {shown.length === 0 ? (
          <EmptyRows label={detail.rows.length ? "No athletes match." : "No posts on this campaign yet."} />
        ) : view === "cards" ? (
          <CardGrid>
            {shown.map((r) => (
              <ListCard
                key={r.key}
                mark={<Avatar name={r.name} />}
                title={r.name}
                subtitle={[r.handle && `@${r.handle}`, r.school].filter(Boolean).join(" · ") || "—"}
                foot={<PostingRowActions link={r.link} draftIds={r.status === "ready" ? r.draftIds : []} />}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Pill tone={r.status === "posted" ? "ok" : r.status === "sent" ? "info" : r.status === "ready" ? "accent" : "muted"}>
                    {r.statusLabel}
                  </Pill>
                  <Pill tone={r.filesOk ? "ok" : "warn"}>{r.files}</Pill>
                  <span className="text-stone-500">{r.postDate ? `Posts ${r.postDate}` : "No post date"}</span>
                </span>
              </ListCard>
            ))}
          </CardGrid>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Athlete</Th>
                <Th>Post date</Th>
                <Th>Files</Th>
                <Th>Status</Th>
                <Th right />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} className="hover:bg-stone-50/60">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-stone-900">{r.name}</div>
                        <div className="truncate text-[12px] text-stone-500">
                          {[r.handle && `@${r.handle}`, r.school].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-stone-700">{r.postDate ?? "—"}</Td>
                  <Td>
                    <Pill tone={r.filesOk ? "ok" : "warn"}>{r.files}</Pill>
                  </Td>
                  <Td>
                    <Pill tone={r.status === "posted" ? "ok" : r.status === "sent" ? "info" : r.status === "ready" ? "accent" : "muted"}>
                      {r.statusLabel}
                    </Pill>
                  </Td>
                  <Td right>
                    <PostingRowActions link={r.link} draftIds={r.status === "ready" ? r.draftIds : []} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
