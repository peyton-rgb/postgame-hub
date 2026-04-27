import type {
  OpportunitiesSectionData,
  PitchOpportunityRow,
} from "@/types/pitch";

/**
 * "WHAT WE HAVE LINED UP" section — a stack of opportunity cards.
 *
 * Opportunity rows are pre-fetched at the page level by joining
 * pitch_page_opportunities (junction) onto pitch_opportunities and
 * filtering out archived rows. The rows are ordered by the junction's
 * display_order (carried over as `display_order` here).
 *
 * If the pitch has no linked opportunities, this section renders
 * nothing — the heading and the surrounding container are also
 * skipped, matching the spec's "omit if empty" rule.
 */
export default function OpportunitiesSection({
  data,
  opportunities,
}: {
  data: OpportunitiesSectionData;
  opportunities: PitchOpportunityRow[];
}) {
  if (!data.visible) return null;
  if (!opportunities || opportunities.length === 0) return null;

  const heading = data.heading ?? "WHAT WE HAVE LINED UP";

  return (
    <section className="pitch-opportunities wrap">
      <div className="pitch-opportunities__label">{heading}</div>
      <div className="pitch-opportunities__list">
        {opportunities.map((o) => (
          <article className="pitch-opportunities__card" key={o.id}>
            <div className="pitch-opportunities__title">{o.title}</div>
            {o.subtitle ? (
              <div className="pitch-opportunities__subtitle">{o.subtitle}</div>
            ) : null}
            {o.description ? (
              <p className="pitch-opportunities__desc">{o.description}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
