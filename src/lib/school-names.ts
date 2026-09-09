// ============================================================
// School names — one canonical spelling per school.
//
// WHY THIS EXISTS. `deals.athlete_school` and `athletes.school` are free text
// typed by whoever entered the deal, and the same school arrives a dozen ways:
// "Texas", "University of Texas", "UNIVERSITY OF TEXAS", "TEXAS". On the deal
// ledger's school filter each of those was a separate facet, so a reader
// filtering by Texas saw a third of the Texas deals and no indication the rest
// existed. That is a correctness problem, not a tidiness one.
//
// WHY A FILE AND NOT A TABLE. This is a judgement list — "UNC means North
// Carolina", "Tallahassee is a city and we are not going to guess which school
// was meant". It belongs where it can be read in a diff and argued with in a
// PR. It is also the guard for data that arrives AFTER the one-time backfill:
// the database column is normalised, and /deals normalises again on render, so
// a fresh import spelt a new way cannot silently split a facet.
//
// SCOPE. `athletes.school` holds 1,416 distinct strings. The great majority can
// never reach a deal, so this covers the set that can: every value present in
// `deals.athlete_school` plus every value reachable through the exact-name
// backfill. Anything outside that passes through unchanged rather than being
// guessed at — a new facet is visible and fixable; a wrong merge is not.
// ============================================================

/**
 * The comparison key. Two strings that reduce to the same key are the same
 * school, so every rule here has to be one that cannot merge two real schools.
 *
 *   - first line only: some athletes.school values carry an import artefact
 *     on a second line ("Baylor\nRestaurants in Market: 3");
 *   - case, punctuation and spacing are dropped ("St. John's" -> "st johns",
 *     "Texas A&M" -> "texas a m");
 *   - a leading "university of" or a trailing "university" is dropped, which
 *     collapses "University of Texas", "Indiana University" and "Texas A&M
 *     University" onto the short forms without needing an entry each.
 */
export function schoolKey(raw: string): string {
  // Apostrophes are DELETED, not turned into a separator. Collapsing them with
  // the other punctuation gave "St. John's" the key "st john s" while
  // "St. Johns" gave "st johns", so the two never met and the canonical
  // spelling was unreachable.
  const base = raw.split("\n")[0].toLowerCase().replace(/['\u2019]/g, "");
  const flat = base.replace(/[^a-z0-9]+/g, " ").trim();
  return flat
    .replace(/^the university of /, "")
    .replace(/^university of /, "")
    .replace(/ university$/, "")
    .trim();
}

/**
 * The canonical spelling of each school: the short form a fan says out loud,
 * which is also what fits a filter chip.
 */
const CANONICAL = [
  "Alabama",
  "Arizona",
  "Arizona State",
  "Auburn",
  "Baylor",
  "Denver",
  "Duke",
  "FAU",
  "Florida",
  "Florida State",
  "Georgia",
  "Georgia Tech",
  "Gonzaga",
  "Houston",
  "Illinois",
  "Indiana",
  "Iowa",
  "Iowa State",
  "Kansas",
  "Kansas State",
  "Kentucky",
  "Liberty",
  "Louisville",
  "LSU",
  "Marquette",
  "Maryland",
  "Miami",
  "Michigan",
  "Michigan State",
  "Mississippi State",
  "NC State",
  "Nebraska",
  "North Carolina",
  "Notre Dame",
  "Ohio State",
  "Ole Miss",
  "Oregon",
  "Oregon State",
  "Penn State",
  "Providence",
  "Purdue",
  "Rice",
  "Rutgers",
  "South Carolina",
  "Stanford",
  "St. John's",
  "Syracuse",
  "Tennessee",
  "Texas",
  "Texas A&M",
  "Texas Tech",
  "UCLA",
  "UConn",
  "USC",
  "USF",
  "Utah",
  "Vanderbilt",
  "Virginia",
  "Washington",
] as const;

const BY_KEY = new Map<string, string>(CANONICAL.map((n) => [schoolKey(n), n]));

/**
 * Spellings the key rules cannot reach on their own: abbreviations, typos, and
 * one string carrying a pro-team note. Every entry here is a merge somebody
 * should be able to challenge, which is why they are written out rather than
 * inferred by fuzzy matching.
 */
const ALIASES: Record<string, string> = {
  // Abbreviations.
  fsu: "Florida State",
  unc: "North Carolina",
  tamu: "Texas A&M",
  "north carolina state": "NC State",
  "north carolina state basketball": "NC State",

  // Typos, kept because the intent is not in doubt.
  illinos: "Illinois",
  perdue: "Purdue",
  tennesse: "Tennessee",

  // "LSU / Mariners" — the school and an MLB affiliation in one field.
  "lsu mariners": "LSU",
};

/**
 * Values that look like a school but are not one, or are too vague to resolve.
 * These are left ALONE rather than guessed: "Tallahassee" is a city, and while
 * Florida State is in it, so is Florida A&M. Deciding is Peyton's, not mine.
 */
const UNRESOLVED = new Set([
  // A city, not a school. Florida State is in Tallahassee and so is Florida
  // A&M; deciding which was meant is Peyton's call, not a rule's.
  "tallahassee",
  // One athlete row naming two schools. Picking either would be inventing a
  // fact about a real person.
  "florida and uconn",
]);

/**
 * The canonical name for one raw school string.
 *
 * Returns null when there is nothing usable — empty, whitespace, or a value on
 * the unresolved list. Returns the input's own first line, trimmed, when the
 * school is simply not one this file knows: an unrecognised school shows up as
 * its own facet, which is visible and fixable, whereas folding it into the
 * nearest match would be a silent error.
 */
export function canonicalSchool(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw.split("\n")[0].trim();
  if (!first) return null;

  const k = schoolKey(first);
  if (!k || UNRESOLVED.has(k)) return null;

  return ALIASES[k] ?? BY_KEY.get(k) ?? first;
}

/** Every canonical name, for tests and for anything that needs the whole set. */
export const CANONICAL_SCHOOLS: readonly string[] = CANONICAL;
