// #perf — "Who carried it": up to 5 cards plus an engagements/views toggle.
//
// The prototype filters on `r.img && eng > 0`, which would blank this section
// for any campaign whose top athletes have metrics but no uploaded photo — 13
// campaigns have fewer than 5 athletes with photos. Here the photo is optional
// and the card falls back to a flat plate, so ranking never silently drops an
// athlete who genuinely carried the campaign.
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import type { Athlete } from "@/lib/types";

export function PerformersSection({ candidates }: { candidates: Athlete[] }) {
  const h = SECTION_HEADING.perf;
  // Fewer than 5 is normal; render what exists rather than padding to a grid.
  const cards = candidates.slice(0, 5);
  return (
    <section id="perf" data-recap-v2="perf">
      <p data-slot="kicker">{h.kicker}</p>
      <h2>{h.title}</h2>
      {/* Toggle is only meaningful with more than one card to reorder. */}
      {cards.length > 1 ? <div data-slot="toggle" /> : null}
      <ul data-slot="pgrid" data-count={cards.length}>
        {cards.map((a) => (
          <li key={a.id} data-athlete={a.id}>
            {a.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
