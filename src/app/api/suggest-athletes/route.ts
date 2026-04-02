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
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{
          role: "user",
          content: `Search the web for the top trending college athletes right now in April 2026. Look for NIL news, viral social media moments, draft coverage, tournament standouts, award winners, and any major college sports headlines.

Here is a list of athletes from our talent roster:
${athleteList}

Search for recent news about athletes on this list. Find which ones have been in the news recently. Return a JSON array of up to 4 athletes from the list who are most currently relevant, with a brief reason. Return ONLY valid JSON, no other text:
[{"name": "exact name from list", "reason": "why they are trending now"}]`,
        }],
      }),
    });
    const data = await response.json();
    const textBlock = data.content?.find((b: any) => b.type === "text");
    const text = textBlock?.text || "[]";
    const jsonMatch = text.match(/\[.*\]/s);
    const clean = jsonMatch ? jsonMatch[0] : "[]";
    return NextResponse.json({ result: clean });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
