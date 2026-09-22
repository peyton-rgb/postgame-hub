import { Anthropic } from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import crypto from "crypto";

// Slack only waits 3 seconds for us to respond, so the model calls run in the
// background after we've already replied 200. This caps how long that
// background work may run before Vercel stops the function.
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Your project definitions
const PROJECTS = [
  "postgame-hub",
  "postgame-new-admin",
  "postgame-website-rebuild",
  "postgame-media-dashboard",
  "marketing-agency-website",
  "postgame-graphics",
  "video-editing-agent",
  "postgame-public-website",
  "daily-sports-briefing",
];

// Verify Slack request signature to ensure requests come from Slack
function verifySlackSignature(request: Request, body: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn("SLACK_SIGNING_SECRET not configured");
    return false;
  }

  const slackSignature = request.headers.get("x-slack-signature");
  const slackRequestTimestamp = request.headers.get("x-slack-request-timestamp");

  if (!slackSignature || !slackRequestTimestamp) {
    return false;
  }

  // Verify timestamp isn't older than 5 minutes (prevents replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(slackRequestTimestamp);
  if (Math.abs(now - requestTime) > 300) {
    return false;
  }

  // Create the base string: v0:timestamp:body
  const baseString = `v0:${slackRequestTimestamp}:${body}`;

  // Compute expected signature
  const expectedSignature = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex")}`;

  // timingSafeEqual throws on buffers of different lengths, which would turn a
  // bad signature into a 500 instead of a 401
  if (slackSignature.length !== expectedSignature.length) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(slackSignature),
    Buffer.from(expectedSignature)
  );
}

// Strip markdown code fences and parse JSON safely
function parseJsonResponse(text: string): any {
  let cleaned = text.trim();

  // Remove markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

type CascadeResult = {
  model: "haiku" | "claude";
  project: string;
  answer: string;
  // Haiku's self-rated 1-10 score. On escalation this is the low score that
  // triggered it; Sonnet doesn't rate itself.
  haikuConfidence: number;
};

// Haiku answers first; if it isn't confident, escalate to Sonnet.
async function runCascade(prompt: string): Promise<CascadeResult> {
  // Step 1: Send to Haiku (cheap model)
  const haikusystemPrompt = `You are a helpful assistant that:
1. Classifies the user's request into one of these projects: ${PROJECTS.join(", ")}
2. Answers their question if you can
3. Rates your confidence in the answer (1-10 scale)

Respond in this JSON format:
{
  "project": "project_name",
  "answer": "your answer here",
  "confidence": 8,
  "reasoning": "why you chose this project and confidence level"
}`;

  const haikusResponse = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: haikusystemPrompt,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const haikusContent =
    haikusResponse.content[0].type === "text"
      ? haikusResponse.content[0].text
      : "";

  let haikusResult = parseJsonResponse(haikusContent);

  // If parsing failed, set safe fallback
  if (!haikusResult) {
    haikusResult = {
      project: "general",
      answer: haikusContent,
      confidence: 5,
      reasoning: "Failed to parse JSON response",
    };
  }

  // Step 2: Check confidence threshold
  if (haikusResult.confidence >= 7) {
    // Haiku is confident - return its answer
    return {
      model: "haiku",
      project: haikusResult.project,
      answer: haikusResult.answer,
      haikuConfidence: haikusResult.confidence,
    };
  }

  // Step 3: Escalate to Claude (expensive model)
  const claudeSystemPrompt = `You are a helpful assistant for a sports NIL marketing agency called Postgame.
The user's request may have been partially classified as: ${haikusResult.project}
Provide a comprehensive answer to their question.`;

  const claudeResponse = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 2048,
    system: claudeSystemPrompt,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const claudeAnswer =
    claudeResponse.content[0].type === "text"
      ? claudeResponse.content[0].text
      : "";

  return {
    model: "claude",
    project: haikusResult.project,
    answer: claudeAnswer,
    haikuConfidence: haikusResult.confidence,
  };
}

// The models write standard markdown, but Slack uses its own "mrkdwn":
// *bold* not **bold**, <url|label> not [label](url), and no # headings.
// Without this, answers show up littered with literal ** and ##.
function toSlackMrkdwn(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "<$2|$1>");
}

function formatReply(result: CascadeResult): string {
  const model =
    result.model === "haiku"
      ? `Haiku (confidence ${result.haikuConfidence}/10)`
      : `Sonnet (escalated — Haiku was ${result.haikuConfidence}/10)`;

  return [
    toSlackMrkdwn(String(result.answer).trim()),
    "",
    "───",
    `*Project:* ${result.project}   ·   *Model:* ${model}`,
  ].join("\n");
}

// Post straight into the channel feed. No thread_ts, so the answer is a new
// top-level message rather than a reply nested under the question.
async function postToChannel(channel: string, text: string) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify({
      channel,
      text,
      unfurl_links: false,
    }),
  });
  // Slack returns HTTP 200 even on failure; the real result is in `ok`.
  const data = await res.json();
  if (!data.ok) {
    console.error("Cascade: chat.postMessage failed:", data.error);
  }
}

// Runs after the 200 has gone back to Slack.
async function answerInChannel(channel: string, prompt: string) {
  try {
    const result = await runCascade(prompt);
    await postToChannel(channel, formatReply(result));
  } catch (error) {
    console.error("Cascade error:", error);
    await postToChannel(
      channel,
      "Sorry — something went wrong answering that. Try again in a minute."
    );
  }
}

export async function POST(request: Request) {
  // Get raw body for signature verification
  const body = await request.text();

  // Step 0: Verify Slack signature
  if (!verifySlackSignature(request, body)) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Slack sends this once when you save the Request URL in the app settings,
  // to confirm the endpoint is ours. Echo the challenge back.
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  // If Slack thinks we missed the 3-second window it resends the same event.
  // The first delivery is already being answered, so ignore the retry rather
  // than post a duplicate answer.
  if (request.headers.get("x-slack-retry-num")) {
    return new Response(null, { status: 200 });
  }

  const event = payload.event;

  // Only answer plain messages from people. Skipping bot_id is what stops the
  // bot answering its own posts in an endless loop; skipping subtypes
  // drops edits, deletes, joins and other non-message noise.
  const isHumanMessage =
    payload.type === "event_callback" &&
    event?.type === "message" &&
    !event.bot_id &&
    !event.subtype &&
    typeof event.text === "string" &&
    event.text.trim() !== "";

  // One line per event so the Vercel logs show what Slack is actually sending.
  // Deliberately no message text.
  console.log(
    `Cascade: ${payload.type}/${event?.type ?? "-"}` +
      `${event?.subtype ? `/${event.subtype}` : ""}` +
      ` channel=${event?.channel ?? "-"} bot=${Boolean(event?.bot_id)}` +
      ` → ${isHumanMessage ? "answering" : "ignored"}`
  );

  if (isHumanMessage) {
    waitUntil(answerInChannel(event.channel, event.text));
  }

  // Acknowledge immediately so Slack doesn't time out and retry.
  return new Response(null, { status: 200 });
}
