// ============================================================
// DEPRECATED — Use /api/creator-briefs/public/[slug] instead.
// This route redirects to the canonical public endpoint.
// ============================================================

import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const url = new URL(request.url);
  const canonical = `${url.origin}/api/creator-briefs/public/${params.slug}`;
  return NextResponse.redirect(canonical, 308);
}
