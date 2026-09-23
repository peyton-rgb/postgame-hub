// ============================================================
// POST /api/deliver/[token]/posted — Athlete sends the link to their post
//
// Public endpoint — no auth. A posted link is what starts the athlete's
// payment, so this is strict:
//
//   • Only Instagram or TikTok links (vm.tiktok.com short links included) —
//     see checkLiveUrl in src/lib/post-link.ts. Anything else is a 400 with a
//     message the page shows as-is.
//   • Idempotent: once live_url is set it is never overwritten. A second
//     submit returns the existing view unchanged; corrections go through staff.
//   • Writes live_url, posted_at and status = 'posted' (staff lists filter on
//     status), re-matched on the token server-side; no id comes from the
//     browser.
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
  const state = await loadPackageState(params.token);
  if (!state) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }

  // Already have a link: return what's there, don't touch it.
  if (state.live_url) {
    return NextResponse.json(await loadDeliverView(params.token));
  }

  const body = await request.json().catch(() => ({}));
  const check = checkLiveUrl(body?.live_url);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const result = await writeAthleteFields(params.token, {
    live_url: check.url,
    posted_at: state.posted_at ?? new Date().toISOString(),
    status: 'posted',
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(await loadDeliverView(params.token));
}
