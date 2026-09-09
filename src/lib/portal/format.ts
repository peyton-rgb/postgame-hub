// Display formatting for portal surfaces.

/**
 * Institutions whose names ARE their initials. Left uppercase.
 * A name is only here if the letters are genuinely an abbreviation — "PURDUE"
 * is a word, not an acronym, and title-cases to "Purdue" like anything else.
 */
const ACRONYMS = new Set([
  "LSU", "UCLA", "UCF", "SMU", "USC", "TCU", "BYU", "UNLV", "UAB", "UTEP",
  "VCU", "FIU", "FAU", "ECU", "ODU", "UNC", "UNI", "UTSA", "UMBC", "UIC",
  "NYU", "MIT", "SUNY", "CUNY", "IUPUI", "UMASS", "UNCW", "UTA", "UNT",
  "USF", "UAH", "UNCG", "UMKC", "UMD", "UGA", "UF", "OSU", "ASU", "PSU",
  "MSU", "NC", "TX", "US", "USA", "HBCU", "A&M", "A&T", "II", "III", "IV",
]);

/** Names with a settled internal capitalisation that title-casing would ruin. */
const SPECIAL: Record<string, string> = {
  UCONN: "UConn",
  "TEXAS A&M": "Texas A&M",
  MCNEESE: "McNeese",
  "MCNEESE STATE": "McNeese State",
};

/** Lowercase inside a name, never at the start. */
const SMALL = new Set(["of", "the", "at", "and", "in", "for", "on", "an"]);

function titleWord(w: string, acronyms: Set<string> = ACRONYMS): string {
  if (w.length === 0) return w;
  const upper = w.toUpperCase();
  if (acronyms.has(upper)) return upper;
  // Single letters are initials — "A & M", "J. Smith".
  if (/^[A-Za-z]\.?$/.test(w)) return w.toUpperCase();
  // Ordinals and anything with a digit keep their shape.
  if (/\d/.test(w)) return w.toUpperCase();
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * Title-case a school name for display, leaving acronyms alone.
 *
 * Hyphens, ampersands and "A & M" survive because the split keeps its
 * separators and single letters stay uppercase.
 */
export function titleCaseSchool(raw: string | null | undefined): string | null {
  return titleCaseName(raw, ACRONYMS, SPECIAL);
}

/**
 * Sports whose names ARE initials. "WBB Coach" already carries a lowercase
 * letter and so never reaches the caser, but the set is what makes an
 * all-caps "WBB" safe too.
 */
const SPORT_ACRONYMS = new Set(["WBB", "MBB", "XC", "T&F", "MMA"]);

/**
 * Title-case a sport for display. Same conditional rule as a school name, and
 * for the same reason: `athletes.sport` holds both shapes, often for the same
 * sport — 369 rows say "TRACK & FIELD" and 123 say "Track & Field", 209 say
 * "FOOTBALL" and 64 say "Football". Shouting at a brand in one row and not
 * the next is the tell that nobody formatted this column.
 *
 * The ampersand survives: it is its own space-separated part, and the
 * small-word rule only applies to parts longer than one character.
 */
export function titleCaseSport(raw: string | null | undefined): string | null {
  return titleCaseName(raw, SPORT_ACRONYMS, {});
}

/**
 * The shared caser.
 *
 * WHY THIS IS CONDITIONAL. Both columns hold three shapes, all real:
 *   "MICHIGAN STATE UNIVERSITY"   shouting, needs casing
 *   "LSU" / "UCLA" / "UCONN"      initials, must not be touched
 *   "Alabama" / "Texas Tech"      already correct, must not be re-cased
 * So a value that ALREADY contains a lowercase letter is returned untouched —
 * re-casing it can only do damage, and someone typed it deliberately. Only
 * all-caps values are converted.
 */
function titleCaseName(
  raw: string | null | undefined,
  acronyms: Set<string>,
  special: Record<string, string>
): string | null {
  if (!raw) return null;
  const value = raw.trim().replace(/\s+/g, " ");
  if (value === "") return null;

  // Already mixed case — someone formatted it; leave it be.
  if (/[a-z]/.test(value)) return value;

  const exact = special[value.toUpperCase()];
  if (exact) return exact;
  if (acronyms.has(value.toUpperCase())) return value.toUpperCase();

  // Split on spaces but keep separators so "BETHUNE - COOKMAN" and
  // "A & M" come back with their punctuation intact.
  const parts = value.split(" ");
  return parts
    .map((part, i) => {
      if (part === "-" || part === "&" || part === "–") return part;
      const lower = part.toLowerCase();
      // length > 1 guards the standalone initial in "A & M" / "A & T", which
      // would otherwise be lowercased as the article "a". Every real small
      // word here is at least two characters.
      if (i > 0 && lower.length > 1 && SMALL.has(lower)) return lower;
      // Hyphenated compounds get each half cased: "WINSTON-SALEM".
      if (part.includes("-")) return part.split("-").map((w) => titleWord(w, acronyms)).join("-");
      return titleWord(part, acronyms);
    })
    .join(" ");
}

/** First letters of the first two words. The no-photo fallback everywhere. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * 933000 -> "933K", 1100000 -> "1.1M".
 *
 * One definition for every portal surface that prints a count. Previously
 * four identical copies (pages-data, dashboard-data, AthletesGrid,
 * CampaignDetail) drifting independently.
 */
export function compact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}
