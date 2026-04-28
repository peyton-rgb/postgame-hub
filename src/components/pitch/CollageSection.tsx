import type {
  CollageSectionData,
  PitchCollageAthleteRow,
} from "@/types/pitch";

/**
 * Hero collage block.
 *
 * The page-level fetcher in /pitch/[slug]/page.tsx queries
 * pitch_collage_athletes (filtered/ordered per the section's `sport`
 * preference) and passes the resulting rows in via `athletes`. This
 * component is pure display.
 *
 * If `athletes` is empty, the section renders nothing — a pitch with
 * no available collage athletes simply skips the collage block.
 *
 * Each athlete renders as either their cutout image (if uploaded) or
 * a vertical gradient placeholder, plus a name plate underneath:
 * a 2px orange bar + athlete name on top of the brand name (small,
 * uppercase, tracked).
 */
export default function CollageSection({
  data,
  athletes,
}: {
  data: CollageSectionData;
  athletes: PitchCollageAthleteRow[];
}) {
  if (!data.visible) return null;

  // Hero-image mode: render a single pre-composed collage. Underneath
  // the image, render a horizontal "roster credits" strip of name plates
  // sourced from pitch_collage_athletes (in display_order). Plates are
  // not strictly 1:1 aligned with specific athletes in the photo —
  // they're a credits row.
  if (data.heroImageUrl) {
    return (
      <section className="pitch-collage pitch-collage--hero">
        <img
          className="pitch-collage__hero-img"
          src={data.heroImageUrl}
          alt="Postgame athlete collage"
        />
        {athletes && athletes.length > 0 ? (
          <div className="pitch-collage__plates-row">
            {athletes.map((a) => (
              <div className="pitch-collage__plate" key={a.id}>
                <span className="pitch-collage__bar" aria-hidden="true" />
                <div className="pitch-collage__plate-text">
                  <div className="pitch-collage__name">{a.athlete_name}</div>
                  <div className="pitch-collage__brand">{a.brand_name}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  // Data-driven mode: lay out one tile per active athlete row.
  if (!athletes || athletes.length === 0) return null;

  return (
    <section className="pitch-collage">
      <div className="pitch-collage__inner">
        {athletes.map((a) => (
          <div className="pitch-collage__athlete" key={a.id}>
            <div className="pitch-collage__cutout">
              {a.cutout_image_url ? (
                <img src={a.cutout_image_url} alt={a.athlete_name} />
              ) : (
                <div
                  className="pitch-collage__placeholder"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="pitch-collage__plate">
              <span className="pitch-collage__bar" aria-hidden="true" />
              <div className="pitch-collage__plate-text">
                <div className="pitch-collage__name">{a.athlete_name}</div>
                <div className="pitch-collage__brand">{a.brand_name}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
