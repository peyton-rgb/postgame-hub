// Posting instructions — campaign table (prototype S.posting). Server-safe.

import Link from "next/link";
import { CampCell, ProgressBar } from "@/components/admin/ops-bits";
import { EmptyRows } from "@/components/admin/ui";
import type { PostingCampaignRow } from "@/lib/admin/content/types";
import { BrandMark } from "@/components/admin/brand-bits";
import { CardGrid, CardStat, CardStats, ListCard, TableWrap, Td, Th } from "./bits";

export function PostingList({ rows, view = "rows" }: { rows: PostingCampaignRow[]; view?: "rows" | "cards" }) {
  if (!rows.length) return <EmptyRows label="No campaign has posting instructions yet." />;
  if (view === "cards") {
    return (
      <CardGrid>
        {rows.map((c) => {
          const pct = c.posts > 0 ? Math.round((c.posted / c.posts) * 100) : 0;
          return (
            <ListCard
              key={c.id}
              href={`/admin/content/posting/${c.id}`}
              mark={<BrandMark src={c.logo} name={c.brandName} />}
              title={c.title}
              subtitle={`${c.brandName ?? "No brand"} · ${c.athletes} athlete${c.athletes === 1 ? "" : "s"}`}
              foot={
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-stone-500">
                    <span className="font-medium tabular-nums text-stone-900">{c.posted}</span> of {c.posts} posted
                  </span>
                  <ProgressBar value={c.posted} max={c.posts} />
                  <span className="tabular-nums text-stone-500">{pct}%</span>
                </span>
              }
            >
              <CardStats>
                <CardStat label="Posts">{c.posts}</CardStat>
                <CardStat label="Sent" muted={!c.sent}>{c.sent}</CardStat>
                <CardStat label="Posted" muted={!c.posted}>{c.posted}</CardStat>
              </CardStats>
            </ListCard>
          );
        })}
      </CardGrid>
    );
  }
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Campaign</Th>
          <Th right>Athletes</Th>
          <Th right>Posts</Th>
          <Th right>Sent</Th>
          <Th right>Posted</Th>
          <Th>Progress</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="hover:bg-stone-50/60">
            <Td>
              <CampCell name={c.title} brandName={c.brandName} logo={c.logo} href={`/admin/content/posting/${c.id}`} />
            </Td>
            <Td right className="tabular-nums">{c.athletes}</Td>
            <Td right className="tabular-nums">{c.posts}</Td>
            <Td right className="tabular-nums">{c.sent}</Td>
            <Td right className="tabular-nums">{c.posted}</Td>
            <Td>
              <Link href={`/admin/content/posting/${c.id}`} className="block">
                <ProgressBar value={c.posted} max={c.posts} />
              </Link>
            </Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
