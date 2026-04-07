// src/app/api/convert-image/route.ts
// ─────────────────────────────────────────────────────────────
// POST /api/convert-image
// Body: multipart FormData with a "file" field
//
// Converts HEIC, RAW, and other non-web image formats to JPEG
// using sharp. Returns the converted image as image/jpeg.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing file in form data" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const jpegBuffer = await sharp(buffer)
      .jpeg({ quality: 92 })
      .toBuffer();

    return new NextResponse(jpegBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(jpegBuffer.length),
      },
    });
  } catch (error: any) {
    console.error("[convert-image] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to convert image" },
      { status: 500 }
    );
  }
}
