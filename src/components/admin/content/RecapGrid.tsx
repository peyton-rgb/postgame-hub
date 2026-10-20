// Recap builder — card grid (prototype recapCards()). Server-safe.
// Edit opens the existing recap editor (/dashboard/[id]); View opens
// the public recap renderer, which this screen never touches.

/* eslint-disable @next/next/no-img-element */

import { EmptyRows } from "@/components/admin/ui";
import type { RecapCard } from "@/lib/admin/content/types";
import { BtnLink, Pill, TableWrap, Td, Th } from "./bits";

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusPill({ c }: { c: RecapCard }) {
  return c.status === "archived" ? <Pill>Archived</Pill> : c.published ? <Pill tone="ok">Published</Pill> : <Pill>Draft</Pill>;
}

function Actions({ c }: { c: RecapCard }) {
  return (
    <span className="flex justify-end gap-2">
      {c.published && c.slug && (
        <BtnLink href={`/recap/${c.slug}`} external>
          View
        </BtnLink>
      )}
      <BtnLink href={`/dashboard/${c.id}`}>Edit</BtnLink>
    </span>
  );
}

export function RecapGrid({
  cards,
  emptyLabel,
  view = "cards",
}: {
  cards: RecapCard[];
  emptyLabel: string;
  /** "cards" is this list's original layout; "rows" is the table */
  view?: "rows" | "cards";
}) {
  if (!cards.length) return <EmptyRows label={emptyLabel} />;
  if (view === "rows") {
    return (
      <TableWrap>
        <thead>
          <tr>
            <Th>Recap</Th>
            <Th>Created</Th>
            <Th>Status</Th>
            <Th right />
          </tr>
        </thead>
        <tbody>
          {cards.map((c) => (
            <tr key={c.id} className="hover:bg-stone-50/60">
              <Td>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative block h-[34px] w-[54px] shrink-0 overflow-hidden rounded-md bg-gradient-to-br from-[#16181D] to-[#3a3f4a]">
                    {c.image && <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" loading="lazy" />}
                    {c.logo && (
                      <img
                        src={c.logo}
                        alt={c.brandName ? `${c.brandName} logo` : ""}
                        className="absolute inset-0 m-auto max-h-[18px] max-w-[42px] object-contain"
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <a href={`/dashboard/${c.id}`} className="block truncate font-medium text-stone-900 hover:underline">
                      {c.name}
                    </a>
                    <div className="truncate text-[12px] text-stone-500">{c.brandName ?? "No brand"}</div>
                  </div>
                </div>
              </Td>
              <Td className="whitespace-nowrap text-stone-700">{fmtDate(c.createdAt)}</Td>
              <Td>
                <StatusPill c={c} />
              </Td>
              <Td right>
                <Actions c={c} />
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    );
  }
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <article key={c.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="relative flex h-[110px] items-end bg-gradient-to-br from-[#16181D] to-[#3a3f4a] p-3">
            {c.image && <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" loading="lazy" />}
            {c.logo ? (
              <img src={c.logo} alt={c.brandName ? `${c.brandName} logo` : ""} className="relative max-h-7 max-w-[120px] object-contain" />
            ) : null}
          </div>
          <div className="p-3">
            <div className="truncate font-semibold text-stone-900">{c.name}</div>
            <div className="truncate text-[12px] text-stone-500">
              {c.brandName ?? "No brand"} · {fmtDate(c.createdAt)}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              {c.status === "archived" ? (
                <Pill>Archived</Pill>
              ) : c.published ? (
                <Pill tone="ok">Published</Pill>
              ) : (
                <Pill>Draft</Pill>
              )}
              <span className="flex gap-2">
                {c.published && c.slug && (
                  <BtnLink href={`/recap/${c.slug}`} external>
                    View
                  </BtnLink>
                )}
                <BtnLink href={`/dashboard/${c.id}`}>Edit</BtnLink>
              </span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
