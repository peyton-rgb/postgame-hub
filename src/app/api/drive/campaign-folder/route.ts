// src/app/api/drive/campaign-folder/route.ts
// ─────────────────────────────────────────────────────────────
// Staff-only. Provisions a campaign's Drive folder tree:
//
//   <brand>/[optional grouper]/<campaign name>/
//     ├── Content
//     └── Contracts/
//         ├── Drafts
//         └── Signed
//
// Keyed by CAMPAIGN, not by submission-link token: folders belong to the
// campaign, and the "New submission form" modal needs to provision one before
// any form (and therefore any token) exists.
//
// Everything here is idempotent. ensureFolder adopts an existing same-named
// child rather than creating a second one, at every level — which matters
// because duplicate folder names already exist inside single brands (CVS has
// two `Affiliates`, McDonald's five `Athlete Content`). Re-running this against
// a provisioned campaign is a no-op that returns the same ids.
//
// `Content` keeps that exact name: the submission upload path already calls
// ensureFolder("Content", …) and SVA Beverages has 30 live files in one.
//
// Deliberately NOT created: `Trackers` and `Recaps`. Trackers and briefs are
// Sheets and Docs living wherever they were made, referenced by
// campaign_recaps.tracker_url / brief_url — not files in a campaign folder.
// Creating those folders would advertise a filing location that isn't real.
// Add them when something starts writing files into them. Not before.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getStaffUser } from "@/lib/staff-auth";
import { createServiceSupabase } from "@/lib/supabase-server";
import { ensureFolder, getDriveClient } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Is a recorded folder id still usable? A stored id can outlive the folder it
 * names — SVA Beverages spent a while pointing at a `Content` subfolder that
 * was later trashed. Creating subfolders inside a trashed parent would put the
 * whole tree in the bin, silently, so an unusable id is reported rather than
 * built on. Returns null when the folder is fine.
 */
async function folderProblem(folderId: string): Promise<string | null> {
  try {
    const { data } = await getDriveClient().files.get({
      fileId: folderId,
      supportsAllDrives: true,
      fields: "id, trashed, mimeType",
    });
    if (data.trashed) return "the folder it points to is in the trash";
    if (data.mimeType !== "application/vnd.google-apps.folder") return "it points to a file, not a folder";
    return null;
  } catch {
    return "the folder it points to no longer exists";
  }
}

export async function POST(req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const campaignId = String(body?.campaignId ?? "").trim();
  if (!UUID_RE.test(campaignId)) {
    return NextResponse.json({ error: "That doesn't look like a campaign ID." }, { status: 400 });
  }

  const svc = createServiceSupabase();

  const { data: recap } = await svc
    .from("campaign_recaps")
    .select(
      "id, name, drive_folder_id, brand:brands!campaigns_brand_id_fkey(name, drive_parent_folder_id, drive_campaign_subfolder_id)"
    )
    .eq("id", campaignId)
    .single();
  if (!recap) return NextResponse.json({ error: "No campaign with that ID." }, { status: 404 });

  const campaignName = (recap.name ?? "").trim();
  if (!campaignName) {
    return NextResponse.json({ error: "This campaign has no name to file under." }, { status: 400 });
  }

  // The grouper is an optional folder inside the brand tree where campaign
  // folders actually live — set on adidas ("adidas 2026"), null everywhere
  // else, in which case campaigns land at the brand root.
  const parentId = recap.brand?.drive_campaign_subfolder_id ?? recap.brand?.drive_parent_folder_id ?? null;
  if (!parentId) {
    // Nothing has been created at this point, so there is no partial tree.
    return NextResponse.json(
      { error: `${recap.brand?.name ?? "This brand"} has no Drive folder yet, so there's nowhere to create this.` },
      { status: 400 }
    );
  }

  // ── 1. the campaign folder ──
  // Always the value in the row as of this request — never one the client was
  // holding, which may predate a correction.
  let campaignFolderId = recap.drive_folder_id ?? null;
  let campaignCreated = false;

  if (campaignFolderId) {
    // Adopting a recorded folder means trusting it. Check before building on it:
    // re-pointing a bad id is a staff decision, not something to guess at here.
    const problem = await folderProblem(campaignFolderId);
    if (problem) {
      return NextResponse.json(
        {
          error: `This campaign's recorded Drive folder can't be used — ${problem}. Clear or re-point it, then try again.`,
          driveFolderId: campaignFolderId,
        },
        { status: 409 }
      );
    }
  }

  if (!campaignFolderId) {
    try {
      const folder = await ensureFolder(campaignName, parentId);
      campaignFolderId = folder.id;
      campaignCreated = folder.created;
    } catch (e: any) {
      console.error("[campaign-folder] campaign folder failed:", e?.message);
      return NextResponse.json({ error: "Couldn't create the campaign folder in Drive." }, { status: 502 });
    }

    // Record the id BEFORE the subfolders. If a subfolder call then fails, the
    // folder that exists in Drive is already the one we know about, so a retry
    // adopts it instead of creating a second one.
    const { error: writeError } = await svc
      .from("campaign_recaps")
      .update({ drive_folder_id: campaignFolderId })
      .eq("id", campaignId);
    if (writeError) {
      console.error("[campaign-folder] drive_folder_id write-back failed:", writeError.message);
      return NextResponse.json(
        { error: "The folder was created in Drive but couldn't be recorded. Re-run to adopt it." },
        { status: 500 }
      );
    }
  }

  // ── 2. the standard subfolders ──
  // Four create calls means four chances to fail halfway. A partial tree is
  // left exactly as it is and reported: a stray empty folder is recoverable,
  // a delete is not.
  try {
    const content = await ensureFolder("Content", campaignFolderId);
    const contracts = await ensureFolder("Contracts", campaignFolderId);
    const drafts = await ensureFolder("Drafts", contracts.id);
    const signed = await ensureFolder("Signed", contracts.id);

    // NOTE: campaign_recaps.drive_contracts_signed_folder_id does not exist
    // yet. When it lands, persist signed.id here — the contract workflow must
    // never resolve `Signed` by name at write time, because duplicate folder
    // names inside a single brand are already a fact of this Drive.
    return NextResponse.json({
      ok: true,
      driveFolderId: campaignFolderId,
      contentFolderId: content.id,
      contractsFolderId: contracts.id,
      draftsFolderId: drafts.id,
      signedFolderId: signed.id,
      created: {
        campaign: campaignCreated,
        content: content.created,
        contracts: contracts.created,
        drafts: drafts.created,
        signed: signed.created,
      },
    });
  } catch (e: any) {
    console.error("[campaign-folder] subfolder step failed:", e?.message);
    return NextResponse.json(
      {
        error: "The campaign folder is there, but its subfolders didn't finish. Re-run to complete it.",
        driveFolderId: campaignFolderId,
      },
      { status: 502 }
    );
  }
}
