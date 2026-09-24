// ============================================================
// POST /api/deliver/[token]/posted — Athlete sends the link to one post
//
// Public endpoint — no auth. Body: { postId, live_url }.
//
//   • postId names WHICH of the athlete's posts went live. It is a package
//     id, not a token, and loadPackageState only resolves ids that share the
//     token's (posting_campaign_id, athlete_key) — so a token can never mark
//     another athlete's post as posted. Anything else is a 404.
//   • Only Instagram or TikTok links (vm.tiktok.com short links included) —
//     see checkLiveUrl in src/lib/post-link.ts. Anything else is a 400 with a
//     message the page shows as-is.
//   • Idempotent: once live_url is set it is never overwritten. A second
//     submit returns the existing view unchanged; corrections go through staff.
//   • Writes live_url, posted_at and status = 'posted' on THAT POST ONLY
//     (staff lists filter on status). The athlete's other posts are untouched.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  loadDeliverView,
  loadPackageState,
  writeAthleteFields,
} from '@/lib/deliver-package';
import { checkLiveUrl } from '@/lib/post-link';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const body = await request.json().catch(() => ({}));
  const postId = typeof body?.postId === 'string' ? body.postId : null;

  // Resolves only a post belonging to this token's athlete.
  const state = await loadPackageState(params.token, postId);
  if (!state) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  // Already have a link: return what's there, don't touch it.
  if (state.live_url) {
    return NextResponse.json(await loadDeliverView(params.token));
  }

  const check = checkLiveUrl(body?.live_url);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const result = await writeAthleteFields(params.token, postId, {
    live_url: check.url,
    posted_at: state.posted_at ?? new Date().toISOString(),
    status: 'posted',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(await loadDeliverView(params.token));
}
