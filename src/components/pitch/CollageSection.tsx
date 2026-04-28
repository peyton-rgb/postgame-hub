import type {
  CollageSectionData,
  HeroPlatePosition,
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

  // Hero-image mode: render a single pre-composed collage.
  //
  // If the section provides `heroPlates`, plates float at the specified
  // positions over the image and the credits strip is suppressed.
  // Otherwise, a horizontal credits strip renders below the image
  // showing all active athletes in display_order.
  if (data.heroImageUrl) {
    const platesByName = new Map<string, HeroPlatePosition>();
    for (const p of data.heroPlates ?? []) {
      platesByName.set(p.athleteName, p);
    }
    const useFloatingPlates = platesByName.size > 0;

    return (
      <section className="pitch-collage pitch-collage--hero">
        {data.heading ? (
          <div className="pitch-collage__heading">{data.heading}</div>
        ) : null}
        <div className="pitch-collage__hero-frame">
          <img
            className="pitch-collage__hero-img"
            src={data.heroImageUrl}
            alt="Postgame athlete collage"
          />
          {useFloatingPlates &&
            athletes.map((a) => {
              const cfg = platesByName.get(a.athlete_name);
              if (!cfg) return null;
              return (
                <div
                  key={a.id}
                  className={`pitch-collage__floating-plate pitch-collage__floating-plate--${cfg.align ?? "left"}`}
                  style={{
                    left: cfg.left,
                    bottom: cfg.bottom ?? "4%",
                  }}
                >
                  <span className="pitch-collage__bar" aria-hidden="true" />
                  <div className="pitch-collage__plate-text">
                    <div className="pitch-collage__name">{a.athlete_name}</div>
                    <div className="pitch-collage__brand">{a.brand_name}</div>
                  </div>
                </div>
              );
            })}
        </div>
        {!useFloatingPlates && athletes.length > 0 ? (
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
      {data.heading ? (
        <div className="pitch-collage__heading">{data.heading}</div>
      ) : null}
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
