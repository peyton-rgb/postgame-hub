import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { athleteList } = await req.json();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      tools: [{ type: "web_search_20250305", name: "web_search" } as any],
      messages: [{
        role: "user",
        content: `Search for college athletes trending in the news right now — NIL deals, viral moments, draft buzz, tournament performances, award winners from the past 2 weeks.\n\nCross-reference against this Postgame Tier 1 athlete list:\n${athleteList}\n\nReturn ONLY a JSON array of top 4 matches. No other text:\n[{"name": "Full Name", "reason": "one sentence why trending"}]\n\nIf fewer than 4 match return however many. If none return [].`
      }],
    });
    const textBlock = response.content?.find((b: any) => b.type === "text");
    const text = textBlock ? (textBlock as any).text : "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    return NextResponse.json({ result: clean });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
