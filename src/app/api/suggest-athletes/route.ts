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
          content: `You are helping a sports media company find which of their contracted athletes are currently in the news.

Search the web for recent news (past 2 weeks) about college athletes in NIL deals, sports tournaments, the NFL/NBA draft, viral moments, or any major college sports coverage.

Here is a list of our contracted athletes:
${athleteList}

Search for news about athletes on this list. Return a JSON array of UP TO 4 athletes from the list who have recent news coverage. Be generous with matches - if you find any news at all about someone on the list, include them.

Return ONLY this JSON format, nothing else:
[{"name": "exact name from the list above", "reason": "one sentence describing their recent news"}]

If truly none have any recent news, return [].`,
        }],
      }),
    });
    const data = await response.json();
    const allText = data.content?.map((b: any) => b.type === "text" ? b.text : "").join("") || "[]";
    const jsonMatch = allText.match(/\[.*?\]/s);
    const clean = jsonMatch ? jsonMatch[0] : "[]";
    return NextResponse.json({ result: clean, raw: allText.slice(0, 500) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
