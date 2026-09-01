// ============================================================
// Recap v2 — which stills the hero shows, and where they crop.
//
// This is the FALLBACK, not the final answer. Hero selection is moving into
// the recap editor as a human step; everything here is what happens until a
// person has made that choice, and it is built so that choice always wins.
//
// Measured coverage across all 82 published campaigns (4,077 non-thumbnail
// media rows), which is what makes the ordering below the shape it is:
//
//   public_hero      0 rows          — the editor field, not written yet
//   is_hero          63 rows         — exactly one per campaign, on 63 of 82;
//                                      never more, so it is a cover image
//                                      rather than a carousel selection
//   quality_score    227 rows (5.6%) — present on only 2 campaigns
//   focal_x/focal_y  230 rows (5.6%) — present on only 3 campaigns
//   aspect_ratio     0 rows
//   sort_order       0 on every row of the reference campaign; 14 distinct
//                    values across the whole library
//
// So quality_score and focal_* cannot carry a general rule and are not used.
// ============================================================

import type { Media } from "@/lib/types";

/**
 * The still to display for one media row.
 *
 * 890 of 4,077 non-thumbnail rows (21.8%) are `type: "video"` — .MOV and .mp4
 * files. Handing those to an <img> is why hero slides and gallery tiles were
 * silently dropping: they cannot render. 2,860 rows carry a `thumbnail_url`,
 * which is the still for exactly this purpose.
 *
 * Returns null when a video has no thumbnail — there is nothing to show, and
 * the caller filters it out rather than rendering a broken frame.
 */
export function stillFor(m: Media): string | null {
  if (m.type === "video") return m.thumbnail_url || null;
  return m.file_url || m.thumbnail_url || null;
}

export interface HeroStill {
  mediaId: string;
  url: string;
}

/** Ascending, nulls last — an unset order must not sort ahead of a set one. */
function byNullableNumber(a: number | null | undefined, b: number | null | undefined): number {
  const av = a ?? Number.POSITIVE_INFINITY;
  const bv = b ?? Number.POSITIVE_INFINITY;
  return av - bv;
}

function byCreatedAt(a: Media, b: Media): number {
  return (a.created_at || "").localeCompare(b.created_at || "");
}

/**
 * Pick the hero stills, in order.
 *
 * Two tiers, and the first one that exists wins outright:
 *
 *   1. An explicit selection — any row with `public_hero`. These are used and
 *      NOTHING else is, ordered by `public_hero_order`. That is the point: once
 *      a person has chosen, the fallback must not add to their choice, reorder
 *      it, or quietly pad it out to four. Choosing two stills means two.
 *
 *   2. No explicit selection — everything usable, ordered `is_hero` first, then
 *      `sort_order`, then `created_at`. `is_hero` is a lead, not a selection:
 *      it is true on at most one row per campaign, so it promotes that image to
 *      the front and the rest fills in behind it deterministically.
 *
 * `limit` caps the fallback only. An explicit selection is returned whole —
 * if someone picks six, they get six.
 */
export function selectHeroStills(media: Media[], limit = 4): HeroStill[] {
  const usable = media
    .filter((m) => !m.is_video_thumbnail)
    .map((m) => ({ m, url: stillFor(m) }))
    .filter((x): x is { m: Media; url: string } => !!x.url);

  const chosen = usable.filter((x) => x.m.public_hero === true);
  if (chosen.length > 0) {
    return chosen
      .sort(
        (a, b) =>
          byNullableNumber(a.m.public_hero_order, b.m.public_hero_order) ||
          byNullableNumber(a.m.sort_order, b.m.sort_order) ||
          byCreatedAt(a.m, b.m),
      )
      .map((x) => ({ mediaId: x.m.id, url: x.url }));
  }

  return usable
    .sort(
      (a, b) =>
        Number(!!b.m.is_hero) - Number(!!a.m.is_hero) ||
        byNullableNumber(a.m.hero_order, b.m.hero_order) ||
        byNullableNumber(a.m.sort_order, b.m.sort_order) ||
        byCreatedAt(a.m, b.m),
    )
    .slice(0, limit)
    .map((x) => ({ mediaId: x.m.id, url: x.url }));
}
