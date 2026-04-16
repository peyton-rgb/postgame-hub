import { NextRequest, NextResponse } from "next/server";

// Map sport names to ESPN headshot path segments
const SPORT_PATHS: Record<string, string> = {
  football: "college-football",
  "men's basketball": "mens-college-basketball",
  "mens basketball": "mens-college-basketball",
  basketball: "mens-college-basketball",
  "women's basketball": "womens-college-basketball",
  "womens basketball": "womens-college-basketball",
  baseball: "college-baseball",
  softball: "college-softball",
  soccer: "mens-college-soccer",
  "women's soccer": "womens-college-soccer",
  "womens soccer": "womens-college-soccer",
  volleyball: "womens-college-volleyball",
  "track & field": "cross-country-track-and-field",
  "track and field": "cross-country-track-and-field",
  "cross country": "cross-country-track-and-field",
  // Pro leagues
  "pro football": "nfl",
  nfl: "nfl",
};

// Sports where ESPN has no women's headshots — skip fallback searches
const NO_WOMENS_HEADSHOTS = new Set([
  "gymnastics", "rowing", "swimming", "diving", "swimming & diving",
  "swimming and diving", "tennis", "golf", "lacrosse", "field hockey",
  "water polo", "beach volleyball", "equestrian", "fencing", "rifle",
  "skiing", "bowling", "ice hockey",
]);

function isFemaleGender(gender?: string): boolean {
  if (!gender) return false;
  const g = gender.toLowerCase().trim();
  return g === "female" || g === "f" || g === "women" || g === "woman" || g === "w";
}

function getSportPath(sport: string, gender?: string): string {
  const lower = sport.toLowerCase().trim();
  const match = SPORT_PATHS[lower];
  if (match) return match;

  const female = isFemaleGender(gender);
  if (female) {
    if (lower.includes("basketball")) return "womens-college-basketball";
    if (lower.includes("soccer")) return "womens-college-soccer";
    if (lower.includes("volleyball")) return "womens-college-volleyball";
    if (lower.includes("softball")) return "college-softball";
  }

  if (lower.includes("basketball")) return "mens-college-basketball";
  if (lower.includes("football")) return "college-football";
  if (lower.includes("baseball")) return "college-baseball";
  if (lower.includes("softball")) return "college-softball";
  if (lower.includes("soccer")) return "mens-college-soccer";
  if (lower.includes("volleyball")) return "womens-college-volleyball";
  if (lower.includes("track") || lower.includes("field") || lower.includes("cross country")) return "cross-country-track-and-field";

  return "college-football";
}

// Return sport paths in priority order based on gender.
// Female athletes: women's path first, men's path only as last resort.
// Male/unknown: men's path first, women's as fallback for ambiguous sports.
function getGenderedSportPaths(sport: string, gender?: string): string[] {
  const lower = sport.toLowerCase().trim();
  const female = isFemaleGender(gender);
  const paths: string[] = [];
  const seen = new Set<string>();
  const add = (p: string) => { if (!seen.has(p)) { seen.add(p); paths.push(p); } };

  if (female) {
    // Women's paths first
    if (lower.includes("basketball")) { add("womens-college-basketball"); add("mens-college-basketball"); }
    else if (lower.includes("softball")) { add("college-softball"); }
    else if (lower.includes("soccer")) { add("womens-college-soccer"); add("mens-college-soccer"); }
    else if (lower.includes("volleyball")) { add("womens-college-volleyball"); }
    else if (lower.includes("track") || lower.includes("field") || lower.includes("cross country")) { add("cross-country-track-and-field"); }
    else if (lower.includes("baseball")) { add("college-baseball"); }
    else if (lower.includes("football")) { add("college-football"); }
    else {
      // Unknown women's sport — try common women's paths
      add("womens-college-basketball");
      add("college-softball");
      add("womens-college-soccer");
      add("womens-college-volleyball");
    }
  } else {
    // Men's / unknown gender paths first
    if (lower.includes("basketball")) {
      add("mens-college-basketball");
      if (!gender) add("womens-college-basketball"); // try women's if gender unknown
    }
    else if (lower.includes("football")) { add("college-football"); }
    else if (lower.includes("baseball")) { add("college-baseball"); }
    else if (lower.includes("softball")) { add("college-softball"); }
    else if (lower.includes("soccer")) {
      add("mens-college-soccer");
      if (!gender) add("womens-college-soccer");
    }
    else if (lower.includes("volleyball")) { add("womens-college-volleyball"); }
    else if (lower.includes("track") || lower.includes("field") || lower.includes("cross country")) { add("cross-country-track-and-field"); }
    else {
      // Unknown sport — try the most common paths
      add("college-football");
      add("mens-college-basketball");
    }

    // Football as last-resort for everyone
    add("college-football");
  }

  return paths;
}

// Classify a sport path as men's or women's
function isMensPath(path: string): boolean {
  return path.startsWith("mens-") || path === "college-football" || path === "college-baseball" || path === "nfl";
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

function nameSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;

  const partsA = na.split(" ");
  const partsB = nb.split(" ");

  // Check if last names match and first name starts similarly
  const lastA = partsA[partsA.length - 1];
  const lastB = partsB[partsB.length - 1];
  if (lastA === lastB) {
    const firstA = partsA[0];
    const firstB = partsB[0];
    if (firstA === firstB) return 0.95;
    if (firstA.startsWith(firstB) || firstB.startsWith(firstA)) return 0.85;
    return 0.6;
  }

  // Check if all parts of one name appear in the other
  const allPartsMatch = partsA.every((p) => partsB.some((q) => q.includes(p) || p.includes(q)));
  if (allPartsMatch) return 0.7;

  return 0;
}

// Search ESPN and return the best matching athlete ID + score
async function searchEspn(
  query: string,
  matchName: string,
  minScore: number
): Promise<{ athleteId: string; score: number } | null> {
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(query)}&type=player&limit=10`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    const results: any[] = data?.results || data?.items || [];

    // Flatten: ESPN search can nest results under different keys
    const players: any[] = [];
    for (const r of results) {
      if (r.athletes) {
        players.push(...r.athletes);
      } else if (r.items) {
        players.push(...r.items);
      } else if (r.id || r.uid) {
        players.push(r);
      }
    }

    if (players.length === 0) return null;

    // Score each player by name similarity
    let bestPlayer: any = null;
    let bestScore = 0;

    for (const p of players) {
      const pName = p.displayName || p.name || p.shortName || "";
      const score = nameSimilarity(matchName, pName);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = p;
      }
    }

    if (!bestPlayer || bestScore < minScore) return null;

    // Extract athlete ID from the player object
    let athleteId: string | null = null;
    if (bestPlayer.id) {
      athleteId = String(bestPlayer.id);
    } else if (bestPlayer.uid) {
      const match = bestPlayer.uid.match(/a:(\d+)/);
      if (match) athleteId = match[1];
    } else if (bestPlayer.href) {
      const match = bestPlayer.href.match(/athletes\/(\d+)/);
      if (match) athleteId = match[1];
    } else if (bestPlayer.link) {
      const match = bestPlayer.link.match(/\/id\/(\d+)/);
      if (match) athleteId = match[1];
    }

    if (!athleteId) return null;
    return { athleteId, score: bestScore };
  } catch {
    return null;
  }
}

// Build a headshot URL and verify it doesn't 404
async function tryHeadshotUrl(athleteId: string, sportPath: string): Promise<string | null> {
  const url = `https://a.espncdn.com/combiner/i?img=/i/headshots/${sportPath}/players/full/${athleteId}.png&w=350&h=254`;
  try {
    const check = await fetch(url, { method: "HEAD" });
    if (check.ok) return url;
  } catch {
    // ignore
  }
  return null;
}

// Try all gendered sport paths for an athlete ID.
// For female athletes, require a high similarity score to accept a mens-path result.
async function tryAllPaths(
  athleteId: string,
  score: number,
  sportPaths: string[],
  female: boolean
): Promise<string | null> {
  for (const path of sportPaths) {
    // If female athlete and this is a men's path, only accept with high confidence
    if (female && isMensPath(path) && score < 0.85) continue;

    const url = await tryHeadshotUrl(athleteId, path);
    if (url) return url;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  const school = searchParams.get("school")?.trim() || "";
  const sport = searchParams.get("sport")?.trim() || "football";
  const gender = searchParams.get("gender")?.trim() || "";

  if (!name) {
    return NextResponse.json({ url: null, error: "name is required" }, { status: 400 });
  }

  const female = isFemaleGender(gender);

  // For sports where ESPN has no women's headshots, bail early
  if (female && NO_WOMENS_HEADSHOTS.has(sport.toLowerCase().trim())) {
    return NextResponse.json({ url: null });
  }

  const nameParts = name.split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  const sportPaths = getGenderedSportPaths(sport, gender);

  try {
    // ── Attempt 1: Full name search ──────────────────────────
    const result1 = await searchEspn(name, name, 0.5);
    if (result1) {
      const url = await tryAllPaths(result1.athleteId, result1.score, sportPaths, female);
      if (url) return NextResponse.json({ url });
    }

    // ── Attempt 2: Last name + school search ─────────────────
    if (lastName && school) {
      const fallbackQuery = `${lastName} ${school}`;
      const result2 = await searchEspn(fallbackQuery, name, 0.5);
      if (result2) {
        const url = await tryAllPaths(result2.athleteId, result2.score, sportPaths, female);
        if (url) return NextResponse.json({ url });
      }
    }

    // ── Attempt 3: Just last name search (broader) ───────────
    if (lastName && lastName.length >= 3 && lastName.toLowerCase() !== name.toLowerCase()) {
      const result3 = await searchEspn(lastName, name, 0.6);
      if (result3) {
        const url = await tryAllPaths(result3.athleteId, result3.score, sportPaths, female);
        if (url) return NextResponse.json({ url });
      }
    }

    return NextResponse.json({ url: null });
  } catch (e) {
    console.error("Headshot fetch error:", e);
    return NextResponse.json({ url: null });
  }
}
