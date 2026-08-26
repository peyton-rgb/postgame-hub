// #overview — prose column plus spec table. Either half can be missing; the
// section only renders when at least one of them has something (see guards).
import { SECTION_HEADING, hasRichText, specRows } from "@/lib/recap-v2/guards";
import type { Campaign } from "@/lib/types";

export function OverviewSection({ campaign }: { campaign: Campaign }) {
  const s = campaign.settings || {};
  const rows = specRows(campaign);
  const h = SECTION_HEADING.overview;
  return (
    <section id="overview" data-recap-v2="overview">
      <p data-slot="kicker">{h.kicker}</p>
      <h2>{h.title}</h2>
      {hasRichText(s.description) ? (
        <div data-slot="prose" dangerouslySetInnerHTML={{ __html: s.description as string }} />
      ) : null}
      {rows.length > 0 ? (
        <dl data-slot="spec" data-rows={rows.length}>
          {rows.map((r) => (
            <div key={r.key}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
