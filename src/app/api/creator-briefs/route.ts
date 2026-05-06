// ============================================================
// GET /api/creator-briefs — List creator briefs
//
// Query params:
//   ?concept_id=xxx — filter by concept
//   ?brief_id=xxx — filter by campaign brief
//   ?status=published — filter by status
// ============================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conceptId = searchParams.get('concept_id');
  const briefId = searchParams.get('brief_id');
  const status = searchParams.get('status');

  let query = supabase
    .from('creator_briefs')
    .select('id, concept_id, brief_id, brand_id, slug, title, athlete_name, status, brand_color, published_at, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (conceptId) query = query.eq('concept_id', conceptId);
  if (briefId) query = query.eq('brief_id', briefId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
