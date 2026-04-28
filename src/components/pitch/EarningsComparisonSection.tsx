import type { EarningsComparisonSectionData } from "@/types/pitch";

/**
 * Recreates the 3-way earnings comparison sheet:
 *   Postgame Representation  |  'Other' Agency Representation  |  DIY
 * Each scenario is its own table (Item / Income / Player Earns) with a
 * total row at the bottom. The Postgame scenario can be flagged with
 * `emphasized: true` so it gets the orange highlight treatment.
 */
export default function EarningsComparisonSection({
  data,
}: {
  data: EarningsComparisonSectionData;
}) {
  if (!data.visible) return null;
  if (!data.scenarios || data.scenarios.length === 0) return null;

  return (
    <section className="pitch-earnings wrap">
      {data.heading ? (
        <h2 className="pitch-earnings__heading">{data.heading}</h2>
      ) : null}
      {data.intro ? (
        <p className="pitch-earnings__intro">{data.intro}</p>
      ) : null}

      <div className="pitch-earnings__scenarios">
        {data.scenarios.map((s, i) => (
          <div
            key={i}
            className={`pitch-earnings__scenario${
              s.emphasized ? " pitch-earnings__scenario--emphasized" : ""
            }`}
          >
            <div className="pitch-earnings__scenario-title">{s.title}</div>
            <table className="pitch-earnings__table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Income</th>
                  <th>Player Earns</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, j) => (
                  <tr key={j}>
                    <th className="pitch-earnings__row-label">{r.item}</th>
                    <td>{r.income}</td>
                    <td className="pitch-earnings__earns">{r.playerEarns}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={2} className="pitch-earnings__total-label">
                    {s.totalLabel}
                  </th>
                  <td className="pitch-earnings__total-value">{s.totalValue}</td>
                </tr>
                {s.totalNote ? (
                  <tr>
                    <td colSpan={3} className="pitch-earnings__total-note">
                      {s.totalNote}
                    </td>
                  </tr>
                ) : null}
              </tfoot>
            </table>
          </div>
        ))}
      </div>
    </section>
  );
}
