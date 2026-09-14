import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getStaffUser } from "@/lib/staff-auth";
import { getGoogleAuth } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

const OLD_ID = "1sojVVOpjEkxqKLiWru2zZYPoqmARwaKSh2PmeAt2znE";

export async function GET(_req: NextRequest) {
  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const sheets = google.sheets({ version: "v4", auth: getGoogleAuth() });

  // Read the full sheet including all columns to see what metrics exist
  const resp = await sheets.spreadsheets.get({
    spreadsheetId: OLD_ID,
    includeGridData: true,
    ranges: ["'Final Athletes'!A1:AZ30"],
  });

  const rowData = resp.data.sheets?.[0]?.data?.[0]?.rowData ?? [];

  // Get column headers from row 1
  const headers = (rowData[0]?.values ?? []).map((c, i) => ({
    col: i,
    colLetter: colLetter(i),
    header: c.formattedValue?.trim() ?? "",
  })).filter(h => h.header);

  // Get all data rows with values
  const rows = rowData.slice(1).map((row, rowIdx) => {
    const cells: Record<string, string> = {};
    (row.values ?? []).forEach((cell, i) => {
      const h = headers.find(h => h.col === i);
      if (h && h.header) {
        cells[h.header] = cell.formattedValue?.trim() ?? "";
      }
    });
    return { rowNum: rowIdx + 2, cells };
  }).filter(r => Object.values(r.cells).some(v => v));

  return NextResponse.json({ headers, rows, totalHeaders: headers.length });
}

function colLetter(n: number): string {
  let s = "";
  n++;
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}
