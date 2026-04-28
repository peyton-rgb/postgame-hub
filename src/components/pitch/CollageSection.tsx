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

  // Hero-image mode: render a single pre-composed collage and skip the
  // per-athlete layout entirely. The rows in pitch_collage_athletes are
  // ignored for this pitch.
  if (data.heroImageUrl) {
    return (
      <section className="pitch-collage pitch-collage--hero">
        <img
          className="pitch-collage__hero-img"
          src={data.heroImageUrl}
          alt="Postgame athlete collage"
        />
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
