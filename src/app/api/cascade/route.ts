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
  // One line, or "" when there's nothing to do next.
  nextStep: string;
  // Haiku's self-rated 1-10 score. On escalation this is the low score that
  // triggered it; Sonnet doesn't rate itself.
  haikuConfidence: number;
};

// How every answer must read in Slack. Shared by both models so a question
// reads the same whichever one ends up answering it.
const STYLE_RULES = `How to write the answer:
- Plain English. Start with the answer itself: no title, no restating the question, no preamble, no sign-off.
- Put any code or commands in triple-backtick blocks.
- Define any technical term the first time you use it, in a few words.
- Keep it under about 150 words. No blank lines inside the answer.
- If a full answer genuinely needs more than that, set answer to exactly "I'll produce this as a document." and nothing else.

How to write next_step:
- One line: the single concrete action the person should take next.
- Use "" (an empty string) if there's no real next action. Don't invent one.`;

const CONFIDENCE_THRESHOLD = 7;

// Haiku answers first; if it isn't confident, escalate to Sonnet.
async function runCascade(prompt: string): Promise<CascadeResult> {
  // Step 1: Send to Haiku (cheap model)
  const haikusystemPrompt = `You are a helpful assistant for Postgame, a sports NIL marketing agency. You:
1. Classify the user's request into one of these projects: ${PROJECTS.join(", ")}
2. Answer their question if you can
3. Rate your confidence in the answer (1-10 scale)

${STYLE_RULES}

Respond with only this JSON:
{
  "project": "project_name",
  "answer": "your answer here",
  "next_step": "one line, or empty string",
  "confidence": 8
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
      next_step: "",
      confidence: 5,
    };
  }

  // A missing or non-numeric score counts as 0, which escalates.
  const haikuConfidence = Number(haikusResult.confidence) || 0;

  // Step 2: Check confidence threshold
  if (haikuConfidence >= CONFIDENCE_THRESHOLD) {
    // Haiku is confident - return its answer
    return {
      model: "haiku",
      project: haikusResult.project,
      answer: String(haikusResult.answer ?? ""),
      nextStep: String(haikusResult.next_step ?? ""),
      haikuConfidence,
    };
  }

  // Step 3: Escalate to Claude (expensive model)
  const claudeSystemPrompt = `You are a helpful assistant for Postgame, a sports NIL marketing agency.
The user's request has been classified as: ${haikusResult.project}

${STYLE_RULES}

Respond with only this JSON:
{
  "answer": "your answer here",
  "next_step": "one line, or empty string"
}`;

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

  const claudeContent =
    claudeResponse.content[0].type === "text"
      ? claudeResponse.content[0].text
      : "";

  // If Sonnet didn't return JSON, use its whole reply as the answer.
  const claudeResult = parseJsonResponse(claudeContent) ?? {
    answer: claudeContent,
    next_step: "",
  };

  return {
    model: "claude",
    project: haikusResult.project,
    answer: String(claudeResult.answer ?? ""),
    nextStep: String(claudeResult.next_step ?? ""),
    haikuConfidence,
  };
}

// The models write standard markdown, but Slack uses its own "mrkdwn":
// *bold* not **bold**, <url|label> not [label](url), and no # headings.
// Code blocks are left alone apart from dropping the language tag, which
// Slack would otherwise print as the first line of the block. Blank lines
// outside code are collapsed: the only blank lines in a reply are the ones
// between answer, next step and footer.
function toSlackMrkdwn(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?```)/g)
    .map((part) => {
      if (part.startsWith("```")) {
        return part.replace(/^```[\w-]*\n/, "```\n");
      }
      return part
        .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
        .replace(/\*\*(.+?)\*\*/g, "*$1*")
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "<$2|$1>")
        .replace(/\n\s*\n/g, "\n");
    })
    .join("")
    .trim();
}

function confidenceEmoji(score: number): string {
  if (score >= 8) return "🟢";
  if (score >= 5) return "🟡";
  return "🔴";
}

// Footer examples:
//   _postgame-hub · Haiku · confidence 8/10 🟢_
//   _🔴 postgame-hub · escalated: Haiku 5/10 → Claude_
function formatFooter(result: CascadeResult): string {
  if (result.model === "claude") {
    return `_🔴 ${result.project} · escalated: Haiku ${result.haikuConfidence}/10 → Claude_`;
  }
  return `_${result.project} · Haiku · confidence ${result.haikuConfidence}/10 ${confidenceEmoji(result.haikuConfidence)}_`;
}

function formatReply(result: CascadeResult): string {
  const nextStep = toSlackMrkdwn(result.nextStep).split("\n")[0].trim();

  return [toSlackMrkdwn(result.answer), nextStep, formatFooter(result)]
    .filter((section) => section !== "")
    .join("\n\n");
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
