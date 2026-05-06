// ============================================================
// GET /api/creator-briefs/public/[slug]
//
// Public endpoint — no auth required.
// Returns the full published creator brief by its URL slug.
// Used by the public /creator-brief/[slug] page.
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Use anon key for public access (RLS allows SELECT on published briefs)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { data, error } = await supabase
    .from('creator_briefs')
    .select('*')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Brief not found or not published' },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
