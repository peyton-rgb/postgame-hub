// ============================================================
// GET /api/creator-briefs — List creator briefs.
// Filter by ?concept_id= or ?brief_id= (campaign brief id).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conceptId = searchParams.get('concept_id');
  const briefId = searchParams.get('brief_id');

  let query = supabase
    .from('creator_briefs')
    .select('*, brand:brands(id, name), campaign_brief:campaign_briefs(id, name)')
    .order('created_at', { ascending: false });

  if (conceptId) query = query.eq('concept_id', conceptId);
  if (briefId) query = query.eq('brief_id', briefId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
