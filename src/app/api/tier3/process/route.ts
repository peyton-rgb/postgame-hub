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

const SCORING_SYSTEM = `You are scoring user-submitted content for a sports marketing agency's brand campaign recap. Return ONLY valid JSON, no preamble or markdown.`;

const SCORING_PROMPT = `Score this image on each dimension 0-100:
- composition: rule of thirds, framing, leading lines, balance
- lighting: golden hour vs flat, exposure, contrast, mood
- subject: is the athlete clearly the focal point, expression, eye contact
- brand_visibility: is brand product/logo visible without being awkward (0 if no brand visible)
- hook: would this stop a thumb scrolling in the first 0.5 seconds — high contrast, motion, faces

Also return up to 5 tags from: golden_hour, action_shot, face_forward, brand_visible, cinematic, candid, posed, low_light, motion_blur, clean_background, cluttered, vertical_format, landscape_format

Composite = composition*0.20 + lighting*0.20 + subject*0.25 + brand_visibility*0.15 + hook*0.20

Return shape:
{ "composition": 0-100, "lighting": 0-100, "subject": 0-100, "brand_visibility": 0-100, "hook": 0-100, "composite": 0-100, "tags": ["tag1"] }`;

interface ScoreResult {
  composition: number;
  lighting: number;
  subject: number;
  brand_visibility: number;
  hook: number;
  composite: number;
  tags: string[];
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
  let scores: ScoreResult | null = null;

  if (submission.drive_thumbnail_url) {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 512,
        system: SCORING_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "url", url: submission.drive_thumbnail_url },
              },
              { type: "text", text: SCORING_PROMPT },
            ],
          },
        ],
      });

      const text =
        msg.content[0].type === "text" ? msg.content[0].text : "";
      scores = JSON.parse(text) as ScoreResult;
    } catch (err) {
      console.error("Tier3 scoring failed:", err);
    }
  }

  // 4. Update submission
  if (scores) {
    await supabase
      .from("tier3_submissions")
      .update({
        athlete_id: matchedAthleteId,
        score_composition: scores.composition,
        score_lighting: scores.lighting,
        score_subject: scores.subject,
        score_brand_visibility: scores.brand_visibility,
        score_hook: scores.hook,
        score_composite: scores.composite,
        tags: scores.tags,
        scored_at: new Date().toISOString(),
        scoring_model: "claude-sonnet-4-5",
        status: "scored",
      })
      .eq("id", submission_id);
  } else {
    await supabase
      .from("tier3_submissions")
      .update({
        athlete_id: matchedAthleteId,
        score_composite: 50,
        tags: ["scoring_failed"],
        scored_at: new Date().toISOString(),
        scoring_model: "claude-sonnet-4-5",
        status: "scored",
      })
      .eq("id", submission_id);
  }

  return NextResponse.json({
    ok: true,
    matched_athlete_id: matchedAthleteId,
    score_composite: scores?.composite ?? 50,
  });
}
