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
  // Pro leagues
  "pro football": "nfl",
  nfl: "nfl",
};

function getSportPath(sport: string, gender?: string): string {
  const lower = sport.toLowerCase().trim();
  const match = SPORT_PATHS[lower];
  if (match) return match;

  // If gender is provided, use it to disambiguate
  if (gender?.toLowerCase() === "female" || gender?.toLowerCase() === "f" || gender?.toLowerCase() === "women") {
    if (lower.includes("basketball")) return "womens-college-basketball";
    if (lower.includes("soccer")) return "womens-college-soccer";
    if (lower.includes("volleyball")) return "womens-college-volleyball";
  }

  if (lower.includes("basketball")) return "mens-college-basketball";
  if (lower.includes("football")) return "college-football";
  if (lower.includes("baseball")) return "college-baseball";
  if (lower.includes("softball")) return "college-softball";
  if (lower.includes("soccer")) return "mens-college-soccer";
  if (lower.includes("volleyball")) return "womens-college-volleyball";

  return "college-football";
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.trim();
  const school = searchParams.get("school")?.trim() || "";
  const sport = searchParams.get("sport")?.trim() || "football";
  const gender = searchParams.get("gender")?.trim() || "";

  if (!name) {
    return NextResponse.json({ url: null, error: "name is required" }, { status: 400 });
  }

  try {
    const query = encodeURIComponent(name);
    const res = await fetch(
      `https://site.api.espn.com/apis/common/v3/search?query=${query}&type=player&limit=10`,
      { next: { revalidate: 86400 } }
    );

    if (!res.ok) {
      return NextResponse.json({ url: null });
    }

    const data = await res.json();
    const results: any[] = data?.results || data?.items || [];

    // Flatten: ESPN search can nest results under different keys
    let players: any[] = [];
    for (const r of results) {
      if (r.athletes) {
        players.push(...r.athletes);
      } else if (r.items) {
        players.push(...r.items);
      } else if (r.id || r.uid) {
        players.push(r);
      }
    }

    if (players.length === 0) {
      return NextResponse.json({ url: null });
    }

    // Score each player by name similarity
    let bestPlayer: any = null;
    let bestScore = 0;

    for (const p of players) {
      const pName = p.displayName || p.name || p.shortName || "";
      const score = nameSimilarity(name, pName);
      if (score > bestScore) {
        bestScore = score;
        bestPlayer = p;
      }
    }

    if (!bestPlayer || bestScore < 0.5) {
      return NextResponse.json({ url: null });
    }

    // Extract athlete ID from the player object
    let athleteId: string | null = null;
    if (bestPlayer.id) {
      athleteId = String(bestPlayer.id);
    } else if (bestPlayer.uid) {
      // UID format: "s:40~l:41~a:4432816"
      const match = bestPlayer.uid.match(/a:(\d+)/);
      if (match) athleteId = match[1];
    } else if (bestPlayer.href) {
      const match = bestPlayer.href.match(/athletes\/(\d+)/);
      if (match) athleteId = match[1];
    } else if (bestPlayer.link) {
      const match = bestPlayer.link.match(/\/id\/(\d+)/);
      if (match) athleteId = match[1];
    }

    if (!athleteId) {
      return NextResponse.json({ url: null });
    }

    const sportPath = getSportPath(sport, gender);
    const headshotUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/${sportPath}/players/full/${athleteId}.png&w=350&h=254`;

    // Verify the headshot actually exists (ESPN returns a generic silhouette for missing ones,
    // but it still returns 200, so we just check it doesn't 404)
    const check = await fetch(headshotUrl, { method: "HEAD" });
    if (!check.ok) {
      return NextResponse.json({ url: null });
    }

    return NextResponse.json({ url: headshotUrl });
  } catch (e) {
    console.error("Headshot fetch error:", e);
    return NextResponse.json({ url: null });
  }
}
