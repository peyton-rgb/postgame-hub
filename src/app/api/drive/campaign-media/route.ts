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

    // Handle specific Google API errors
    if (error?.code === 404) {
      return NextResponse.json(
        { error: "Folder not found. Make sure it's shared with the service account." },
        { status: 404 }
      );
    }

    if (error?.code === 403) {
      return NextResponse.json(
        {
          error:
            "Access denied. Share the Drive folder with the service account email.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch Drive media" },
      { status: 500 }
    );
  }
}
