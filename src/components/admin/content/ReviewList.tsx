// ============================================================
// Review & edit — campaign table (batch-2 screen 1a). Server-safe.
// Columns: Campaign · Waiting on us · Waiting for · action.
// Used by /admin/content/review and the pipeline's Review tab.
// ============================================================

import { CampCell } from "@/components/admin/ops-bits";
import { EmptyRows } from "@/components/admin/ui";
import type { ReviewCampaignRow } from "@/lib/admin/content/types";
import { BtnLink, Pill, TableWrap, Td, Th } from "./bits";

export function ReviewList({ rows, emptyLabel }: { rows: ReviewCampaignRow[]; emptyLabel: string }) {
  if (!rows.length) return <EmptyRows label={emptyLabel} />;
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Campaign</Th>
          <Th>Waiting on us</Th>
          <Th>Waiting for</Th>
          <Th right />
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const href = `/admin/content/review/${c.id}`;
          return (
            <tr key={c.id} className="hover:bg-stone-50/60">
              <Td>
                <CampCell
                  name={c.name}
                  brandName={(c.brandName ?? "No brand") + (c.athletes ? ` · ${c.athletes} athlete${c.athletes === 1 ? "" : "s"}` : "")}
                  logo={c.logo}
                  href={href}
                />
              </Td>
              <Td>
                {c.toReview > 0 ? (
                  <span className="font-medium text-stone-900">
                    {c.toReview} file{c.toReview === 1 ? "" : "s"} to review
                    {c.inEdit > 0 && <span className="ml-2 font-normal text-stone-500">· {c.inEdit} in edit</span>}
                  </span>
                ) : c.inEdit > 0 ? (
                  <span className="text-stone-700">{c.inEdit} in the edit queue</span>
                ) : c.approved > 0 ? (
                  <Pill tone="ok">{c.approved} final</Pill>
                ) : c.waitingOnAthletes ? (
                  <span className="text-stone-400">Nothing uploaded yet</span>
                ) : (
                  <span className="text-stone-400">Nothing yet</span>
                )}
              </Td>
              <Td>
                {c.waitingDays !== null ? (
                  <Pill tone={c.waitingDays >= 7 ? "warn" : "muted"}>
                    {c.waitingDays} day{c.waitingDays === 1 ? "" : "s"}
                  </Pill>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </Td>
              <Td right>
                <BtnLink href={href} primary={c.toReview > 0}>
                  {c.toReview > 0 ? "Review" : "Open"}
                </BtnLink>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableWrap>
  );
}
