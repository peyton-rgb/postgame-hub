import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/\.[^.]+$/, "") // strip file extension
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchAthlete(
  fileName: string,
  athletes: { id: string; name: string }[]
): string | null {
  const normFile = normalize(fileName);
  const matches: string[] = [];

  for (const athlete of athletes) {
    const normName = normalize(athlete.name);
    const tokens = normName.split(" ").filter(Boolean);

    if (normFile.includes(normName)) {
      matches.push(athlete.id);
      continue;
    }

    if (tokens.some((token) => normFile.includes(token))) {
      matches.push(athlete.id);
    }
  }

  return matches.length === 1 ? matches[0] : null;
}

const SCORING_MODEL = "claude-sonnet-5";

// Thumbnails come back from Drive as PNG or JPEG. Anything else is not
// something the vision API will take, and is worth failing loudly on rather
// than discovering as an opaque 400.
const ACCEPTED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const SCORING_SYSTEM = `You are scoring user-submitted content for a sports marketing agency's brand campaign recap. Return ONLY valid JSON, no preamble or markdown.`;

// Weights are the same for both media types. For video the hook weight is
// dropped and the rest are renormalised over what remains — see compositeOf.
const WEIGHTS = {
  composition: 0.2,
  lighting: 0.2,
  subject: 0.25,
  brand_visibility: 0.15,
  hook: 0.2,
} as const;

type ScoreDimension = keyof typeof WEIGHTS;

const PHOTO_DIMENSIONS: ScoreDimension[] = [
  "composition",
  "lighting",
  "subject",
  "brand_visibility",
  "hook",
];

// A video is scored from ONE poster frame, so hook is deliberately absent
// rather than guessed: "would this stop a thumb in 0.5s" is a property of
// motion and pacing, and a still cannot carry it. Real hook scoring needs
// frame extraction. Asking for it here and discarding the answer would be
// worse than not asking — the model would fold it into the other dimensions.
const VIDEO_DIMENSIONS: ScoreDimension[] = [
  "composition",
  "lighting",
  "subject",
  "brand_visibility",
];

const DIMENSION_GUIDANCE: Record<ScoreDimension, string> = {
  composition: "composition: rule of thirds, framing, leading lines, balance",
  lighting: "lighting: golden hour vs flat, exposure, contrast, mood",
  subject:
    "subject: is the athlete clearly the focal point, expression, eye contact",
  brand_visibility:
    "brand_visibility: is brand product/logo visible without being awkward (0 if no brand visible)",
  hook: "hook: would this stop a thumb scrolling in the first 0.5 seconds — high contrast, motion, faces",
};

function scoringPrompt(dimensions: ScoreDimension[], isVideo: boolean): string {
  const preamble = isVideo
    ? "This is a single poster frame taken from a VIDEO. Score only what one frame can show.\n\n"
    : "";
  const shape = dimensions.map((d) => `"${d}": 0-100`).join(", ");

  return `${preamble}Score this image on each dimension 0-100:
${dimensions.map((d) => `- ${DIMENSION_GUIDANCE[d]}`).join("\n")}

Also return up to 5 tags from: golden_hour, action_shot, face_forward, brand_visible, cinematic, candid, posed, low_light, motion_blur, clean_background, cluttered, vertical_format, landscape_format

Return shape:
{ ${shape}, "tags": ["tag1"] }`;
}

type ScoreResult = Partial<Record<ScoreDimension, number>> & { tags?: string[] };

/**
 * Composite is computed here, not asked for. The model used to return its own
 * composite, which meant trusting it to do arithmetic AND made the video case
 * impossible — dropping hook silently changes what the number means. Weighting
 * only the dimensions actually scored keeps photo and video on one 0-100 scale.
 */
function compositeOf(scores: ScoreResult, dimensions: ScoreDimension[]): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const d of dimensions) {
    const value = Number(scores[d]);
    if (!Number.isFinite(value)) continue;
    weighted += value * WEIGHTS[d];
    totalWeight += WEIGHTS[d];
  }
  if (!totalWeight) throw new Error("model returned no usable dimension scores");
  return Math.round((weighted / totalWeight) * 100) / 100;
}

/** Tolerant of a ```json fence, which the model occasionally adds anyway. */
function parseScores(text: string): ScoreResult {
  const cleaned = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(cleaned) as ScoreResult;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { submission_id } = body as { submission_id: string };

  if (!submission_id) {
    return NextResponse.json({ error: "submission_id required" }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  // 1. Load submission
  const { data: submission, error: fetchErr } = await supabase
    .from("tier3_submissions")
    .select("*")
    .eq("id", submission_id)
    .single();

  if (fetchErr || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.status !== "pending_review") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  // 2. Filename matching
  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, name")
    .eq("campaign_id", submission.campaign_id);

  const matchedAthleteId = matchAthlete(
    submission.file_name ?? "",
    athletes ?? []
  );

  // 3. Vision scoring
  //
  // The thumbnail is fetched HERE and sent as base64. It cannot be handed over
  // as { type: "url" }: the API fetches such URLs itself and honours
  // robots.txt, and drive.google.com disallows /thumbnail. That returned a 400
  // on every single submission. The URL is publicly readable — curl gets 200 —
  // so pulling the bytes server-side and inlining them works fine.
  const isVideo =
    (submission.mime_type ?? "").startsWith("video/") ||
    submission.asset_type === "video";
  const dimensions = isVideo ? VIDEO_DIMENSIONS : PHOTO_DIMENSIONS;

  let scores: ScoreResult | null = null;
  let composite: number | null = null;
  let scoringError: string | null = null;

  try {
    if (!submission.drive_thumbnail_url) {
      throw new Error("submission has no drive_thumbnail_url");
    }

    const thumb = await fetch(submission.drive_thumbnail_url);
    if (!thumb.ok) {
      throw new Error(`thumbnail fetch failed: HTTP ${thumb.status}`);
    }
    const mediaType = (thumb.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim();
    if (!ACCEPTED_MEDIA.includes(mediaType)) {
      throw new Error(`thumbnail is not a supported image type: "${mediaType}"`);
    }
    const bytes = Buffer.from(await thumb.arrayBuffer());
    if (!bytes.length) throw new Error("thumbnail fetch returned no bytes");

    const msg = await anthropic.messages.create({
      model: SCORING_MODEL,
      max_tokens: 512,
      system: SCORING_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: bytes.toString("base64"),
              },
            },
            { type: "text", text: scoringPrompt(dimensions, isVideo) },
          ],
        },
      ],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    if (!text) throw new Error("model returned no text block");

    scores = parseScores(text);
    composite = compositeOf(scores, dimensions);
  } catch (err) {
    // Persisted, not just logged. The previous version only console.error'd,
    // which is why 62 failures left no trace of WHY they failed.
    scoringError = err instanceof Error ? err.message : String(err);
    console.error(
      `Tier3 scoring failed for ${submission_id}:`,
      scoringError
    );
  }

  // 4. Update submission
  //
  // A failure must never look like a success. No placeholder composite, no
  // 'scored' status, no tags — a null says "we do not know", and 50 said
  // "we looked and it was average". Only one of those is true.
  if (scores && composite !== null) {
    await supabase
      .from("tier3_submissions")
      .update({
        athlete_id: matchedAthleteId,
        score_composition: scores.composition ?? null,
        score_lighting: scores.lighting ?? null,
        score_subject: scores.subject ?? null,
        score_brand_visibility: scores.brand_visibility ?? null,
        // Null for video, always. See VIDEO_DIMENSIONS.
        score_hook: isVideo ? null : scores.hook ?? null,
        score_composite: composite,
        tags: scores.tags ?? [],
        scored_at: new Date().toISOString(),
        scoring_model: SCORING_MODEL,
        scoring_error: null,
        status: "scored",
      })
      .eq("id", submission_id);
  } else {
    await supabase
      .from("tier3_submissions")
      .update({
        athlete_id: matchedAthleteId,
        score_composition: null,
        score_lighting: null,
        score_subject: null,
        score_brand_visibility: null,
        score_hook: null,
        score_composite: null,
        tags: null,
        // When it was attempted, not when it was scored — it wasn't.
        scored_at: new Date().toISOString(),
        scoring_model: SCORING_MODEL,
        scoring_error: scoringError,
        status: "scoring_failed",
      })
      .eq("id", submission_id);
  }

  return NextResponse.json({
    ok: true,
    matched_athlete_id: matchedAthleteId,
    status: scores ? "scored" : "scoring_failed",
    score_composite: composite,
    ...(scoringError ? { scoring_error: scoringError } : {}),
  });
}
