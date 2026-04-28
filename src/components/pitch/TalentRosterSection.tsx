import { Fragment } from "react";
import type { TalentRosterSectionData } from "@/types/pitch";

/**
 * Sport-grouped roster of athletes Postgame has worked with.
 *
 * Each group renders a sport label (e.g. FOOTBALL) and a flowing list
 * of athlete names with optional teams in parens. Pure display from
 * `data` — no DB lookups.
 */
export default function TalentRosterSection({
  data,
}: {
  data: TalentRosterSectionData;
}) {
  if (!data.visible) return null;
  if (!data.groups || data.groups.length === 0) return null;

  return (
    <section className="pitch-talent wrap">
      {data.heading ? (
        <div className="pitch-talent__heading">{data.heading}</div>
      ) : null}
      {data.intro ? (
        <p className="pitch-talent__intro">{data.intro}</p>
      ) : null}
      <div className="pitch-talent__groups">
        {data.groups.map((g, i) => (
          <div className="pitch-talent__group" key={`${g.sport}-${i}`}>
            <div className="pitch-talent__sport">{g.sport}</div>
            <div className="pitch-talent__athletes">
              {g.athletes.map((a, j) => (
                <Fragment key={`${a.name}-${j}`}>
                  {j > 0 ? (
                    <span className="pitch-talent__sep" aria-hidden="true">
                      {" · "}
                    </span>
                  ) : null}
                  <span className="pitch-talent__athlete">
                    <span className="pitch-talent__name">{a.name}</span>
                    {a.team ? (
                      <span className="pitch-talent__team"> ({a.team})</span>
                    ) : null}
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
