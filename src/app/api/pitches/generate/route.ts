import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createServiceSupabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, type BuildPromptInput } from "@/lib/pitch/aiPrompts";
import type { PitchSectionData } from "@/types/pitch";
import { writeFile, unlink, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Vercel Pro: this route can take up to 5 minutes for video processing + Anthropic generation
export const maxDuration = 300;

interface UploadedAsset {
  path: string;
  mimeType: string;
  originalName: string;
}

interface RequestBody {
  brandId: string;
  title: string;
  slug: string;
  voiceId: string;
  userPrompt: string;
  uploadedAssets: UploadedAsset[];
}

const VALID_SECTION_TYPES = new Set([
  "ticker", "hero", "thesis", "roster", "pullQuote", "pull_quote", "capabilities", "ideas", "cta",
]);

// ---- Auth helper ----

async function getAuthUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {
          // No-op for API routes — we don't need to set cookies
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ---- Photo processing ----

async function processPhoto(
  serviceSupabase: ReturnType<typeof createServiceSupabase>,
  asset: UploadedAsset
): Promise<Anthropic.ImageBlockParam> {
  const { data, error } = await serviceSupabase.storage
    .from("campaign-media")
    .download(asset.path);

  if (error || !data) throw new Error(`Failed to download ${asset.originalName}: ${error?.message}`);

  const buffer = Buffer.from(await data.arrayBuffer());
  const base64 = buffer.toString("base64");

  // Map common types to Anthropic's supported media types
  let mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" = "image/jpeg";
  if (asset.mimeType === "image/png") mediaType = "image/png";
  else if (asset.mimeType === "image/gif") mediaType = "image/gif";
  else if (asset.mimeType === "image/webp") mediaType = "image/webp";

  return {
    type: "image",
    source: { type: "base64", media_type: mediaType, data: base64 },
  };
}

// ---- Video processing ----

async function processVideo(
  serviceSupabase: ReturnType<typeof createServiceSupabase>,
  asset: UploadedAsset,
  tempDir: string
): Promise<{ frames: Anthropic.ImageBlockParam[]; transcript: string | null }> {
  // Download video from storage
  const { data, error } = await serviceSupabase.storage
    .from("campaign-media")
    .download(asset.path);

  if (error || !data) throw new Error(`Failed to download ${asset.originalName}: ${error?.message}`);

  const buffer = Buffer.from(await data.arrayBuffer());
  const videoPath = join(tempDir, asset.originalName);
  await writeFile(videoPath, buffer);

  // Extract frames and audio with ffmpeg
  const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
  const ffmpeg = require("fluent-ffmpeg") as typeof import("fluent-ffmpeg");
  ffmpeg.setFfmpegPath(ffmpegPath);

  // Get video duration
  const duration = await new Promise<number>((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err: Error | null, metadata: any) => {
      if (err) reject(err);
      else resolve(metadata?.format?.duration || 10);
    });
  });

  // Extract 4 frames at 0%, 33%, 66%, 99%
  const frameTimestamps = [0, 0.33, 0.66, 0.99].map((pct) =>
    Math.min(pct * duration, duration - 0.1)
  );

  const frames: Anthropic.ImageBlockParam[] = [];

  for (let i = 0; i < frameTimestamps.length; i++) {
    const framePath = join(tempDir, `frame-${asset.originalName}-${i}.jpg`);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(frameTimestamps[i])
        .frames(1)
        .output(framePath)
        .outputOptions(["-q:v", "3"])
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    const { readFile } = require("fs/promises");
    const frameBuffer = await readFile(framePath);
    frames.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: frameBuffer.toString("base64"),
      },
    });
  }

  // Extract audio and transcribe
  let transcript: string | null = null;
  const audioPath = join(tempDir, `audio-${asset.originalName}.mp3`);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate("64k")
        .output(audioPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    transcript = await transcribeAudio(audioPath, asset.originalName);
  } catch (err) {
    console.warn(`Audio extraction/transcription failed for ${asset.originalName}:`, err);
    // Continue without transcription
  }

  return { frames, transcript };
}

// ---- ElevenLabs STT ----

async function transcribeAudio(audioPath: string, filename: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("ELEVENLABS_API_KEY not set — skipping transcription for", filename);
    return null;
  }

  const { readFile } = require("fs/promises");
  const audioBuffer = await readFile(audioPath);

  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "audio.mp3");
  formData.append("model_id", "scribe_v1");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    console.warn(`ElevenLabs STT failed for ${filename}: ${response.status}`);
    return null;
  }

  const result = await response.json();
  return result.text || null;
}

// ---- Temp dir cleanup ----

async function cleanupTempDir(tempDir: string) {
  try {
    const { readdir } = require("fs/promises");
    const files = await readdir(tempDir);
    await Promise.all(files.map((f: string) => unlink(join(tempDir, f)).catch(() => {})));
    const { rmdir } = require("fs/promises");
    await rmdir(tempDir).catch(() => {});
  } catch {
    // Best effort cleanup
  }
}

// ---- Brand context builder ----

interface BrandContextResult {
  brandName: string;
  brandContext: string;
  pastCampaignsContext: string;
}

async function buildBrandContext(
  serviceSupabase: ReturnType<typeof createServiceSupabase>,
  brandId: string
): Promise<BrandContextResult> {
  // Fetch brand
  const { data: brand } = await serviceSupabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (!brand) throw new Error("Brand not found");

  // Build brand details
  let brandContext = "";
  if (brand.primary_color) brandContext += `Primary color: ${brand.primary_color}\n`;
  if (brand.secondary_color) brandContext += `Secondary color: ${brand.secondary_color}\n`;
  if (brand.website) brandContext += `Website: ${brand.website}\n`;
  if (brand.notes) brandContext += `Notes: ${brand.notes}\n`;
  if (brand.kit_notes) brandContext += `Brand kit notes: ${brand.kit_notes}\n`;
  if (brand.brand_colors) brandContext += `Brand colors: ${JSON.stringify(brand.brand_colors)}\n`;

  // Fetch past campaigns
  const { data: campaigns } = await serviceSupabase
    .from("brand_campaigns")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  let pastCampaignsContext = "";
  if (campaigns && campaigns.length > 0) {
    pastCampaignsContext = `${campaigns.length} campaigns on record:\n`;
    for (const c of campaigns) {
      pastCampaignsContext += `\n### ${c.name}\n`;
      if (c.status) pastCampaignsContext += `Status: ${c.status}\n`;
      if (c.budget) pastCampaignsContext += `Budget: $${c.budget}\n`;
      if (c.created_at) pastCampaignsContext += `Date: ${new Date(c.created_at).toLocaleDateString()}\n`;
      if (c.settings) {
        const settings = typeof c.settings === "string" ? JSON.parse(c.settings) : c.settings;
        if (settings.description) pastCampaignsContext += `Description: ${settings.description}\n`;
      }
    }
  } else {
    pastCampaignsContext = "No past campaigns found for this brand.";
  }

  return { brandName: brand.name, brandContext, pastCampaignsContext };
}

// ---- Validation ----

function validateSections(sections: any[]): PitchSectionData[] {
  if (!Array.isArray(sections)) throw new Error("Response is not an array");

  for (const section of sections) {
    if (!section.type || !VALID_SECTION_TYPES.has(section.type)) {
      throw new Error(`Invalid section type: ${section.type}`);
    }
    if (typeof section.visible !== "boolean") {
      section.visible = true;
    }
  }

  return sections as PitchSectionData[];
}

// ---- Main handler ----

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const user = await getAuthUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: RequestBody = await req.json();
    const { brandId, title, slug, voiceId, userPrompt, uploadedAssets } = body;

    if (!brandId) {
      return NextResponse.json({ error: "brandId is required" }, { status: 400 });
    }

    const serviceSupabase = createServiceSupabase();

    // Build brand context (split into details + campaigns for the prompt builder)
    const { brandName, brandContext, pastCampaignsContext } =
      await buildBrandContext(serviceSupabase, brandId);

    // Process assets
    const imageBlocks: Anthropic.ImageBlockParam[] = [];
    const textBlocks: string[] = [];
    const tempId = crypto.randomUUID();
    const tempDir = join(tmpdir(), `pitch-gen-${tempId}`);
    await mkdir(tempDir, { recursive: true });

    try {
      for (const asset of uploadedAssets) {
        if (asset.mimeType.startsWith("image/")) {
          const block = await processPhoto(serviceSupabase, asset);
          imageBlocks.push(block);
        } else if (asset.mimeType.startsWith("video/")) {
          const { frames, transcript } = await processVideo(serviceSupabase, asset, tempDir);
          imageBlocks.push(...frames);
          if (transcript) {
            textBlocks.push(`[Video transcript from ${asset.originalName}]: ${transcript}`);
          }
        }
      }
    } finally {
      // Cleanup temp files
      await cleanupTempDir(tempDir);
    }

    // Build system prompt using the voice module
    const promptInput: BuildPromptInput = {
      voiceId: voiceId || "reactive",
      brandName,
      brandContext,
      pastCampaignsContext,
      userPrompt: userPrompt || "",
    };

    const systemPrompt = buildSystemPrompt(promptInput);

    // Build user message for Anthropic (assets only — brand context is in system prompt)
    const userContent: Anthropic.ContentBlockParam[] = [];

    // Video transcripts as text
    if (textBlocks.length > 0) {
      userContent.push({
        type: "text",
        text: `## VIDEO TRANSCRIPTS\n${textBlocks.join("\n\n")}`,
      });
    }

    // Image blocks (photos + video frames)
    for (const img of imageBlocks) {
      userContent.push(img);
    }

    if (imageBlocks.length > 0) {
      userContent.push({
        type: "text",
        text: `The images above are ${uploadedAssets.filter((a) => a.mimeType.startsWith("image/")).length} uploaded photos and ${uploadedAssets.filter((a) => a.mimeType.startsWith("video/")).length} video frame extracts. Reference visual details from these in the pitch where relevant.`,
      });
    }

    // If no assets at all, send a simple generation request
    if (userContent.length === 0) {
      userContent.push({
        type: "text",
        text: "Generate the pitch now based on the brand context and user prompt in the system message.",
      });
    }

    // Call Anthropic
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    // Extract text from response
    let rawJson = "";
    for (const block of response.content) {
      if (block.type === "text") rawJson += block.text;
    }

    // Strip accidental markdown fences
    rawJson = rawJson.trim();
    if (rawJson.startsWith("```json")) rawJson = rawJson.slice(7);
    else if (rawJson.startsWith("```")) rawJson = rawJson.slice(3);
    if (rawJson.endsWith("```")) rawJson = rawJson.slice(0, -3);
    rawJson = rawJson.trim();

    // Parse
    let sections: PitchSectionData[];
    try {
      const parsed = JSON.parse(rawJson);
      sections = validateSections(parsed);
    } catch (parseErr: any) {
      console.error("Failed to parse Anthropic response:", rawJson.slice(0, 500));
      return NextResponse.json(
        { error: `Failed to parse AI response: ${parseErr.message}` },
        { status: 500 }
      );
    }

    // Insert pitch page
    const { data: pitch, error: insertError } = await serviceSupabase
      .from("pitch_pages")
      .insert({
        title,
        slug,
        brand_id: brandId,
        status: "draft",
        content: { sections },
        created_by: user.id,
      })
      .select("id, slug")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to save pitch: ${insertError.message}` },
        { status: 500 }
      );
    }

    // TODO: Add a cleanup job for pitch-uploads/{tempId}/ files in Supabase storage.
    // Leaving upload files in place for now — they may be referenced from the generated pitch.

    return NextResponse.json({ pitchId: pitch.id, slug: pitch.slug });
  } catch (err: any) {
    console.error("Pitch generation error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
