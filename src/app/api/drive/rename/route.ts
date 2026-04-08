// src/app/api/drive/rename/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/drive/rename
// Body: { folderId: "131h_Hyjnv1JmbYCpWNLX9lsJMEI9vX8Z" }
//
// Renames all media files in athlete subfolders:
//   MARISA SNEE/IMG_4821.HEIC → MARISA SNEE/Marisa_Snee_01.heic
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { renameAthleteFiles } from "@/lib/google-drive";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 min for large campaigns

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { folderId } = body;

    if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId)) {
      return NextResponse.json(
        { error: "Invalid or missing folderId" },
        { status: 400 }
      );
    }

    const result = await renameAthleteFiles(folderId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[drive/rename] Error:", error);
    // DEBUG: temporary verbose error — remove after fix
    return NextResponse.json(
      {
        error: error?.message || "Failed to rename files",
        name: error?.name || "Unknown",
        stack: error?.stack || null,
        response_data: error?.response?.data || error?.errors || null,
        code: error?.code || null,
        env_check: {
          client_id_set: !!process.env.GOOGLE_CLIENT_ID,
          client_secret_set: !!process.env.GOOGLE_CLIENT_SECRET,
          refresh_token_set: !!process.env.GOOGLE_REFRESH_TOKEN,
        },
      },
      { status: 500 }
    );
  }
}
