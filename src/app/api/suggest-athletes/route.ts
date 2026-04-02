import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
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
          content: "Search the web for college athletes who are in the news right now in April 2026. Look for NIL deals, NCAA tournament, NFL draft prospects, viral moments, award winners. Give me a list of 20 college athlete full names who are currently trending. Return ONLY a JSON array of names, nothing else: [\"Name One\", \"Name Two\", ...]",
        }],
      }),
    });
    const data = await response.json();
    const allText = data.content?.map((b: any) => b.type === "text" ? b.text : "").join("") || "[]";
    const jsonMatch = allText.match(/\[.*?\]/s);
    const names: string[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return NextResponse.json({ names, raw: allText.slice(0, 800) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
