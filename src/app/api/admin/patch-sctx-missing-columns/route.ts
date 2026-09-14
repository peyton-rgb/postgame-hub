import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getStaffUser } from "@/lib/staff-auth";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OLD_ID = "1sojVVOpjEkxqKLiWru2zZYPoqmARwaKSh2PmeAt2znE";
const NEW_ID = "1UmIljCUyoCw2o0BkytpY-FbaI7QBQGYdqtS2zxmUWDk";
const TAB = "All Metrics + Platforms";
const DATA_START = 4;

export async function POST(_req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const auth   = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // 1. Read old tracker columns: E=IG, L=TikTokUser, M=TikTokFollowers, O=Sport, P=Gender
  const oldResp = await sheets.spreadsheets.get({
    spreadsheetId: OLD_ID,
    includeGridData: true,
    ranges: ["'Final Athletes'!A1:P50"],
  });
  const oldRows = oldResp.data.sheets?.[0]?.data?.[0]?.rowData ?? [];

  const oldData = new Map<string, { sport: string; gender: string; tikTokUser: string; tikTokFollowers: string }>();
  for (const row of oldRows) {
    const cells = row.values ?? [];
    const ig     = (cells[4]?.formattedValue ?? "").trim().toLowerCase().replace(/^@/, "");
    const sport  = (cells[14]?.formattedValue ?? "").trim();
    const gender = (cells[15]?.formattedValue ?? "").trim();
    const tikTokUser      = (cells[11]?.formattedValue ?? "").trim();
    const tikTokFollowers = (cells[12]?.formattedValue ?? "").trim();
    if (!ig || ig === "ig") continue;
    oldData.set(ig, { sport, gender, tikTokUser, tikTokFollowers });
  }

  // 2. Read new tracker IG handles (col E) to get row numbers
  const newResp = await sheets.spreadsheets.values.get({
    spreadsheetId: NEW_ID,
    range: `'${TAB}'!E${DATA_START}:E200`,
  });
  const handleToRow = new Map<string, number>();
  (newResp.data.values ?? []).forEach((row, i) => {
    const h = (row[0] ?? "").trim().toLowerCase().replace(/^@/, "");
    if (h) handleToRow.set(h, DATA_START + i);
  });

  // 3. Build writes for Sport (I) and Gender (J)
  const writes: { range: string; values: string[][] }[] = [];
  const patches: { handle: string; row: number; sport: string; gender: string }[] = [];

  for (const [handle, attrs] of oldData.entries()) {
    const row = handleToRow.get(handle);
    if (!row) continue;
    if (attrs.sport)  writes.push({ range: `'${TAB}'!I${row}`, values: [[attrs.sport]]  });
    if (attrs.gender) writes.push({ range: `'${TAB}'!J${row}`, values: [[attrs.gender]] });
    patches.push({ handle, row, sport: attrs.sport, gender: attrs.gender });
  }

  if (writes.length === 0) {
    return NextResponse.json({ message: "Nothing to write" });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: NEW_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data: writes },
  });

  return NextResponse.json({ success: true, cellsWritten: writes.length, athletesPatched: patches.length, patches });
}
