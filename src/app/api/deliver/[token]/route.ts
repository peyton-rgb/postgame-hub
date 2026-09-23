// ============================================================
// GET /api/deliver/[token] — Public posting-instructions lookup
//
// No auth required. Athletes receive a link with their unique
// token and can view their posting instructions without logging in.
//
// Service-role, token-scoped (see src/lib/deliver-package.ts): one row by
// exact token match, returned as a curated view — athlete, post, files,
// caption, campaign, logos, link, status. Never am_notes, the token, or any
// internal id. Does not depend on any anon RLS policy on posting_packages.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { loadDeliverView } from '@/lib/deliver-package';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  const view = await loadDeliverView(params.token);
  if (!view) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  }
  return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } });
}
