// ============================================================
// Raw Anthropic proxy.
//
// This forwards a caller's body to api.anthropic.com with the SERVER's key.
// It had no auth, no spend cap and no logging, which made it a way for anyone
// who could reach the deployment to spend the Hub's Anthropic balance. It also
// has no callers anywhere in this repo (grep: nothing outside this file), so
// the safe shape is: staff only, capped, logged, and refusing by default.
//
// Set ALLOW_RAW_CLAUDE_PROXY=1 to enable it at all. Without that it answers
// 404 — a route nobody calls should not be reachable.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { assertAgentBudget } from "@/lib/agents/budget";
import { trackedCall } from "@/lib/agents/run-log";

export async function POST(req: NextRequest) {
  // Off unless someone deliberately turns it on.
  if (process.env.ALLOW_RAW_CLAUDE_PROXY !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const staff = await getStaffUser();
  if (!staff) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "No AI provider key configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as { messages?: unknown }).messages)) {
    return NextResponse.json({ error: "Body must carry a messages array." }, { status: 400 });
  }

  const db = createServiceSupabase();
  // Same cap as the editor agent — one budget covers whatever this proxies.
  const budget = await assertAgentBudget(db, "editor", {
    triggeredBy: staff.id,
    context: { route: "api/claude" },
  });
  if (!budget.allowed) {
    return NextResponse.json({ error: `Skipped — ${budget.reason}` }, { status: 429 });
  }

  const client = new Anthropic();
  const payload = body as Anthropic.MessageCreateParamsNonStreaming;

  try {
    // trackedCall writes the agent_runs row and the token spend, so this call
    // shows up in the same ledger as every other model call.
    const message = await trackedCall(
      db,
      { agentName: "editor", model: String(payload.model ?? "unknown"), triggerSource: "user" },
      () => client.messages.create({ ...payload, stream: false }),
    );
    return NextResponse.json(message);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Anthropic call failed: ${detail}` }, { status: 502 });
  }
}
