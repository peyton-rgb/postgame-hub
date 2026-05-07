// ============================================================
// POST /api/editing/ffmpeg
// STUB — runs an FFmpeg WASM transformation server-side and uploads
// the result to the 'media' bucket. The real implementation will live
// here once the @ffmpeg/ffmpeg integration is in.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'Not implemented — FFmpeg integration pending' },
    { status: 501 }
  );
}
