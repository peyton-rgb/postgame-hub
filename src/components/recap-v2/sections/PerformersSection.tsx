// #perf — "Who carried it": up to 5 cards plus an engagements/views toggle.
//
// The prototype filters on `r.img && eng > 0`, which would blank this section
// for any campaign whose top athletes have metrics but no uploaded photo — 13
// campaigns have fewer than 5 athletes with photos. Here the photo is optional
// and the card falls back to a flat plate, so ranking never silently drops an
// athlete who genuinely carried the campaign.
//
// The rate on each card is that athlete's own engagements ÷ impressions,
// summed across Post 1 and Post 2 together — so a card cannot show one slot on
// one definition and the other slot on another.
import { SECTION_HEADING } from "@/lib/recap-v2/guards";
import { RATE_LABEL, formatRate, type RecapV2Stats } from "@/lib/recap-v2/stats";
import { fmt } from "@/lib/recap-helpers";
import type { Athlete } from "@/lib/types";

export function PerformersSection({
  candidates,
  stats,
}: {
  candidates: Athlete[];
  stats: RecapV2Stats;
}) {
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
        {cards.map((a) => {
          const r = stats.byAthlete.get(a.id);
          return (
            <li key={a.id} data-athlete={a.id}>
              <span data-f="name">{a.name}</span>
              {a.school ? <span data-f="school">{a.school}</span> : null}
              <span data-f="engagements">{fmt(r?.engagements ?? 0)}</span>
              {/* An athlete with engagements but no impressions has no rate to
                  state. Em dash, not "0%", which would read as a real zero. */}
              <span data-f="rate" title={RATE_LABEL}>
                {r && r.impressions > 0 ? formatRate(r.rate) : "—"}
              </span>
              <span data-f="followers">{fmt(a.ig_followers ?? 0)}</span>
            </li>
          );
        })}
      </ul>
      <p data-slot="foot">Engagement rate is {RATE_LABEL}.</p>
    </section>
  );
}
