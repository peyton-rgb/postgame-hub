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

function getSportPath(sport: string, gender?: string): string {
  const lower = sport.toLowerCase().trim();
  const match = SPORT_PATHS[lower];
  if (match) return match;

  // If gender is provided, use it to disambiguate
  const isFemale = gender?.toLowerCase() === "female" || gender?.toLowerCase() === "f" || gender?.toLowerCase() === "women";
  if (isFemale) {
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

// Get alternate sport paths to try when the primary doesn't work
function getAlternateSportPaths(sport: string, gender?: string): string[] {
  const primary = getSportPath(sport, gender);
  const alts: string[] = [];
  const lower = sport.toLowerCase().trim();
  const isFemale = gender?.toLowerCase() === "female" || gender?.toLowerCase() === "f" || gender?.toLowerCase() === "women";

  if (lower.includes("basketball") && !gender) {
    // Try both genders if not specified
    if (primary !== "womens-college-basketball") alts.push("womens-college-basketball");
    if (primary !== "mens-college-basketball") alts.push("mens-college-basketball");
  }
  if (lower.includes("soccer")) {
    if (primary !== "womens-college-soccer") alts.push("womens-college-soccer");
    if (primary !== "mens-college-soccer") alts.push("mens-college-soccer");
  }
  if (lower.includes("softball") && primary !== "college-softball") {
    alts.push("college-softball");
  }
  if ((lower.includes("track") || lower.includes("field")) && primary !== "cross-country-track-and-field") {
    alts.push("cross-country-track-and-field");
  }
  if (lower.includes("baseball") && primary !== "college-baseball") {
    alts.push("college-baseball");
  }

  // Always try football as a last-resort alternate if it wasn't primary
  if (primary !== "college-football" && !alts.includes("college-football")) {
    alts.push("college-football");
  }

  return alts;
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  const school = searchParams.get("school")?.trim() || "";
  const sport = searchParams.get("sport")?.trim() || "football";
  const gender = searchParams.get("gender")?.trim() || "";

  if (!name) {
    return NextResponse.json({ url: null, error: "name is required" }, { status: 400 });
  }

  const nameParts = name.split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  const primarySportPath = getSportPath(sport, gender);

  try {
    // ── Attempt 1: Full name search ──────────────────────────
    const result1 = await searchEspn(name, name, 0.5);
    if (result1) {
      const url = await tryHeadshotUrl(result1.athleteId, primarySportPath);
      if (url) return NextResponse.json({ url });

      // Try alternate sport paths with the same athlete ID
      for (const altPath of getAlternateSportPaths(sport, gender)) {
        const url = await tryHeadshotUrl(result1.athleteId, altPath);
        if (url) return NextResponse.json({ url });
      }
    }

    // ── Attempt 2: Last name + school search ─────────────────
    if (lastName && school) {
      const fallbackQuery = `${lastName} ${school}`;
      const result2 = await searchEspn(fallbackQuery, name, 0.5);
      if (result2) {
        const url = await tryHeadshotUrl(result2.athleteId, primarySportPath);
        if (url) return NextResponse.json({ url });

        for (const altPath of getAlternateSportPaths(sport, gender)) {
          const url = await tryHeadshotUrl(result2.athleteId, altPath);
          if (url) return NextResponse.json({ url });
        }
      }
    }

    // ── Attempt 3: Just last name search (broader) ───────────
    if (lastName && lastName.length >= 3 && lastName.toLowerCase() !== name.toLowerCase()) {
      const result3 = await searchEspn(lastName, name, 0.6);
      if (result3) {
        const url = await tryHeadshotUrl(result3.athleteId, primarySportPath);
        if (url) return NextResponse.json({ url });

        for (const altPath of getAlternateSportPaths(sport, gender)) {
          const url = await tryHeadshotUrl(result3.athleteId, altPath);
          if (url) return NextResponse.json({ url });
        }
      }
    }

    return NextResponse.json({ url: null });
  } catch (e) {
    console.error("Headshot fetch error:", e);
    return NextResponse.json({ url: null });
  }
}
