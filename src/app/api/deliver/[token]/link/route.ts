// ============================================================
// POST /api/deliver/[token]/link — the athlete sends one platform's link
//
// Public endpoint — no auth; the token is the gate. Body:
//   { postId, platform: 'instagram' | 'tiktok' | 'x', url }
//
//   • postId names which of the athlete's posts this is for. It is a package
//     id, never a token, and it only resolves if it belongs to the token's
//     own athlete (loadPackageState) — anything else is a 404.
//   • The URL is checked for that platform's post shape (checkPlatformLink,
//     the same check the page runs) and stored without tracking parameters.
//   • Never overwrites: a platform that already has a link is a 409, and the
//     saved one stands. Staff can clear it from the panel.
//   • instagram also writes live_url. After the write, maybeMarkPosted()
//     marks the post Posted only once all four are in.
//
// Answers with the page's whole view, so the page can re-render from it.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { loadDeliverView, writeLink } from '@/lib/deliver-package';
import { PLATFORMS, checkPlatformLink, type Platform } from '@/lib/post-link';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await request.json().catch(() => ({}));
  const postId = typeof body?.postId === 'string' ? body.postId : null;
  const platform = body?.platform as Platform;
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
  }

  const check = checkPlatformLink(platform, body?.url);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const result = await writeLink(params.token, postId, platform, check.url);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(await loadDeliverView(params.token));
}
