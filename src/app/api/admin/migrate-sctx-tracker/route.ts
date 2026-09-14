import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getStaffUser } from "@/lib/staff-auth";
import { createLiveServiceSupabase } from "@/lib/supabase-server";
import { copyFile } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const OLD_SHEET_ID   = "1sojVVOpjEkxqKLiWru2zZYPoqmARwaKSh2PmeAt2znE";
const TEMPLATE_ID    = "1gzkzwpEXfMR2Jsk3vwbdfTCqVO7BBZ0156YDEMDtpzc";
const DEST_FOLDER_ID = "16I7T1GGvCjNtToq0zFuf7CQwaOqSeS7-";
const CAMPAIGN_ID    = "db617ccd-14d4-4b40-ad82-37400e576e9b";
const NEW_TRACKER_NAME = "South Central Texas Beverages McDonald's '26 Performance Tracker";

function getAuth() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

export async function POST(_req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const auth   = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const supabase = createLiveServiceSupabase();

  // 1. Read old tracker with full cell data (to get hyperlinks)
  const readResp = await sheets.spreadsheets.get({
    spreadsheetId: OLD_SHEET_ID,
    includeGridData: true,
    ranges: ["'Final Athletes'!A1:N50"],
  });

  const rowData = readResp.data.sheets?.[0]?.data?.[0]?.rowData ?? [];

  const athletes: Array<{
    firstName: string; lastName: string; contentUrl: string;
    igHandle: string; igFollowers: number; college: string;
  }> = [];

  for (const row of rowData) {
    const cells = row.values ?? [];
    const fname    = cells[0]?.formattedValue?.trim() ?? "";
    const lname    = cells[1]?.formattedValue?.trim() ?? "";
    const igHandle = (cells[4]?.formattedValue ?? "").trim();
    const igFollowers = parseInt(
      (cells[10]?.formattedValue ?? "0").replace(/,/g, ""), 10
    ) || 0;
    const college  = (cells[13]?.formattedValue ?? "").trim();

    // Content folder URL — prefer explicit hyperlink, fall back to cell text
    const contentCell = cells[2];
    let contentUrl =
      contentCell?.hyperlink ??
      contentCell?.textFormatRuns?.[0]?.format?.link?.uri ??
      contentCell?.formattedValue?.trim() ??
      "";

    // Skip non-athlete rows
    if (!fname || !lname || !igHandle || fname.startsWith("Tier") || fname === "FName") continue;

    athletes.push({ firstName: fname, lastName: lname, contentUrl, igHandle, igFollowers, college });
  }

  if (athletes.length === 0) {
    return NextResponse.json({ error: "No athletes parsed from old tracker" }, { status: 400 });
  }

  // 2. Copy new template into SCTX campaign folder
  const newFile = await copyFile(TEMPLATE_ID, NEW_TRACKER_NAME, DEST_FOLDER_ID);

  // 3. Write athletes into new tracker starting at row 4
  // Columns: A=First Name B=Last Name C=Content Folder D=Content Rating(blank)
  //          E=IG Handle  F=IG Followers G=Reach Level(blank) H=Colleges I=Sport(blank)
  const athleteRows = athletes.map((a) => [
    a.firstName,
    a.lastName,
    a.contentUrl ? `=HYPERLINK("${a.contentUrl.replace(/"/g, "")}", "Open Folder")` : "",
    "",           // Content Rating
    a.igHandle,
    a.igFollowers || "",
    "",           // Reach Level (auto-calc from template formula)
    a.college,
    "",           // Sport
  ]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: newFile.id,
    range: `'All Metrics + Platforms'!A4:I${3 + athleteRows.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: athleteRows },
  });

  // 4. Update Hub DB — point campaign at new tracker
  const { error: dbError } = await supabase
    .from("campaign_recaps")
    .update({
      tracker_sheet_id: newFile.id,
      tracker_url: newFile.url,
      drive_provisioned_at: new Date().toISOString(),
    })
    .eq("id", CAMPAIGN_ID);

  if (dbError) {
    return NextResponse.json({ error: dbError.message, newTracker: newFile }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    athletesMigrated: athletes.length,
    newTrackerId: newFile.id,
    newTrackerUrl: newFile.url,
    athletes: athletes.map((a) => `${a.firstName} ${a.lastName} (@${a.igHandle})`),
  });
}
