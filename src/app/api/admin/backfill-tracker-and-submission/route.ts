// src/app/api/admin/backfill-tracker-and-submission/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/admin/backfill-tracker-and-submission
//
// One-time staff-triggered backfill for campaigns that were created after
// FEATURE_LAUNCH_DATE but already had a drive_folder_id set manually before
// the drive-folders automation existed. Those campaigns have folders but
// are missing:
//   - tracker_sheet_id (Performance Tracker copy)
//   - active submission link
//
// The drive-folders cron skips them because it only considers campaigns
// where drive_folder_id IS NULL. This route handles exactly that gap.
//
// Idempotent — adopt-before-create on both tracker and submission link.
// Safe to run multiple times; already-provisioned campaigns are skipped.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getStaffUser } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { copyFile, findFileByName } from "@/lib/google-drive";
import { campaignYear } from "@/lib/drive-provision";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FEATURE_LAUNCH_DATE = "2026-08-31";
const TRACKER_TEMPLATE_ID = "1gzkzwpEXfMR2Jsk3vwbdfTCqVO7BBZ0156YDEMDtpzc";
const UNLIMITED_FILES = 9999;

export async function POST(_req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff access required" }, { status: 403 });

  const supabase = createLiveServiceSupabase();

  // Campaigns created after the launch date that already have a folder
  // but are missing a tracker sheet.
  const { data: rows, error: queryError } = await supabase
    .from("campaign_recaps")
    .select("id, name, brand_id, drive_folder_id, admin_created_on, created_at")
    .eq("type", "recap")
    .not("drive_folder_id", "is", null)
    .is("tracker_sheet_id", null)
    .gte("created_at", FEATURE_LAUNCH_DATE)
    .order("created_at", { ascending: true });

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  // Filter out any rows with placeholder/broken folder IDs.
  const candidates = (rows ?? []).filter(
    (r) => r.drive_folder_id && !r.drive_folder_id.startsWith("BROKEN")
  ) as Array<{
    id: string;
    name: string;
    brand_id: string | null;
    drive_folder_id: string;
    admin_created_on: string | null;
    created_at: string;
  }>;

  // Load brand names in one read.
  const brandIds = [...new Set(candidates.map((c) => c.brand_id).filter(Boolean))] as string[];
  const { data: brandRows } = await supabase
    .from("brands")
    .select("id, name")
    .in("id", brandIds);
  const brands = new Map((brandRows ?? []).map((b) => [b.id, b.name as string]));

  const provisioned: { id: string; name: string; tracker: boolean; submissionLink: boolean }[] = [];
  const skipped: { id: string; name: string; reason: string }[] = [];

  for (const candidate of candidates) {
    try {
      const brandName = candidate.brand_id ? (brands.get(candidate.brand_id) ?? "Unknown") : "Unknown";
      const year = campaignYear(candidate);
      const trackerYear = String(year).slice(-2);
      const trackerName = `${candidate.name} ${brandName} '${trackerYear} Performance Tracker`;

      // Tracker — adopt-before-create.
      const existing = await findFileByName(trackerName, candidate.drive_folder_id);
      const tracker = existing ?? (await copyFile(TRACKER_TEMPLATE_ID, trackerName, candidate.drive_folder_id));
      let trackerCreated = !existing;

      // Submission link — adopt-before-create.
      const { data: existingLink } = await supabase
        .from("submission_links")
        .select("token")
        .eq("campaign_id", candidate.id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();

      let submissionLinkCreated = false;
      if (!existingLink) {
        const { error: linkError } = await supabase.from("submission_links").insert({
          token: randomBytes(12).toString("hex"),
          campaign_id: candidate.id,
          active: true,
          min_photos: 3,
          min_videos: 1,
          max_files: UNLIMITED_FILES,
          deliverables: null,
          brief_url: null,
          expires_at: null,
          created_by: staff.id,
        });
        if (linkError) throw new Error(`submission_links insert failed: ${linkError.message}`);
        submissionLinkCreated = true;
      }

      // Save tracker ID/URL — don't touch drive_folder_id or other folder IDs.
      const { error: updateError } = await supabase
        .from("campaign_recaps")
        .update({
          tracker_sheet_id: tracker.id,
          tracker_url: tracker.url,
          drive_provisioned_at: new Date().toISOString(),
        })
        .eq("id", candidate.id);

      if (updateError) throw new Error(`campaign update failed: ${updateError.message}`);

      provisioned.push({
        id: candidate.id,
        name: candidate.name,
        tracker: trackerCreated,
        submissionLink: submissionLinkCreated,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[backfill] ${candidate.id} (${candidate.name}) failed:`, message);
      skipped.push({ id: candidate.id, name: candidate.name, reason: message });
    }
  }

  return NextResponse.json({
    considered: candidates.length,
    provisioned,
    skipped,
  });
}
