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
          content: "Search the web right now for college athletes trending in April 2026. List 10 full names as a JSON array: [\"Name One\", \"Name Two\"]",
        }],
      }),
    });
    const data = await response.json();
    return NextResponse.json({ 
      status: response.status,
      contentTypes: data.content?.map((b: any) => b.type),
      fullData: JSON.stringify(data).slice(0, 1000),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
