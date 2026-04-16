import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

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

// -- Route handler ----------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TagRequestBody;

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

    // 1. Claude vision tagging
    const tags = await callClaude(
      body.frames,
      body.human_tags ?? {},
      body.brief_context
    );

    // 2. Generate embedding from combined tag text
    const embeddingInput = buildEmbeddingInput(tags);
    const embedding = await generateEmbedding(embeddingInput);

    // 3. Build the update payload, mapping Claude's output to DB columns
    const update: Record<string, unknown> = {
      visual_description: tags.visual_description ?? null,
      content_type: tags.content_type ?? null,
      content_freshness: tags.content_freshness ?? null,
      production_config: tags.production_config ?? null,
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
      tagging_status: "complete",
      updated_at: new Date().toISOString(),
    };

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

    // Attempt to mark the item as failed
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.inspo_item_id) {
        const supabase = createServiceSupabase();
        await supabase
          .from("inspo_items")
          .update({ tagging_status: "failed" })
          .eq("id", body.inspo_item_id);
      }
    } catch {
      // Best-effort; don't mask the original error
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
