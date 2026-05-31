import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { extractImageDimensions, prepareImageForClaude } from "@/lib/services/image-convert";

// ---------------------------------------------------------------------------
// POST /api/tag
//
// Accepts an inspo_item_id + video frames + human context, sends frames to
// Claude vision for 13-category tagging, generates an OpenAI embedding from
// the tag text, then writes everything back to the inspo_items row.
// ---------------------------------------------------------------------------

interface Frame {
  /** base64-encoded image (JPEG or PNG) */
  data: string;
  /** media type, e.g. "image/jpeg" */
  media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  /** seconds into the video this frame was captured */
  timestamp_seconds: number;
}

interface TagRequestBody {
  inspo_item_id: string;
  frames: Frame[];
  /** Human-supplied metadata merged before Claude sees the content */
  human_tags: {
    brand?: string;
    campaign?: string;
    athlete_name?: string;
    content_type?: string;
    tech_notes?: string;
  };
  /** Optional brief / campaign context to help Claude score brief_fit */
  brief_context?: string;
}

// -- Claude tagging system prompt ------------------------------------------

const TAGGING_SYSTEM_PROMPT = `You are the Postgame Content Tagger. You receive video frames (with timestamps) from athlete-brand content and human-supplied context. Your job is to return a single JSON object with exactly these 13 tag categories. No markdown, no commentary — only valid JSON.

Return this exact shape:
{
  "visual_description": "<1-2 sentence plain-English description of what is happening in the content>",
  "content_type": "<one of: produced | athlete_ugc | bts | raw_footage | photography | talking_head | inspo_external>",
  "content_freshness": "<one of: evergreen | timely | expired>",
  "production_config": "<one of: vid_is_editor | split_team | null>",
  "sport": "<detected or confirmed sport, e.g. 'football', 'basketball', or null>",
  "school": "<detected or confirmed school/university, or null>",
  "context_tags": {
    "setting": "<e.g. stadium, gym, studio, outdoors, campus>",
    "lighting": "<e.g. natural, studio, golden_hour, mixed>",
    "mood": "<e.g. hype, chill, intense, playful, cinematic>",
    "wardrobe": "<brief description of what athlete is wearing, or null>",
    "props": "<notable objects/equipment visible, or null>",
    "branded_elements": "<visible logos, products, signage, or null>"
  },
  "social_tags": {
    "hook_style": "<e.g. action_open, text_overlay, question, reveal, trending_sound>",
    "pacing": "<slow | medium | fast>",
    "cta_present": <true | false>,
    "text_overlay_present": <true | false>,
    "trending_audio": <true | false | "unknown">,
    "estimated_platform_fit": ["<best 1-3 from: ig_feed, ig_reel, ig_story, tiktok, youtube_short, twitter>"]
  },
  "pro_tags": {
    "camera_movement": "<e.g. static, pan, tracking, handheld, drone>",
    "shot_type": "<e.g. wide, medium, close_up, extreme_close_up, aerial>",
    "edit_pace": "<cuts_per_10s approximate number or 'single_take'>",
    "color_grade": "<e.g. warm, cool, neutral, high_contrast, desaturated>",
    "aspect_ratio": "<e.g. 9:16, 16:9, 1:1, 4:5>"
  },
  "brief_fit": ["<list of brief/campaign themes this content could serve, e.g. 'game_day_energy', 'lifestyle', 'product_showcase'. Empty array if no brief context provided>"],
  "search_phrases": ["<5-10 plain-English phrases someone might search to find this content, e.g. 'football player catching ball at sunset', 'athlete trying on sneakers'>"]
}

Rules:
- If human_tags supplies a value (e.g. content_type, athlete_name), trust it over your visual guess.
- For brief_fit, only populate if brief_context is provided. Score which themes the content naturally fits.
- search_phrases should be diverse: mix action descriptions, moods, settings, and potential use cases.
- Return ONLY the JSON object. No wrapping text, no code fences.`;

// -- Helpers ----------------------------------------------------------------

async function callClaude(
  frames: Frame[],
  humanTags: TagRequestBody["human_tags"],
  briefContext?: string
): Promise<Record<string, unknown>> {
  const imageBlocks = frames.map((f) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: f.media_type,
      data: f.data,
    },
  }));

  const timestampNote =
    frames.length > 1
      ? `\n\nFrame timestamps (seconds): ${frames.map((f) => f.timestamp_seconds).join(", ")}`
      : "";

  const humanContext = [
    humanTags.brand && `Brand: ${humanTags.brand}`,
    humanTags.campaign && `Campaign: ${humanTags.campaign}`,
    humanTags.athlete_name && `Athlete: ${humanTags.athlete_name}`,
    humanTags.content_type && `Content type (human-supplied): ${humanTags.content_type}`,
    humanTags.tech_notes && `Tech notes: ${humanTags.tech_notes}`,
    briefContext && `Brief / campaign context:\n${briefContext}`,
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = [
    ...imageBlocks,
    {
      type: "text" as const,
      text: `Tag this content.${timestampNote}\n\nHuman-supplied context:\n${humanContext || "(none)"}`,
    },
  ];

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: TAGGING_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text =
    data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";

  // Strip possible markdown fences just in case
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

/** Build a single string from all tag fields for the embedding input. */
function buildEmbeddingInput(tags: Record<string, unknown>): string {
  const parts: string[] = [];

  if (tags.visual_description) parts.push(String(tags.visual_description));
  if (tags.sport) parts.push(String(tags.sport));
  if (tags.school) parts.push(String(tags.school));

  const ctx = tags.context_tags as Record<string, string> | null;
  if (ctx) {
    for (const v of Object.values(ctx)) {
      if (v) parts.push(v);
    }
  }

  const social = tags.social_tags as Record<string, unknown> | null;
  if (social) {
    if (social.hook_style) parts.push(String(social.hook_style));
    if (social.pacing) parts.push(String(social.pacing));
    const platforms = social.estimated_platform_fit;
    if (Array.isArray(platforms)) parts.push(platforms.join(", "));
  }

  const pro = tags.pro_tags as Record<string, string> | null;
  if (pro) {
    for (const v of Object.values(pro)) {
      if (v) parts.push(v);
    }
  }

  const phrases = tags.search_phrases;
  if (Array.isArray(phrases)) parts.push(phrases.join(". "));

  const fit = tags.brief_fit;
  if (Array.isArray(fit) && fit.length) parts.push(fit.join(", "));

  return parts.join(" | ");
}

// -- Frame selection (rate-limit + size safety) -----------------------------

// The worker extracts one frame per SECOND of video. Sending all of them to
// Claude floods the per-minute token limit on long clips, and full-resolution
// frames can also exceed Claude's 5 MB-per-image cap. So we send only a few
// evenly-spaced frames, each shrunk down first. A handful captures the whole
// clip's content at a fraction of the tokens and cost.
const MAX_CLAUDE_FRAMES = 3;

// Each frame sent to Claude is shrunk to this long-edge size. Smaller than the
// 1568px we use for photos — video frames don't need fine detail to be tagged,
// and smaller frames keep us comfortably under the per-minute token limit so a
// batch of clips can run without tripping a rate-limit error.
const CLAUDE_FRAME_MAX_EDGE = 768;

// Pick up to `max` frames spread evenly from first to last.
function pickEvenFrames(frames: Frame[], max: number): Frame[] {
  if (frames.length <= max) return frames;
  const step = (frames.length - 1) / (max - 1);
  const picked: Frame[] = [];
  for (let i = 0; i < max; i++) picked.push(frames[Math.round(i * step)]);
  // de-dupe in case rounding lands on the same frame twice
  return picked.filter((f, idx) => picked.indexOf(f) === idx);
}

// Shrink each selected frame under Claude's size/token limits before sending.
async function prepareFramesForClaude(frames: Frame[]): Promise<Frame[]> {
  const picked = pickEvenFrames(frames, MAX_CLAUDE_FRAMES);
  const out: Frame[] = [];
  for (const f of picked) {
    try {
      const prepared = await prepareImageForClaude(
        Buffer.from(f.data, "base64"),
        "frame.jpg",
        CLAUDE_FRAME_MAX_EDGE
      );
      out.push({
        data: prepared.base64,
        media_type: prepared.mediaType,
        timestamp_seconds: f.timestamp_seconds,
      });
    } catch {
      out.push(f); // if a resize fails, fall back to the original frame
    }
  }
  return out;
}

// -- Enum safety ------------------------------------------------------------

// Three columns are strict dropdowns in the database — they only accept these
// exact values (or a true blank). Claude occasionally answers with the literal
// text "null", or a value just outside the list. Writing that straight to the
// column makes Postgres reject the ENTIRE row. So we validate each enum field
// against its allowed list and fall back to a real null for anything else.
const ENUM_VALUES = {
  content_type: [
    "produced",
    "athlete_ugc",
    "bts",
    "raw_footage",
    "photography",
    "talking_head",
    "inspo_external",
  ],
  content_freshness: ["evergreen", "timely", "expired"],
  production_config: ["vid_is_editor", "split_team"],
} as const;

function enumOrNull(value: unknown, allowed: readonly string[]): string | null {
  return typeof value === "string" && allowed.includes(value) ? value : null;
}

// -- Route handler ----------------------------------------------------------

export async function POST(req: NextRequest) {
  // Captured right after we parse the body, so the catch block can mark the
  // item failed without trying to re-read the (already consumed) request.
  let itemIdForError: string | null = null;
  try {
    const body = (await req.json()) as TagRequestBody;
    itemIdForError = body.inspo_item_id ?? null;

    if (!body.inspo_item_id) {
      return NextResponse.json(
        { error: "inspo_item_id is required" },
        { status: 400 }
      );
    }
    if (!body.frames?.length) {
      return NextResponse.json(
        { error: "At least one frame is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabase();

    // Mark as in-progress
    await supabase
      .from("inspo_items")
      .update({ tagging_status: "processing" })
      .eq("id", body.inspo_item_id);

    // 1. Claude vision tagging — on a few evenly-spaced, shrunk frames
    //    (keeps us under the token + per-image size limits). Duration,
    //    resolution and the thumbnail below still use the FULL frame set.
    const claudeFrames = await prepareFramesForClaude(body.frames);
    const tags = await callClaude(
      claudeFrames,
      body.human_tags ?? {},
      body.brief_context
    );

    // 2. Generate embedding from combined tag text
    const embeddingInput = buildEmbeddingInput(tags);
    const embedding = await generateEmbedding(embeddingInput);

    // 2b. Technical specs, read straight off the frames the worker extracted.
    //  - resolution + aspect ratio come from a frame's actual pixels
    //  - duration ≈ the last frame's timestamp (frames are sampled 1 per second)
    // fps + codec are intentionally NOT set here — those require ffprobe on the
    // real video file (a worker change), handled in a later phase.
    let videoResolution: string | null = null;
    let videoAspect = "unknown";
    try {
      const dims = await extractImageDimensions(
        Buffer.from(body.frames[0].data, "base64")
      );
      videoResolution = dims.resolution;
      videoAspect = dims.aspectFormat;
    } catch {
      /* if a frame can't be read, leave specs blank rather than fail */
    }
    const videoDuration =
      body.frames.reduce((max, f) => Math.max(max, f.timestamp_seconds || 0), 0) ||
      body.frames.length ||
      null;

    // Save a representative (middle) frame as the item's thumbnail. Non-fatal:
    // a failure here must never kill the tag job, so it's wrapped and ignored.
    let thumbnailUrl: string | null = null;
    try {
      const midFrame =
        body.frames[Math.floor(body.frames.length / 2)] ?? body.frames[0];
      const thumbPath = `thumbnails/${body.inspo_item_id}_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("raw-footage")
        .upload(thumbPath, Buffer.from(midFrame.data, "base64"), {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (!upErr) {
        const { data: pub } = supabase.storage
          .from("raw-footage")
          .getPublicUrl(thumbPath);
        thumbnailUrl = pub?.publicUrl ?? null;
      }
    } catch {
      /* thumbnail is a nice-to-have; never fail tagging over it */
    }

    // 3. Build the update payload, mapping Claude's output to DB columns
    const update: Record<string, unknown> = {
      visual_description: tags.visual_description ?? null,
      content_type: enumOrNull(tags.content_type, ENUM_VALUES.content_type),
      content_freshness: enumOrNull(
        tags.content_freshness,
        ENUM_VALUES.content_freshness
      ),
      production_config: enumOrNull(
        tags.production_config,
        ENUM_VALUES.production_config
      ),
      sport: tags.sport ?? null,
      school: tags.school ?? null,
      context_tags: tags.context_tags ?? null,
      social_tags: tags.social_tags ?? null,
      pro_tags: tags.pro_tags ?? null,
      brief_fit: Array.isArray(tags.brief_fit) ? tags.brief_fit : null,
      search_phrases: Array.isArray(tags.search_phrases)
        ? tags.search_phrases
        : null,
      embedding: JSON.stringify(embedding),
      resolution: videoResolution,
      format: videoAspect,
      duration_seconds: videoDuration,
      tagging_status: "complete",
      updated_at: new Date().toISOString(),
    };
    if (thumbnailUrl) update.thumbnail_url = thumbnailUrl;

    // Merge human-supplied fields that should override
    if (body.human_tags?.athlete_name) {
      update.athlete_name = body.human_tags.athlete_name;
    }
    if (body.human_tags?.tech_notes) {
      update.tech_notes = body.human_tags.tech_notes;
    }

    // 4. Write to Supabase
    const { error: updateError } = await supabase
      .from("inspo_items")
      .update(update)
      .eq("id", body.inspo_item_id);

    if (updateError) {
      throw new Error(`Supabase update failed: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      inspo_item_id: body.inspo_item_id,
      tags,
      embedding_dimensions: embedding.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/tag] Error:", message);

    // Mark the item failed so it's visible and retryable (uses the id captured
    // above — the request body has already been read and can't be re-read).
    try {
      if (itemIdForError) {
        const supabase = createServiceSupabase();
        await supabase
          .from("inspo_items")
          .update({ tagging_status: "failed" })
          .eq("id", itemIdForError);
      }
    } catch {
      // Best-effort; don't mask the original error
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
