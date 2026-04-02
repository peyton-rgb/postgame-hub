import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { athleteList } = await req.json();
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "web-search-2025-03-05",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Search for college athletes trending in the news right now — NIL deals, viral moments, draft buzz, tournament performances, award winners from the past 2 weeks.\n\nCross-reference against this Postgame Tier 1 athlete list:\n${athleteList}\n\nReturn ONLY a JSON array of top 4 matches. No other text:\n[{"name": "Full Name", "reason": "one sentence why trending"}]\n\nIf fewer than 4 match return however many. If none return [].`,
        }],
      }),
    });
    const data = await response.json();
    const textBlock = data.content?.find((b: any) => b.type === "text");
    const text = textBlock?.text || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    return NextResponse.json({ result: clean });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
