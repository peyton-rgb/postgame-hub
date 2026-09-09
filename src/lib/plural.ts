// ============================================================
// Pluralisation for stat labels.
//
// Stat strips read "<figure> <label>", and the labels were written plural and
// left that way — so a brand with one sport rendered "1 SPORTS", and a partner
// of under a year rendered "<1 YRS PARTNER" because the count was 0 while the
// label only checked for exactly 1.
//
// The count that decides the label is not always the number displayed: "<1" is
// shown for a partner of less than a year, and that takes the SINGULAR unit.
// So `pluralize` takes the count, and callers pass what they mean.
// ============================================================

/**
 * Pick the singular or plural form for a count.
 *
 *   pluralize(1, "Sport")            -> "Sport"
 *   pluralize(2, "Sport")            -> "Sports"
 *   pluralize(0, "Sport")            -> "Sports"   (zero takes the plural)
 *   pluralize(1, "Match", "Matches") -> "Match"
 *
 * `plural` defaults to the singular plus "s"; pass it explicitly for anything
 * irregular.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return Math.abs(count) === 1 ? singular : (plural ?? singular + "s");
}

/**
 * The label for a "years as a partner" stat, where a partner of under a year is
 * displayed as "<1" but still reads as one unit: "<1 Yr Partner", never
 * "<1 Yrs Partner".
 */
export function yearsLabel(years: number, suffix = "Partner"): string {
  return `${years <= 1 ? "Yr" : "Yrs"} ${suffix}`.trim();
}
