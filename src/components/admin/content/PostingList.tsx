// Posting instructions — campaign table (prototype S.posting). Server-safe.

import Link from "next/link";
import { CampCell, ProgressBar } from "@/components/admin/ops-bits";
import { EmptyRows } from "@/components/admin/ui";
import type { PostingCampaignRow } from "@/lib/admin/content/types";
import { TableWrap, Td, Th } from "./bits";

export function PostingList({ rows }: { rows: PostingCampaignRow[] }) {
  if (!rows.length) return <EmptyRows label="No campaign has posting instructions yet." />;
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
