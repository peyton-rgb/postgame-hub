// src/app/api/drive/thumbnail/[fileId]/route.ts
// ─────────────────────────────────────────────────────────────
// GET /api/drive/thumbnail/FILEID
//
// Proxies Drive file thumbnails through our server so the
// browser doesn't need Drive auth. Returns the image binary.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getDriveThumbnail } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { fileId: string } }
) {
  try {
    const { fileId } = params;

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return NextResponse.json(
        { error: "Invalid fileId" },
        { status: 400 }
      );
    }

    const imageBuffer = await getDriveThumbnail(fileId);

    if (!imageBuffer) {
      return NextResponse.json(
        { error: "Thumbnail not available" },
        { status: 404 }
      );
    }

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
      },
    });
  } catch (error) {
    console.error("[drive/thumbnail] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch thumbnail" },
      { status: 500 }
    );
  }
}
