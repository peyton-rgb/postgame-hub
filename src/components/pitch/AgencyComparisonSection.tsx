import type { AgencyComparisonSectionData } from "@/types/pitch";

/**
 * Recreates the "More Than An Agency / Your NIL Partner" value-prop
 * sheet as a real HTML section.
 *
 * Layout, top-to-bottom:
 *  - Big display headline + orange subheading
 *  - Comparison table — 4 columns (criterion, postgame, 'Other' Agency,
 *    Do It Yourself). The postgame column is highlighted.
 *  - Benefits overview — 5 bullet items in a 2x3-ish grid, each with a
 *    small orange tile + title + description.
 */
export default function AgencyComparisonSection({
  data,
}: {
  data: AgencyComparisonSectionData;
}) {
  if (!data.visible) return null;
  if (!data.rows || data.rows.length === 0) return null;

  return (
    <section className="pitch-agency wrap">
      <header className="pitch-agency__header">
        <h2 className="pitch-agency__heading">{data.heading}</h2>
        {data.subheading ? (
          <div className="pitch-agency__subheading">{data.subheading}</div>
        ) : null}
      </header>

      {data.tableLabel ? (
        <div className="pitch-agency__table-label">{data.tableLabel}</div>
      ) : null}

      <div className="pitch-agency__table-wrap">
        <table className="pitch-agency__table">
          <thead>
            <tr>
              <th aria-hidden="true"></th>
              <th className="pitch-agency__th pitch-agency__th--postgame">
                <img
                  className="pitch-agency__th-logo"
                  src="/postgame-logo-white.png"
                  alt="Postgame"
                />
              </th>
              <th className="pitch-agency__th">‘Other’ Agency</th>
              <th className="pitch-agency__th">Do It Yourself</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                <th className="pitch-agency__row-label">{row.criterion}</th>
                {/* data-label is used by the mobile-stacked layout
                    (see @media ≤640px in pitch.css) to inline a
                    column header above each value, since the real
                    <thead> is hidden on mobile. */}
                <td
                  className="pitch-agency__cell pitch-agency__cell--postgame"
                  data-label="Postgame"
                >
                  {row.postgame}
                </td>
                <td className="pitch-agency__cell" data-label="'Other' Agency">
                  {row.otherAgency}
                </td>
                <td className="pitch-agency__cell" data-label="Do It Yourself">
                  {row.doItYourself}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.benefits && data.benefits.length > 0 ? (
        <div className="pitch-agency__benefits">
          {data.benefitsLabel ? (
            <div className="pitch-agency__benefits-label">
              {data.benefitsLabel}
            </div>
          ) : null}
          {data.benefitsIntro ? (
            <p className="pitch-agency__benefits-intro">{data.benefitsIntro}</p>
          ) : null}
          <div className="pitch-agency__benefits-grid">
            {data.benefits.map((b, i) => (
              <div className="pitch-agency__benefit" key={i}>
                <div className="pitch-agency__benefit-tile" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="pitch-agency__benefit-body">
                  <div className="pitch-agency__benefit-title">{b.title}</div>
                  {b.description ? (
                    <p className="pitch-agency__benefit-desc">{b.description}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
