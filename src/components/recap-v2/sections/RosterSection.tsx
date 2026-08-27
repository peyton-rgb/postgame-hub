"use client";

// #roster — "Every athlete. Every number.": collab group blocks, then the
// sortable individual table.
//
// This is the section that survives when everything else has gone: a campaign
// with no metrics, no photos, no takeaways and no description still has a
// roster, and that is what stops the page collapsing to a bare header.
//
// Client-side only for the column sort. Every column that can be empty across
// the catalogue is guarded — 18 campaigns have fewer than 3 schools, and 30
// have no metrics at all, so a fixed seven-column table would be mostly
// em dashes.
//
// The rate column is engagements ÷ impressions, from the same map the
// performer cards read, so the two cannot disagree.
import { useMemo, useState } from "react";
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import { RATE_LABEL, formatRate } from "@/lib/recap-v2/stats";
import { fmt } from "@/lib/recap-helpers";
import { Foot, Section, SectionHead, Stat } from "../ui";

export interface RosterRow {
  id: string;
  name: string;
  school: string | null;
  /** Instagram handle, without the @. */
  handle: string | null;
  followers: number;
  impressions: number;
  engagements: number;
  rate: number | null;
  /**
   * Feed and reel are separate columns, not one "Post" link. An athlete
   * commonly has both, and collapsing them meant whichever the fallback chain
   * happened to reach first was the only one a reader could open.
   */
  feedUrl: string | null;
  reelUrl: string | null;
}

export interface CollabBlock {
  id: string;
  platformLabel: string;
  athleteNames: string[];
  combinedFollowers: number;
  impressions: number;
  engagements: number;
  rate: number | null;
  url: string | null;
}

type SortKey = "name" | "school" | "handle" | "followers" | "impressions" | "engagements" | "rate";

export function RosterSection({
  rows,
  collabs,
}: {
  rows: RosterRow[];
  collabs: CollabBlock[];
}) {
  const h = SECTION_HEADING.roster;
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "engagements",
    dir: "desc",
  });

  const hasSchools = rows.some((r) => !!r.school);
  const hasHandles = rows.some((r) => !!r.handle);
  const hasFollowers = rows.some((r) => r.followers > 0);
  const hasMetrics = rows.some((r) => r.impressions > 0 || r.engagements > 0);
  const hasRates = rows.some((r) => r.rate != null);
  const hasFeed = rows.some((r) => !!r.feedUrl);
  const hasReel = rows.some((r) => !!r.reelUrl);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort.key === "name") return a.name.localeCompare(b.name) * dir;
      if (sort.key === "school") return (a.school || "").localeCompare(b.school || "") * dir;
      if (sort.key === "handle") return (a.handle || "").localeCompare(b.handle || "") * dir;
      // Null rates sort to the bottom in both directions — "no basis to state
      // one" is not the same as zero and should not lead an ascending sort.
      if (sort.key === "rate") {
        if (a.rate == null && b.rate == null) return 0;
        if (a.rate == null) return 1;
        if (b.rate == null) return -1;
        return (a.rate - b.rate) * dir;
      }
      return (a[sort.key] - b[sort.key]) * dir;
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: key === "name" || key === "school" ? "asc" : "desc" },
    );

  const Th = ({ k, children, numeric = true }: { k: SortKey; children: React.ReactNode; numeric?: boolean }) => (
    <th
      scope="col"
      onClick={() => toggle(k)}
      aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`cursor-pointer select-none whitespace-nowrap pb-5 pl-[18px] font-mono text-[11.5px] font-bold tracking-[0.22em] transition-colors first:pl-0 hover:text-[color:var(--rv-orange)] ${
        numeric ? "text-right" : "text-left"
      } ${sort.key === k ? "text-[color:var(--rv-orange)]" : "text-[color:var(--rv-white)]"}`}
    >
      {children}
      <span className="ml-[7px] inline-block text-[9px] leading-none">
        {sort.key === k ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
      </span>
    </th>
  );

  return (
    <Section id="roster">
      <SectionHead kicker={h.kicker} title={h.title} tight />

      {/* Most campaigns have no collabs — no blocks, and no "Individual posts"
          subheading either, since there is nothing for it to distinguish. */}
      {collabs.length > 0 ? (
        <div data-slot="collabs" data-count={collabs.length}>
          {collabs.map((c) => (
            <div
              key={c.id}
              className="mb-7 overflow-hidden rounded-[12px] border-[1.5px] border-l-[3px] border-[rgba(215,63,9,0.5)] border-l-[color:var(--rv-orange)] bg-[rgba(15,15,18,0.5)]"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-[rgba(215,63,9,0.2)] bg-[rgba(215,63,9,0.07)] px-4 py-[11px]">
                <span className="font-display text-[22px] leading-none tracking-[0.06em] text-white">
                  {c.athleteNames.join(" × ")}
                </span>
                <span className="rounded-[4px] border border-[rgba(215,63,9,0.4)] bg-[rgba(215,63,9,0.15)] px-[10px] py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--rv-orange)]">
                  {c.platformLabel}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 px-4 py-3 min-[701px]:grid-cols-4">
                {[
                  { k: "Combined followers", v: fmt(c.combinedFollowers) },
                  { k: "Impressions", v: fmt(c.impressions) },
                  { k: "Engagements", v: fmt(c.engagements) },
                  { k: "Eng. rate", v: c.rate == null ? "—" : formatRate(c.rate) },
                ].map((x) => (
                  <div key={x.k} className="py-2">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--rv-dim2)]">
                      {x.k}
                    </dt>
                    <dd className="mt-1">
                      <Stat className="text-[21px] leading-none">{x.v}</Stat>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <p className="mb-[14px] mt-[34px] font-mono text-[11px] uppercase tracking-[0.18em] text-[color:var(--rv-dim2)]">
            Individual posts
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table
          data-slot="rtable"
          data-rows={rows.length}
          className="w-full border-collapse"
        >
          <thead>
            <tr>
              <Th k="name" numeric={false}>Athlete</Th>
              {hasSchools ? <Th k="school" numeric={false}>School</Th> : null}
              {hasHandles ? <Th k="handle" numeric={false}>Handle</Th> : null}
              {hasFollowers ? <Th k="followers">Followers</Th> : null}
              {hasMetrics ? <Th k="impressions">Impressions</Th> : null}
              {hasMetrics ? <Th k="engagements">Engagements</Th> : null}
              {hasRates ? <Th k="rate">Eng. rate</Th> : null}
              {hasFeed ? <PlainTh>Feed</PlainTh> : null}
              {hasReel ? <PlainTh>Reel</PlainTh> : null}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="hover:bg-white/[0.022]">
                <td className="border-t border-[color:var(--rv-line)] py-[15px] pl-0 text-left text-[15px] font-bold">
                  {r.name}
                </td>
                {hasSchools ? (
                  <td className="border-t border-[color:var(--rv-line)] py-[15px] pl-[18px] text-left text-[15px] text-[color:var(--rv-dim)]">
                    {r.school || <span className="text-[color:var(--rv-dim2)]">—</span>}
                  </td>
                ) : null}
                {hasHandles ? (
                  <td className="border-t border-[color:var(--rv-line)] py-[15px] pl-[18px] text-left text-[15px] text-[color:var(--rv-dim)]">
                    {r.handle ? (
                      <a
                        href={`https://instagram.com/${r.handle.replace(/^@/, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-underline transition-colors hover:text-[color:var(--rv-orange)]"
                      >
                        @{r.handle.replace(/^@/, "")}
                      </a>
                    ) : (
                      <span className="text-[color:var(--rv-dim2)]">—</span>
                    )}
                  </td>
                ) : null}
                {hasFollowers ? <Td>{fmt(r.followers)}</Td> : null}
                {hasMetrics ? <Td>{fmt(r.impressions)}</Td> : null}
                {hasMetrics ? <Td>{fmt(r.engagements)}</Td> : null}
                {hasRates ? (
                  <td className="whitespace-nowrap border-t border-[color:var(--rv-line)] py-[15px] pl-[18px] text-right text-[15px] font-bold tabular-nums text-[color:var(--rv-orange)]">
                    {r.rate == null ? <span className="font-normal text-[color:var(--rv-dim2)]">—</span> : formatRate(r.rate)}
                  </td>
                ) : null}
                {hasFeed ? <LinkTd url={r.feedUrl} /> : null}
                {hasReel ? <LinkTd url={r.reelUrl} /> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasRates ? (
        <Foot>
          Engagement rate is {RATE_LABEL}. Click a column heading to sort.
        </Foot>
      ) : null}
    </Section>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap border-t border-[color:var(--rv-line)] py-[15px] pl-[18px] text-right text-[15px] tabular-nums">
      {children}
    </td>
  );
}

function PlainTh({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="whitespace-nowrap pb-5 pl-[18px] text-right font-mono text-[11.5px] font-bold tracking-[0.22em] text-[color:var(--rv-white)]"
    >
      {children}
    </th>
  );
}

function LinkTd({ url }: { url: string | null }) {
  return (
    <td className="border-t border-[color:var(--rv-line)] py-[15px] pl-[18px] text-right">
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full border border-[color:var(--rv-line)] px-[13px] py-[7px] font-mono text-[11px] tracking-[0.14em] text-[color:var(--rv-dim)] no-underline transition-colors hover:border-white/35 hover:text-[color:var(--rv-white)]"
        >
          Open
        </a>
      ) : (
        <span className="text-[color:var(--rv-dim2)]">—</span>
      )}
    </td>
  );
}
