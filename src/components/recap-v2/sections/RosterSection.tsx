// #roster — "Every athlete. Every number.": collab group cards, then the
// sortable individual table.
//
// This is the section that survives when everything else has gone: a campaign
// with no metrics, no photos, no takeaways and no description still has a
// roster, and that is what stops the page collapsing to a bare header.
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import type { Athlete, CollabGroup } from "@/lib/types";

export function RosterSection({
  athletes,
  collabGroups,
}: {
  athletes: Athlete[];
  collabGroups: CollabGroup[];
}) {
  const h = SECTION_HEADING.roster;
  // 18 campaigns have fewer than 3 schools; the column stays but stops being
  // a useful sort. Suppressing it is a Step 2 call, not a guard.
  const schools = new Set(athletes.map((a) => a.school).filter(Boolean));
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
        <tbody>
          {athletes.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
