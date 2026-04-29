import type { CaseStudySectionData } from "@/types/pitch";

/**
 * "Receipts" slide for the athlete pitch deck.
 *
 * Shows a single past Postgame campaign that maps to the athlete's
 * world. For Rodney Gallagher (who runs the Snakeefamm apparel
 * brand) this is the Hollister × 6-headliner designer collab.
 * For another athlete it could be a music campaign, a stadium
 * activation, etc. — same section type, different content.
 *
 * Layout, top to bottom:
 *   - Tiny uppercase label (CASE STUDY)
 *   - Kicker (BUILT FOR APPAREL ATHLETES)
 *   - Big headline
 *   - Wide hero image (the actual visual receipt)
 *   - Row of athlete + school name tags (optional)
 *   - 1–2 sentence description
 *   - Outbound article link (optional)
 */
export default function CaseStudySection({
  data,
}: {
  data: CaseStudySectionData;
}) {
  if (!data.visible) return null;

  const sectionLabel = data.sectionLabel ?? "CASE STUDY";

  return (
    <section className="pitch-case-study wrap">
      <div className="pitch-case-study__label">{sectionLabel}</div>
      {data.kicker ? (
        <div className="pitch-case-study__kicker">{data.kicker}</div>
      ) : null}
      <h2
        className="pitch-case-study__heading"
        // Heading supports inline <em> for the orange-highlight word,
        // matching the pattern used by other sections (hero, thesis).
        dangerouslySetInnerHTML={{ __html: data.heading }}
      />

      {data.heroImageUrl ? (
        <div className="pitch-case-study__hero-wrap">
          <img
            className="pitch-case-study__hero"
            src={data.heroImageUrl}
            alt={data.heroImageAlt ?? "Case study hero image"}
          />
        </div>
      ) : null}

      {data.athletes && data.athletes.length > 0 ? (
        <div className="pitch-case-study__tags">
          {data.athletes.map((a, i) => (
            <div className="pitch-case-study__tag" key={i}>
              <span className="pitch-case-study__tag-name">
                {a.athleteName}
              </span>
              <span className="pitch-case-study__tag-team">{a.team}</span>
            </div>
          ))}
        </div>
      ) : null}

      {data.paragraph ? (
        <p className="pitch-case-study__paragraph">{data.paragraph}</p>
      ) : null}

      {data.linkUrl ? (
        <a
          className="pitch-case-study__link"
          href={data.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {data.linkLabel ?? "Read more"} <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </section>
  );
}
