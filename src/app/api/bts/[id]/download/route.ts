import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/bts/[id]/download
//
// Server-side download proxy. Looks up the submission, pulls the file
// bytes from campaign-media storage, and streams them back with a
// Content-Disposition: attachment header so the browser saves the file
// with its original filename rather than opening it inline.
//
// Requires an authenticated Hub session (same pattern as PATCH/POST).
// Storage access uses service-role so we don't need to mint signed URLs
// per-download.
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MEDIA_BUCKET = "campaign-media";

/** Strip characters that would break the Content-Disposition header. */
function safeFilename(name: string): string {
  return name.replace(/[\r\n"]/g, "_") || "bts-video";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth
    const authClient = await createServerSupabase();
    const { data: userData } = await authClient.auth.getUser();
    if (!userData.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const id = params.id;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const supabase = createServiceSupabase();
    const { data: row, error: rowErr } = await supabase
      .from("bts_submissions")
      .select("video_path, original_filename, file_mime_type")
      .eq("id", id)
      .maybeSingle();
    if (rowErr) {
      return NextResponse.json(
        { error: "Failed to read submission: " + rowErr.message },
        { status: 500 }
      );
    }
    if (!row || !row.video_path) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .download(row.video_path as string);
    if (dlErr || !blob) {
      return NextResponse.json(
        {
          error:
            "Failed to download from storage: " +
            (dlErr?.message ?? "unknown"),
        },
        { status: 500 }
      );
    }

    const filename = safeFilename(
      (row.original_filename as string) || "bts-video.mov"
    );
    const mime =
      (row.file_mime_type as string) || "application/octet-stream";

    // Stream the body through instead of buffering to memory — keeps
    // memory flat even for large (multi-hundred-MB) uploads.
    return new NextResponse(blob.stream(), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
