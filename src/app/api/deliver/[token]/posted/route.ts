// ============================================================
// POST /api/deliver/[token]/posted — LEGACY: the Instagram link only
//
// Kept so a page loaded before this deploy still works. Body:
// { postId, live_url }. It now does exactly what
// POST …/link with platform 'instagram' does: saves the Instagram link (and
// live_url), never overwrites, then runs maybeMarkPosted().
//
// It no longer marks the post Posted by itself. Since migration 075 a post is
// Posted — the payment trigger — only when the Instagram, TikTok and X links
// and the Story screenshot are all in.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { loadDeliverView, loadPackageState, writeLink } from '@/lib/deliver-package';
import { checkPlatformLink } from '@/lib/post-link';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await request.json().catch(() => ({}));
  const postId = typeof body?.postId === 'string' ? body.postId : null;

  const state = await loadPackageState(params.token, postId);
  if (!state) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }
  // Already have it: return what's there, as this route always has.
  if (state.live_url) {
    return NextResponse.json(await loadDeliverView(params.token));
  }

  const check = checkPlatformLink('instagram', body?.live_url);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }
  const result = await writeLink(params.token, postId, 'instagram', check.url);
  if (!result.ok && result.status !== 409) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(await loadDeliverView(params.token));
}
