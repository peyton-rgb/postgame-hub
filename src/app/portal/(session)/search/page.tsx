import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import { resolveSessionPortal } from "@/lib/portal/session-portal";
import { getPostgameIcon } from "@/lib/portal-data";
import { loadPortalSearch, type SearchHit } from "@/lib/portal/pages-data";

// Search results — what the toolbar search box does. It was a decorative span
// for the whole of Phase 3b; the choice was wire it or hide it, and campaigns
// and athletes are both one indexed query away.
//
// A page, not a dropdown: the results are a list with meta on each row, the
// query survives a reload and a link to it can be shared, and there is no
// client state to keep in sync with the field.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = {
  title: "Search — Postgame Brand Portal",
  robots: { index: false, follow: false },
};

function Group({ heading, hits }: { heading: string; hits: SearchHit[] }) {
  if (hits.length === 0) return null;
  return (
    <>
      <h2 className="pgd-group-h">
        {heading}
        <span className="pgd-group-note">{hits.length}</span>
      </h2>
      <div className="pgd-rows">
        {hits.map((h) => {
          const body = (
            <span className="pgd-row-main">
              <b>{h.name}</b>
              {h.meta ? <span>{h.meta}</span> : null}
            </span>
          );
          // A campaign row links to its page. An athlete row does not: the
          // directory is one filtered page, so there is no per-athlete route
          // to send anyone to, and a link that goes nowhere is worse than a
          // row that plainly is not one.
          return h.href ? (
            <a className="pgd-row" key={`${h.kind}-${h.key}`} href={h.href}>
              {body}
              <span className="pgd-state-wrapped">Open &rsaquo;</span>
            </a>
          ) : (
            <div className="pgd-row" key={`${h.kind}-${h.key}`}>
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const { brand, preview, chrome } = await resolveSessionPortal(searchParams.brand);
  const q = searchParams.q ?? "";
  const [icon, results] = await Promise.all([
    getPostgameIcon(),
    loadPortalSearch(brand.id, q),
  ]);

  const total = results.campaigns.length + results.athletes.length;
  const subtitle = results.query
    ? results.tooShort
      ? "Type at least two characters"
      : `${total} ${total === 1 ? "result" : "results"} for “${results.query}”`
    : "Campaigns and athletes";

  return (
    <PortalShell
      active="home"
      postgameIcon={icon}
      preview={preview}
      brand={brand}
      accountLabel={chrome.personLabel}
      title="Search"
      subtitle={subtitle}
      searchValue={results.query}
    >
      <div className="pgd-page">
        {!results.query || results.tooShort ? (
          <div className="pgd-panel">
            <b className="pgd-empty-h">Search your campaigns and athletes</b>
            <p className="pgd-card-meta" style={{ marginTop: 8 }}>
              Type a name in the box above — a campaign, or any athlete who has
              worked on one.
            </p>
          </div>
        ) : total === 0 ? (
          <div className="pgd-panel">
            <b className="pgd-empty-h">Nothing matches “{results.query}”</b>
            <p className="pgd-card-meta" style={{ marginTop: 8 }}>
              Only your own campaigns and athletes are searched.
            </p>
          </div>
        ) : (
          <>
            <Group heading="Campaigns" hits={results.campaigns} />
            <Group heading="Athletes" hits={results.athletes} />
          </>
        )}
      </div>
    </PortalShell>
  );
}
