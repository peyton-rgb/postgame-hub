// ============================================================
// GET /api/creator-briefs/by-slug/[slug] — PUBLIC, no auth.
// Returns a published creator brief for the public renderer.
// Drafts and archived briefs return 404.
//
// Uses the plain (anon) Supabase client — RLS allows SELECT on
// rows where status = 'published'.
// ============================================================

import { NextResponse } from 'next/server';
import { createPlainSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createPlainSupabase();

  const { data, error } = await supabase
    .from('creator_briefs')
    .select('*, brand:brands(id, name)')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
