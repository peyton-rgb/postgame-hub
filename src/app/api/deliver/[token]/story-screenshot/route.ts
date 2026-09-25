// ============================================================
// POST /api/deliver/[token]/story-screenshot — proof the post went on the
// athlete's Instagram Story (Stories vanish after a day).
//
// Public endpoint — no auth; the token is the gate. multipart/form-data:
//   postId  which of the athlete's posts (must belong to the token's athlete)
//   file    one image
//
//   • JPEG, PNG, WEBP, HEIC or HEIF, checked by the file's first bytes, not
//     the type it claims; 10 MB max.
//   • Stored server-side with the service role in campaign-media at
//     posting/story-screenshots/<package_id>/<random uuid>.<ext>.
//     NOTE: campaign-media is a PUBLIC bucket — the path can't be guessed,
//     but anyone holding the URL can open the file.
//   • Never overwrites: a post that already has one is a 409.
//   • After the write, maybeMarkPosted() marks the post Posted only once all
//     four are in.
//
// Vercel caps a request body at ~4.5 MB, so the page shrinks the screenshot
// before sending it; this route still enforces its own 10 MB limit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { STORY_MAX_BYTES, loadDeliverView, writeStoryScreenshot } from '@/lib/deliver-package';

export const dynamic = 'force-dynamic';

const TOO_BIG = "That didn't upload. Try a smaller screenshot.";

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // Refuse an oversized body before reading it, when the size is declared.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > STORY_MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ error: TOO_BIG }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const postId = form?.get('postId');
  if (!form || !file || typeof file === 'string') {
    return NextResponse.json({ error: 'Choose a screenshot first.' }, { status: 400 });
  }
  if (file.size > STORY_MAX_BYTES) {
    return NextResponse.json({ error: TOO_BIG }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await writeStoryScreenshot(params.token, typeof postId === 'string' ? postId : null, {
    bytes,
    declaredType: file.type ?? '',
    name: file.name ?? '',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(await loadDeliverView(params.token));
}
