// src/lib/team-folders.ts
// ─────────────────────────────────────────────────────────────
// Team-folder detection for the content upload picker.
//
// A "team folder" is a Drive folder like "UF Softball (DSG)" that
// holds content for multiple athletes from the same school + sport,
// rather than one athlete's personal folder. We detect these by:
//   1. parsing the folder name into { school, sport }
//   2. finding 2+ roster athletes whose school + sport both match.
//
// The school-abbreviation lookup (UF -> University of Florida) lives
// in the Supabase `school_aliases` table so it can be edited without
// a code deploy. Sports are matched against KNOWN_SPORTS below.
// ─────────────────────────────────────────────────────────────

import type { createBrowserSupabase } from "@/lib/supabase";

type SupabaseClient = ReturnType<typeof createBrowserSupabase>;

/** alias (UPPERCASE) -> canonical school name */
export type SchoolAliasMap = Map<string, string>;

/**
 * Minimal roster shape needed for team matching. The full `Athlete` type
 * satisfies this structurally, so callers can pass either.
 */
export interface RosterAthlete {
  id: string;
  name: string;
  school: string;
  sport: string;
}

// Common college sports. Extend freely — matching is case-insensitive
// and ignores punctuation/spacing. Multi-word sports are supported.
export const KNOWN_SPORTS = [
  "Softball", "Baseball", "Football", "Basketball", "Soccer",
  "Volleyball", "Lacrosse", "Gymnastics", "Track", "Cross Country",
  "Swimming", "Diving", "Tennis", "Golf", "Hockey", "Rowing",
  "Wrestling", "Beach Volleyball", "Field Hockey", "Water Polo",
  "Equestrian", "Bowling",
];

/** Lowercase + strip everything except letters/numbers, for loose matching. */
function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
}

/** Load the alias table once and return an UPPERCASE-keyed map. */
export async function fetchSchoolAliases(supabase: SupabaseClient): Promise<SchoolAliasMap> {
  const { data } = await supabase.from("school_aliases").select("alias, school_name");
  const map: SchoolAliasMap = new Map();
  for (const row of data || []) {
    map.set(String(row.alias).toUpperCase().trim(), String(row.school_name));
  }
  return map;
}

export interface ParsedTeamFolder {
  /** canonical school name if the abbreviation was recognized, else the raw token */
  school: string;
  /** the raw abbreviation/token that was matched as the school */
  schoolToken: string;
  /** matched sport from KNOWN_SPORTS */
  sport: string;
}

/**
 * Parse a folder name into { school, sport }. Returns null if we can't
 * find BOTH a known sport and a leading school token.
 *
 * Examples:
 *   "UF Softball (DSG)"      -> { school: "University of Florida", sport: "Softball" }
 *   "Florida State Baseball" -> { school: "Florida State University"? , sport: "Baseball" }
 *                               (only if "Florida State" is a known alias; otherwise
 *                                school falls back to the raw leading text)
 */
export function parseTeamFolderName(
  folderName: string,
  aliasMap: SchoolAliasMap,
): ParsedTeamFolder | null {
  if (!folderName) return null;

  // Drop trailing parenthetical tags like "(DSG)".
  const cleaned = folderName.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  // Find a known sport anywhere in the name (prefer the longest match so
  // "Beach Volleyball" wins over "Volleyball").
  const sorted = [...KNOWN_SPORTS].sort((a, b) => b.length - a.length);
  const sport = sorted.find((s) => norm(cleaned).includes(norm(s)));
  if (!sport) return null;

  // Everything before the sport is the school portion.
  const lower = cleaned.toLowerCase();
  const sportIdx = lower.indexOf(sport.toLowerCase().split(" ")[0]);
  const schoolToken = (sportIdx > 0 ? cleaned.slice(0, sportIdx) : cleaned).trim();
  if (!schoolToken) return null;

  // Resolve the school: exact alias hit, else leave the raw token.
  const aliasHit = aliasMap.get(schoolToken.toUpperCase());
  const school = aliasHit || schoolToken;

  return { school, schoolToken, sport };
}

/** Does this athlete's school field match the parsed school? (loose) */
function schoolMatches(athleteSchool: string, parsed: ParsedTeamFolder): boolean {
  const a = norm(athleteSchool);
  if (!a) return false;
  const canonical = norm(parsed.school);
  const token = norm(parsed.schoolToken);
  // match on canonical name, the abbreviation, or either containing the other
  return (
    a === canonical ||
    a === token ||
    (canonical.length >= 3 && (a.includes(canonical) || canonical.includes(a)))
  );
}

/** Does this athlete's sport match the parsed sport? (loose) */
function sportMatches(athleteSport: string, parsed: ParsedTeamFolder): boolean {
  const a = norm(athleteSport);
  const s = norm(parsed.sport);
  if (!a || !s) return false;
  return a === s || a.includes(s) || s.includes(a);
}

export interface TeamFolderMatch extends ParsedTeamFolder {
  athletes: RosterAthlete[];
}

/**
 * Given a folder name and the recap roster, return a team match IF the
 * folder parses into school+sport AND 2+ roster athletes match both.
 * Returns null otherwise (caller falls back to "No folder match").
 */
export function matchTeamFolder(
  folderName: string,
  aliasMap: SchoolAliasMap,
  roster: RosterAthlete[],
): TeamFolderMatch | null {
  const parsed = parseTeamFolderName(folderName, aliasMap);
  if (!parsed) return null;

  const athletes = roster.filter(
    (a) => schoolMatches(a.school, parsed) && sportMatches(a.sport, parsed),
  );
  if (athletes.length < 2) return null;

  return { ...parsed, athletes };
}
