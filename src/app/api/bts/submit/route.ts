import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";
import { appendBtsRow, SheetSyncError } from "@/lib/google-sheets";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/bts/submit
//
// Step 2 of the two-step BTS submission flow. Called by the client after it
// has successfully uploaded the file to the signed URL returned by
// /api/bts/prepare-upload. Re-validates every input (stateless design —
// nothing is trusted from the prepare step except the storagePath, which
// we verify exists in storage), writes the bts_submissions row, and
// mirror-appends a row to the Google Sheet. Sheet-append failures are
// logged on the row but do NOT fail the submission.
// ---------------------------------------------------------------------------

const MEDIA_BUCKET = "campaign-media";
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SubmitRequestBody {
  storagePath: string;
  brandId: string;
  campaignId: string;
  athleteName: string;
  holdPosting: boolean;
  submitterName: string | null;
  fileSize: number;
  mimeType: string;
  originalFilename: string;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    // ── Parse + validate ───────────────────────────────────────────────
    const body = (await req.json()) as Partial<SubmitRequestBody>;
    if (!body || typeof body !== "object") return badRequest("Invalid request body");

    const {
      storagePath,
      brandId,
      campaignId,
      athleteName,
      holdPosting,
      submitterName,
      fileSize,
      mimeType,
      originalFilename,
    } = body as SubmitRequestBody;

    if (typeof storagePath !== "string" || !storagePath.startsWith("bts/")) {
      return badRequest("storagePath must start with 'bts/'");
    }
    if (typeof brandId !== "string" || !UUID_RE.test(brandId)) {
      return badRequest("brandId must be a valid UUID");
    }
    if (typeof campaignId !== "string" || !UUID_RE.test(campaignId)) {
      return badRequest("campaignId must be a valid UUID");
    }
    if (typeof athleteName !== "string" || !athleteName.trim()) {
      return badRequest("athleteName is required");
    }
    if (typeof holdPosting !== "boolean") {
      return badRequest("holdPosting must be a boolean");
    }
    if (submitterName != null && typeof submitterName !== "string") {
      return badRequest("submitterName must be a string or null");
    }
    if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
      return badRequest("fileSize must be a positive number");
    }
    if (fileSize > MAX_FILE_BYTES) {
      return badRequest("fileSize exceeds 500 MB limit");
    }
    if (!mimeType || typeof mimeType !== "string" || !mimeType.startsWith("video/")) {
      return badRequest("mimeType must be a video/* type");
    }
    if (typeof originalFilename !== "string" || !originalFilename) {
      return badRequest("originalFilename is required");
    }

    const supabase = createServiceSupabase();

    // ── Verify the object actually exists at storagePath ───────────────
    // Supabase's `list` takes a folder prefix and a search term that
    // matches the filename. We split storagePath into dir + filename and
    // look for an exact match so we don't rely on a HEAD request.
    const lastSlash = storagePath.lastIndexOf("/");
    const dir = lastSlash === -1 ? "" : storagePath.slice(0, lastSlash);
    const basename = lastSlash === -1 ? storagePath : storagePath.slice(lastSlash + 1);

    const { data: listing, error: listErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .list(dir, { search: basename, limit: 5 });
    if (listErr) {
      return NextResponse.json(
        { error: "Failed to verify uploaded file: " + listErr.message },
        { status: 500 }
      );
    }
    const found = (listing ?? []).some((f) => f.name === basename);
    if (!found) {
      return badRequest("Upload not found — try submitting again.");
    }

    // ── Re-validate brand + campaign (defense in depth) ────────────────
    const { data: brand, error: brandErr } = await supabase
      .from("brands")
      .select("id, name, archived")
      .eq("id", brandId)
      .maybeSingle();
    if (brandErr) {
      return NextResponse.json(
        { error: "Failed to look up brand: " + brandErr.message },
        { status: 500 }
      );
    }
    if (!brand || brand.archived === true) {
      return badRequest("Brand not found or archived");
    }

    const { data: campaign, error: campaignErr } = await supabase
      .from("campaign_recaps")
      .select("id, name, brand_id")
      .eq("id", campaignId)
      .maybeSingle();
    if (campaignErr) {
      return NextResponse.json(
        { error: "Failed to look up campaign: " + campaignErr.message },
        { status: 500 }
      );
    }
    if (!campaign || campaign.brand_id !== brandId) {
      return badRequest(
        "Campaign not found or does not belong to the selected brand"
      );
    }

    // ── Public URL for the uploaded file ───────────────────────────────
    const {
      data: { publicUrl },
    } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

    // ── Insert the bts_submissions row ─────────────────────────────────
    const submittedAt = new Date();
    const { data: inserted, error: insertErr } = await supabase
      .from("bts_submissions")
      .insert({
        brand_id: brandId,
        campaign_id: campaignId,
        athlete_name: athleteName.trim(),
        submitter_name: submitterName?.trim() || null,
        hold_posting: holdPosting,
        video_path: storagePath,
        video_url: publicUrl,
        original_filename: originalFilename,
        file_mime_type: mimeType,
        file_size_bytes: fileSize,
        submitted_at: submittedAt.toISOString(),
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      return NextResponse.json(
        {
          error:
            "Failed to create submission row: " +
            (insertErr?.message ?? "unknown"),
        },
        { status: 500 }
      );
    }

    const submissionId = inserted.id as string;

    // ── Mirror-append to the Google Sheet ──────────────────────────────
    // Sheet sync is best-effort. If it fails we log the error on the row
    // and still report success to the client — the submission is safe
    // in Supabase either way.
    try {
      await appendBtsRow({
        submittedAt,
        athleteName: athleteName.trim(),
        brandName: brand.name ?? null,
        campaignName: campaign.name ?? null,
        holdPosting,
        submitterName: submitterName?.trim() || null,
        videoUrl: publicUrl,
        supabaseId: submissionId,
      });
      await supabase
        .from("bts_submissions")
        .update({ sheet_synced_at: new Date().toISOString() })
        .eq("id", submissionId);
    } catch (rawErr) {
      const wrapped = new SheetSyncError("BTS sheet append failed", rawErr);
      // Best-effort: log the error string on the row. If this update
      // itself fails, we swallow — the client still gets success and we
      // don't want an error-logging failure to cascade.
      await supabase
        .from("bts_submissions")
        .update({ sheet_sync_error: wrapped.message })
        .eq("id", submissionId);
    }

    return NextResponse.json({ success: true, submissionId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
