// #roster — "Every athlete. Every number.": collab group cards, then the
// sortable individual table.
//
// This is the section that survives when everything else has gone: a campaign
// with no metrics, no photos, no takeaways and no description still has a
// roster, and that is what stops the page collapsing to a bare header.
//
// The rate column is engagements ÷ impressions, the same figure the performer
// cards show, from the same map — the two cannot disagree.
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import { RATE_LABEL, formatRate, type RecapV2Stats } from "@/lib/recap-v2/stats";
import { fmt } from "@/lib/recap-helpers";
import type { Athlete, CollabGroup } from "@/lib/types";

export function RosterSection({
  athletes,
  collabGroups,
  stats,
}: {
  athletes: Athlete[];
  collabGroups: CollabGroup[];
  stats: RecapV2Stats;
}) {
  const h = SECTION_HEADING.roster;
  // 18 campaigns have fewer than 3 schools; the column stays but stops being
  // a useful sort. Suppressing it is a Step 3 call, not a guard.
  const schools = new Set(athletes.map((a) => a.school).filter(Boolean));
  // A roster with no impressions anywhere has no rate column worth showing.
  const anyRates = athletes.some((a) => (stats.byAthlete.get(a.id)?.impressions ?? 0) > 0);
  return (
    <section id="roster" data-recap-v2="roster">
      <p data-slot="kicker">{h.kicker}</p>
      <h2>{h.title}</h2>
      {/* Most campaigns have no collabs — no cards, and no "Individual posts"
          subheading either, since there is nothing for it to distinguish. */}
      {collabGroups.length > 0 ? (
        <div data-slot="collabs" data-count={collabGroups.length} />
      ) : null}
      {collabGroups.length > 0 ? <h3 data-slot="sub">Individual posts</h3> : null}
      <table data-slot="rtable" data-rows={athletes.length} data-schools={schools.size}>
        <thead>
          <tr>
            <th scope="col">Athlete</th>
            {schools.size > 0 ? <th scope="col">School</th> : null}
            <th scope="col">Impressions</th>
            <th scope="col">Engagements</th>
            {anyRates ? <th scope="col" title={RATE_LABEL}>Eng. rate</th> : null}
          </tr>
        </thead>
        <tbody>
          {athletes.map((a) => {
            const r = stats.byAthlete.get(a.id);
            return (
              <tr key={a.id}>
                <td>{a.name}</td>
                {schools.size > 0 ? <td>{a.school || "—"}</td> : null}
                <td>{fmt(r?.impressions ?? 0)}</td>
                <td>{fmt(r?.engagements ?? 0)}</td>
                {anyRates ? (
                  <td>{r && r.impressions > 0 ? formatRate(r.rate) : "—"}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {anyRates ? <p data-slot="foot">Engagement rate is {RATE_LABEL}.</p> : null}
    </section>
  );
}
