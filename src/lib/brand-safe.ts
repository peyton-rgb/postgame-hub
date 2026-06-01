// Brand-safe copy helper.
//
// NCAA aggressively protects a handful of tournament trademarks. Any
// brand-facing campaign name or caption shown in the portal must run through
// brandSafe() so we never surface those terms to a client. Replacement is
// case-insensitive and matches the whole phrase (word-boundaried so we don't
// mangle longer words).

const REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bMarch Madness\b/gi, "Tournament"],
  [/\bFinal Four\b/gi, "National Semifinal"],
  [/\bElite Eight\b/gi, "Regional Final"],
  [/\bSweet Sixteen\b/gi, "Round of 16"],
];

export function brandSafe(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
