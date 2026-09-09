// ============================================================
// Public-site statistics — ONE source of truth.
//
// Before this file the same claim appeared with different numbers on different
// pages: athletes were 70K+ on the homepage strip, 300+ in the homepage band,
// 60,000 on /clients and 70K+ on /services/scaled; campaigns were 300+, 500+
// and 394+ on three pages at once. A visitor moving between two pages could see
// both numbers inside ten seconds.
//
// So every public page imports from here. If a figure needs to change it
// changes once, and the pages cannot drift apart again.
//
// PROVENANCE MATTERS AS MUCH AS THE NUMBER. Each entry below says where it came
// from and how to recompute it. A figure nobody can source does not belong on
// the site — see IMPRESSIONS at the bottom.
// ============================================================

/**
 * Athletes who have created content for our partners since 2021.
 *
 * Source: Peyton, 5 Sep 2026, confirmed again 9 Sep. Not a database count —
 * it spans campaigns that predate the Hub, so there is no query that reproduces
 * it. Treat it as an editorial figure with a named owner rather than a
 * computed one.
 */
export const ATHLETES = "60,000+";

/**
 * Brand partners.
 *
 * Source: the `brands` table, rounded DOWN to the nearest ten so the claim is
 * always conservative. 132 rows on 9 Sep 2026 (126 of them unarchived).
 * Recompute:  select floor(count(*)/10.0)*10 from brands;
 */
export const BRAND_PARTNERS = "130+";

/**
 * Campaigns run.
 *
 * Source: the `campaign_recaps` table, rounded DOWN to the nearest ten.
 * 636 rows on 9 Sep 2026 (84 of them published as public recaps — the claim is
 * campaigns RUN, not recaps published, so the total is the right number).
 * Recompute:  select floor(count(*)/10.0)*10 from campaign_recaps;
 */
export const CAMPAIGNS = "630+";

/**
 * Years operating.
 * Source: Postgame founded 2021; 2026 - 2021 = 4 full years as of this writing.
 */
export const YEARS_IN_NIL = "4";

// ── IMPRESSIONS: DELIBERATELY ABSENT ──
//
// The homepage carried a "Total Impressions — 2B+" tile. It is not in this file
// because nobody can say where it came from: it is not in the codebase, and in
// the database it exists only as the tile's own value in pages.settings, which
// is the claim rather than its source. campaign_recaps does hold per-campaign
// impression metrics, so a real total is computable — but 2B could not be
// reproduced from them, and publishing a number we cannot source is worse than
// publishing no number at all.
//
// If the figure is wanted back, compute it from the metrics and add it here
// with the query that produced it.

/**
 * The numeric half and the suffix, for the homepage's animated counters, which
 * count up to `data-n` and then append `data-suf`.
 * "60,000+" -> { n: "60,000", suffix: "+" }
 */
export function splitStat(value: string): { n: string; suffix: string } {
  const m = value.match(/^([\d,.]+)(.*)$/);
  return m ? { n: m[1], suffix: m[2] } : { n: value, suffix: "" };
}
