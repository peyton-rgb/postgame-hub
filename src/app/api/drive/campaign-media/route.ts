// src/app/api/drive/campaign-media/route.ts
// ─────────────────────────────────────────────────────────────
// GET /api/drive/campaign-media?folderId=XXXXX
//
// Fetches all athlete subfolders and their media files from a
// Google Drive campaign folder. Returns structured data for the
// recap builder's Upload Content tab.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getCampaignDriveMedia } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    if (!folderId) {
      return NextResponse.json(
        { error: "Missing folderId parameter" },
        { status: 400 }
      );
    }

    // Validate folderId format (basic sanitization)
    if (!/^[a-zA-Z0-9_-]+$/.test(folderId)) {
      return NextResponse.json(
        { error: "Invalid folderId format" },
        { status: 400 }
      );
    }

    const data = await getCampaignDriveMedia(folderId);

    return NextResponse.json(data, {
      headers: {
        // Cache for 5 minutes — Drive data doesn't change that fast
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error: any) {
    console.error("[drive/campaign-media] Error:", error);

    // DEBUG: temporary verbose error — remove after fix
    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch Drive media",
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
