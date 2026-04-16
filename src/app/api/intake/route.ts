import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// POST /api/intake
//
// Drive webhook receiver. When a file lands in 06_FINALS/, an external
// automation calls this endpoint. We create an inspo_items record and
// kick off the FFmpeg worker for frame extraction + tagging (async).
// ---------------------------------------------------------------------------

interface IntakeRequestBody {
  file_url: string;
  file_name: string;
  brand_id?: string;
  campaign_id?: string;
  content_type?: string;
  athlete_name?: string;
  tech_notes?: string;
  brief_context?: string;
}

// -- Filename parser ----------------------------------------------------------
// Convention: Brand_Campaign_Athlete_Location_Date_FINAL_916.mp4

interface ParsedFilename {
  brand?: string;
  campaign?: string;
  athlete_name?: string;
  location?: string;
  date?: string;
  format?: string;
}

function parseFilename(name: string): ParsedFilename {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const stem = name.replace(/\.[^.]+$/, "");
  const parts = stem.split("_");

  // Strip trailing markers like "FINAL", "916", "169", aspect ratios, etc.
  const cleaned = parts.filter(
    (p) => !/^(FINAL|final|v\d+|916|169|11|45)$/i.test(p)
  );

  return {
    brand: cleaned[0] || undefined,
    campaign: cleaned[1] || undefined,
    athlete_name: cleaned[2] || undefined,
    location: cleaned[3] || undefined,
    date: cleaned[4] || undefined,
    format: ext || undefined,
  };
}

// -- Helpers ------------------------------------------------------------------

function inferMimeType(filename: string): string | undefined {
  const ext = filename.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    webm: "video/webm",
    mkv: "video/x-matroska",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
  };
  return ext ? map[ext] : undefined;
}

// -- Route handler ------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Auth
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "WEBHOOK_SECRET not configured" },
      { status: 500 }
    );
  }
  if (req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as IntakeRequestBody;

    if (!body.file_url || !body.file_name) {
      return NextResponse.json(
        { error: "file_url and file_name are required" },
        { status: 400 }
      );
    }

    // Parse filename for metadata
    const parsed = parseFilename(body.file_name);

    // Build the inspo_items row — explicit fields win over parsed filename
    const row: Record<string, unknown> = {
      file_url: body.file_url,
      source: "produced_catalog",
      tagging_status: "pending",
      triage_status: "pending",
      format: parsed.format ?? null,
      mime_type: inferMimeType(body.file_name) ?? null,
      athlete_name: body.athlete_name || parsed.athlete_name || null,
      tech_notes: body.tech_notes || null,
      notes: parsed.location
        ? `Location: ${parsed.location}${parsed.date ? ` | Date: ${parsed.date}` : ""}`
        : null,
    };

    if (body.brand_id) row.brand_id = body.brand_id;
    if (body.campaign_id) row.campaign_id = body.campaign_id;
    if (body.content_type) row.content_type = body.content_type;

    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("inspo_items")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }

    const inspoItemId = data.id;

    // Fire-and-forget: kick off the FFmpeg worker
    const workerUrl = process.env.FFMPEG_WORKER_URL;
    const workerSecret = process.env.FFMPEG_WORKER_SECRET;

    if (workerUrl && workerSecret) {
      fetch(`${workerUrl}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ffmpeg-secret": workerSecret,
        },
        body: JSON.stringify({
          video_url: body.file_url,
          inspo_item_id: inspoItemId,
          human_tags: {
            brand: parsed.brand || undefined,
            campaign: parsed.campaign || undefined,
            athlete_name: body.athlete_name || parsed.athlete_name || undefined,
            content_type: body.content_type || undefined,
            tech_notes: body.tech_notes || undefined,
          },
          brief_context: body.brief_context,
        }),
      }).catch((err) => {
        console.error(`[/api/intake] FFmpeg worker call failed: ${err.message}`);
      });
    } else {
      console.warn(
        "[/api/intake] FFMPEG_WORKER_URL or FFMPEG_WORKER_SECRET not set — skipping worker call"
      );
    }

    return NextResponse.json({
      success: true,
      inspo_item_id: inspoItemId,
      parsed_filename: parsed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/intake] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
