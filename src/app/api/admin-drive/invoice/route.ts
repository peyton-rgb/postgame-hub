// ============================================================
// POST /api/admin-drive/invoice — the admin sends an invoice PDF; the Hub names
// it by the convention, files it in the campaign's Athlete or Videographer
// Invoices folder, and records where it went.
//
// Brief 15 §1c. The admin owns the billing record. This endpoint owns the FILE:
// where it lands and what it is called, so that two people submitting on the
// same day cannot overwrite each other and a resubmission does not replace the
// original.
//
// NO QUEUE HERE, unlike the campaign handoff. A parked handoff is harmless
// because it holds ids; parking a PDF would mean the Hub storing a payment
// document for a campaign it cannot place, with no folder to put it in. An
// unplaceable invoice is returned to the admin, which still holds it.
//
// The PDF is uploaded and forgotten. invoice_files records the name, the id and
// who it came from — the contents are never parsed or stored.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import {
  invoiceFileName,
  invoiceFolderField,
  requireFields,
  type SubmitterKind,
} from "@/lib/admin-drive/contract";
import {
  adminDriveDb,
  authorized,
  logRun,
  NOT_FOUND,
  readJsonBody,
} from "@/lib/admin-drive/service";
import { campaignYear } from "@/lib/drive-provision";
import { listFileNames, uploadFile } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Drive's own cap is far higher; this is a sanity bound on a base64 body. */
const MAX_PDF_BYTES = 25 * 1024 * 1024;

const KINDS: readonly SubmitterKind[] = ["athlete", "videographer"];

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NOT_FOUND;

  const startedAt = Date.now();
  const body = await readJsonBody(req);
  if (!body) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const missing = requireFields(body, [
    "cf_campaign_id",
    "submitter_kind",
    "submitter_name",
    "pdf_base64",
  ]);
  if (missing.length > 0) {
    return NextResponse.json({ error: "Missing required fields", missing }, { status: 400 });
  }

  const cfCampaignId = String(body.cf_campaign_id).trim();
  const submitterName = String(body.submitter_name).trim();
  const kind = String(body.submitter_kind).trim().toLowerCase() as SubmitterKind;

  if (!KINDS.includes(kind)) {
    return NextResponse.json(
      { error: "submitter_kind must be 'athlete' or 'videographer'", received: body.submitter_kind },
      { status: 400 },
    );
  }

  let pdf: Buffer;
  try {
    pdf = Buffer.from(String(body.pdf_base64), "base64");
  } catch {
    return NextResponse.json({ error: "pdf_base64 is not valid base64" }, { status: 400 });
  }
  if (pdf.length === 0) {
    return NextResponse.json({ error: "pdf_base64 decoded to zero bytes" }, { status: 400 });
  }
  if (pdf.length > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "pdf too large", bytes: pdf.length, max_bytes: MAX_PDF_BYTES },
      { status: 413 },
    );
  }

  const db = adminDriveDb();

  try {
    const { data: matches, error: findError } = await db
      .from("campaign_recaps")
      .select(
        "id, name, brand_id, admin_created_on, created_at, drive_invoices_athlete_folder_id, drive_invoices_videographer_folder_id",
      )
      .eq("admin_campaign_id", cfCampaignId)
      .limit(2);

    if (findError) throw new Error(`campaign_recaps lookup failed: ${findError.message}`);

    if (matches && matches.length > 1) {
      return NextResponse.json(
        {
          error: "ambiguous_campaign",
          detail: `${matches.length} campaign_recaps rows carry admin_campaign_id ${cfCampaignId}`,
        },
        { status: 409 },
      );
    }

    const campaign = matches?.[0] ?? null;
    if (!campaign) {
      return NextResponse.json(
        {
          error: "campaign_not_found",
          detail:
            "The Hub has not synced this campaign yet, so there is nowhere to file the invoice. Retry after the nightly campaign sync. The invoice was NOT stored.",
          cf_campaign_id: cfCampaignId,
        },
        { status: 409 },
      );
    }

    const folderField = invoiceFolderField(kind);
    const folderId = (campaign as unknown as Record<string, unknown>)[folderField];
    if (!folderId || String(folderId).trim() === "") {
      return NextResponse.json(
        {
          error: "invoices_folder_missing",
          detail: `The Hub has no ${kind} invoices folder for this campaign. Post the campaign handoff (POST /api/admin-drive/campaign) first. The invoice was NOT stored.`,
          campaign_id: campaign.id,
          missing_field: folderField,
        },
        { status: 409 },
      );
    }

    // The name needs the brand. A campaign with no brand cannot produce a
    // conventional filename, and inventing a placeholder would put a file in
    // Drive that no later lookup can find.
    if (!campaign.brand_id) {
      return NextResponse.json(
        {
          error: "brand_unresolved",
          detail: "The campaign has no brand_id, so the invoice filename cannot be built. The invoice was NOT stored.",
          campaign_id: campaign.id,
        },
        { status: 409 },
      );
    }

    const { data: brand, error: brandError } = await db
      .from("brands")
      .select("id, name")
      .eq("id", campaign.brand_id)
      .maybeSingle();

    if (brandError) throw new Error(`brands lookup failed: ${brandError.message}`);
    if (!brand) throw new Error(`campaign ${campaign.id} points at missing brand ${campaign.brand_id}`);

    const ctx = {
      brand: brand.name,
      campaign: campaign.name,
      year: campaignYear({
        id: campaign.id,
        name: campaign.name,
        brand_id: campaign.brand_id,
        admin_created_on: campaign.admin_created_on,
        created_at: campaign.created_at ?? new Date().toISOString(),
      }),
    };

    // The suffix is decided from what is in the FOLDER, not from invoice_files.
    // Drive is the thing that can actually collide, and a file put there by
    // hand has to count too.
    const existingNames = await listFileNames(String(folderId));
    const fileName = invoiceFileName(submitterName, ctx, existingNames);

    const uploaded = await uploadFile(
      fileName,
      "application/pdf",
      pdf,
      String(folderId),
    );

    // Record it. A failure here means the PDF is in Drive but unrecorded —
    // reported as a 500 with the link, so the admin can see the file landed
    // and nobody re-uploads it into a second copy.
    const { error: insertError } = await db.from("invoice_files").insert({
      campaign_id: campaign.id,
      cf_campaign_id: cfCampaignId,
      submitter_kind: kind,
      submitter_name: submitterName,
      invoice_number: body.invoice_number ? String(body.invoice_number).trim() : null,
      drive_file_name: fileName,
      drive_file_id: uploaded.id,
      web_view_link: uploaded.url,
      submitted_at: body.submitted_at ? String(body.submitted_at) : null,
    });

    const output = {
      campaign_id: campaign.id,
      drive_file_id: uploaded.id,
      drive_file_name: fileName,
      web_view_link: uploaded.url,
      folder_field: folderField,
      recorded: !insertError,
    };

    if (insertError) {
      console.error("[admin-drive/invoice] invoice_files insert failed:", insertError.message);
      await logRun(db, {
        endpoint: "invoice",
        input: { cf_campaign_id: cfCampaignId, submitter_kind: kind, submitter_name: submitterName },
        output,
        status: "failed",
        startedAt,
        errorMessage: `uploaded but not recorded: ${insertError.message}`,
      });
      return NextResponse.json(
        {
          error: "uploaded_but_not_recorded",
          detail:
            "The PDF is in Drive but the Hub failed to record it. Do NOT re-post: that would file a second copy. The link is below.",
          ...output,
        },
        { status: 500 },
      );
    }

    await logRun(db, {
      endpoint: "invoice",
      input: { cf_campaign_id: cfCampaignId, submitter_kind: kind, submitter_name: submitterName },
      output,
      status: "complete",
      startedAt,
    });

    return NextResponse.json({ ok: true, ...output }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin-drive/invoice]", message);
    await logRun(db, {
      endpoint: "invoice",
      input: { cf_campaign_id: cfCampaignId, submitter_kind: kind, submitter_name: submitterName },
      output: null,
      status: "failed",
      startedAt,
      errorMessage: message,
    });
    return NextResponse.json({ error: "internal_error", detail: message }, { status: 500 });
  }
}
