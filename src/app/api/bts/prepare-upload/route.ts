import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/bts/prepare-upload
//
// Step 1 of the two-step BTS submission flow. Validates the form metadata,
// resolves the brand + campaign from their IDs, computes a deterministic
// storage path under bts/{brand-slug}/{campaign-slug}/..., and asks Supabase
// storage for a signed upload URL. The client uploads the file directly to
// Supabase (no bytes through this server) and then calls /api/bts/submit.
//
// Stateless: no server-held session between prepare and submit. The submit
// route independently re-validates everything; storagePath is the only
// handoff.
// ---------------------------------------------------------------------------

const MEDIA_BUCKET = "campaign-media";
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PrepareUploadRequestBody {
  filename: string;
  fileSize: number;
  mimeType: string;
  brandId: string;
  campaignId: string;
  athleteName: string;
  holdPosting: boolean;
  submitterName: string | null;
}

/**
 * Slug helper — lowercase, drop apostrophes, non-alphanumerics → "-",
 * collapse repeats, trim ends. "Raising Cane's" → "raising-canes".
 * Inlined to avoid coupling to any cross-feature slugify; intentional
 * duplication while the shared utility doesn't exist yet.
 */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’]/g, "") // strip straight + curly apostrophes first
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Last dot-segment of a filename, lowercased; defaults to "mov" when absent. */
function extFrom(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx === -1 || idx === filename.length - 1) return "mov";
  return filename.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "mov";
}

/** 6-char lowercase alphanumeric nonce for storage path disambiguation. */
function randomId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    // ── Parse + validate ───────────────────────────────────────────────
    const body = (await req.json()) as Partial<PrepareUploadRequestBody>;

    if (!body || typeof body !== "object") {
      return badRequest("Invalid request body");
    }
    const {
      filename,
      fileSize,
      mimeType,
      brandId,
      campaignId,
      athleteName,
      holdPosting,
      submitterName,
    } = body as PrepareUploadRequestBody;

    if (!filename || typeof filename !== "string") {
      return badRequest("filename is required");
    }
    if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
      return badRequest("fileSize must be a positive number");
    }
    if (fileSize > MAX_FILE_BYTES) {
      return badRequest(`fileSize exceeds 500 MB limit`);
    }
    if (!mimeType || typeof mimeType !== "string" || !mimeType.startsWith("video/")) {
      return badRequest("mimeType must be a video/* type");
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

    // ── Resolve brand + campaign via service-role client ───────────────
    const supabase = createServiceSupabase();

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

    // ── Build the storage path ─────────────────────────────────────────
    const brandSlug = slugify(brand.name) || "brand";
    const campaignSlug = slugify(campaign.name) || "campaign";
    const athleteSlug = slugify(athleteName) || "athlete";
    const storagePath = `bts/${brandSlug}/${campaignSlug}/${Date.now()}-${athleteSlug}-${randomId()}.${extFrom(filename)}`;

    // ── Signed upload URL ──────────────────────────────────────────────
    const { data: signed, error: signErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(storagePath);
    if (signErr || !signed) {
      return NextResponse.json(
        {
          error:
            "Failed to create signed upload URL: " +
            (signErr?.message ?? "unknown"),
        },
        { status: 500 }
      );
    }

    // holdPosting and submitterName aren't persisted yet — they travel
    // with the client and come back in /api/bts/submit. Keeping them out
    // of storage metadata is intentional so the submit route remains the
    // single source of truth.

    return NextResponse.json({
      uploadUrl: signed.signedUrl,
      storagePath,
      token: signed.token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
