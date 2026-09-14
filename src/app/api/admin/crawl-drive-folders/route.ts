// GET /api/admin/crawl-drive-folders
// Crawls every campaign's Drive folder and reports what's actually there
// vs. what the Hub DB has linked. Used to find trackers, content folders,
// and other assets that exist in Drive but aren't connected yet.

import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { getStaffUser } from "@/lib/staff-auth";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SHEET_MIME  = "application/vnd.google-apps.spreadsheet";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";

// Keywords that suggest a file is a performance tracker
const TRACKER_KEYWORDS = [
  "performance", "tracker", "recap", "metrics", "external", "internal",
  "all metrics", "posting", "results", "campaign tracker",
];

function looksLikeTracker(name: string): boolean {
  const n = name.toLowerCase();
  return TRACKER_KEYWORDS.some(k => n.includes(k));
}

// Standard subfolder names we expect
const EXPECTED_FOLDERS = ["content", "legal", "brand legal", "athlete legal",
  "travel", "production assets", "invoices", "trackers"];

function folderRole(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("content")) return "content";
  if (n.includes("brand legal")) return "brand-legal";
  if (n.includes("athlete legal")) return "athlete-legal";
  if (n.includes("legal")) return "legal";
  if (n.includes("travel")) return "travel";
  if (n.includes("production")) return "production-assets";
  if (n.includes("invoice")) return "invoices";
  if (n.includes("tracker")) return "trackers";
  return "other";
}

export async function GET(req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  // Optional: filter to one brand for faster runs
  const brand = req.nextUrl.searchParams.get("brand");
  const statusFilter = req.nextUrl.searchParams.get("status") || "published";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Load all campaigns with drive_folder_id
  let query = supabase
    .from("campaign_recaps")
    .select("id, name, status, drive_folder_id, tracker_sheet_id, brands(name)")
    .not("drive_folder_id", "is", null)
    .neq("drive_folder_id", "BROKEN_ALLSTATE_PENDING_RELINK");

  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (brand) query = query.eq("brands.name", brand);

  const { data: campaigns, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const auth  = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  const results: {
    id: string;
    brand: string;
    campaign: string;
    status: string;
    drive_folder_id: string;
    tracker_linked: string | null;
    // What we found in Drive:
    sheets_found: { id: string; name: string; looksLikeTracker: boolean }[];
    folders_found: { id: string; name: string; role: string }[];
    shortcuts_found: { id: string; name: string }[];
    has_content_folder: boolean;
    has_legal_folder: boolean;
    has_tracker_in_drive: boolean;
    tracker_not_linked: boolean; // tracker exists in Drive but not in DB
    flags: string[];
  }[] = [];

  // Process in batches of 10 to avoid rate limits
  const BATCH = 10;
  for (let i = 0; i < (campaigns ?? []).length; i += BATCH) {
    const batch = (campaigns ?? []).slice(i, i + BATCH);

    await Promise.all(batch.map(async (c: any) => {
      const flags: string[] = [];
      let sheets: { id: string; name: string; looksLikeTracker: boolean }[] = [];
      let folders: { id: string; name: string; role: string }[] = [];
      let shortcuts: { id: string; name: string }[] = [];

      try {
        const resp = await drive.files.list({
          q: `'${c.drive_folder_id}' in parents and trashed = false`,
          fields: "files(id,name,mimeType)",
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          pageSize: 50,
        });

        const files = resp.data.files ?? [];

        for (const f of files) {
          if (f.mimeType === SHEET_MIME) {
            sheets.push({ id: f.id!, name: f.name!, looksLikeTracker: looksLikeTracker(f.name!) });
          } else if (f.mimeType === FOLDER_MIME) {
            folders.push({ id: f.id!, name: f.name!, role: folderRole(f.name!) });
          } else if (f.mimeType === SHORTCUT_MIME) {
            shortcuts.push({ id: f.id!, name: f.name! });
          }
        }

        const hasContent = folders.some(f => f.role === "content");
        const hasLegal   = folders.some(f => f.role === "legal" || f.role === "brand-legal");
        const trackerSheets = sheets.filter(s => s.looksLikeTracker);
        const hasTrackerInDrive = trackerSheets.length > 0;
        const trackerNotLinked = hasTrackerInDrive && !c.tracker_sheet_id;

        if (!hasContent) flags.push("no-content-folder");
        if (!hasLegal) flags.push("no-legal-folder");
        if (trackerNotLinked) flags.push("tracker-in-drive-not-linked");
        if (!c.tracker_sheet_id && !hasTrackerInDrive) flags.push("no-tracker-anywhere");
        if (c.status === "published" && !c.tracker_sheet_id) flags.push("PUBLISHED-NO-TRACKER");

        results.push({
          id: c.id,
          brand: c.brands?.name ?? "Unknown",
          campaign: c.name,
          status: c.status,
          drive_folder_id: c.drive_folder_id,
          tracker_linked: c.tracker_sheet_id,
          sheets_found: sheets,
          folders_found: folders,
          shortcuts_found: shortcuts,
          has_content_folder: hasContent,
          has_legal_folder: hasLegal,
          has_tracker_in_drive: hasTrackerInDrive,
          tracker_not_linked: trackerNotLinked,
          flags,
        });
      } catch (e: unknown) {
        results.push({
          id: c.id,
          brand: c.brands?.name ?? "Unknown",
          campaign: c.name,
          status: c.status,
          drive_folder_id: c.drive_folder_id,
          tracker_linked: c.tracker_sheet_id,
          sheets_found: [],
          folders_found: [],
          shortcuts_found: [],
          has_content_folder: false,
          has_legal_folder: false,
          has_tracker_in_drive: false,
          tracker_not_linked: false,
          flags: ["DRIVE-ERROR: " + (e instanceof Error ? e.message : String(e))],
        });
      }
    }));

    // Small pause between batches to avoid rate limiting
    if (i + BATCH < (campaigns ?? []).length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // Summary stats
  const summary = {
    total: results.length,
    published: results.filter(r => r.status === "published").length,
    published_no_tracker: results.filter(r => r.status === "published" && !r.tracker_linked).length,
    tracker_in_drive_not_linked: results.filter(r => r.tracker_not_linked).length,
    no_tracker_anywhere: results.filter(r => !r.tracker_linked && !r.has_tracker_in_drive).length,
    no_content_folder: results.filter(r => !r.has_content_folder).length,
    errors: results.filter(r => r.flags.some(f => f.startsWith("DRIVE-ERROR"))).length,
  };

  return NextResponse.json({ summary, results });
}
