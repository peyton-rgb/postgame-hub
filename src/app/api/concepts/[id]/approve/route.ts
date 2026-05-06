// ============================================================
// POST /api/concepts/[id]/approve
// Approves a concept — moves it to status=approved.
// If the parent brief is published and this is the first approval,
// the brief's status flips to in_production.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: concept, error: fetchError } = await supabase
    .from('concepts')
    .select('id, brief_id, status')
    .eq('id', params.id)
    .single();

  if (fetchError || !concept) {
    return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
  }

  if (concept.status === 'approved') {
    return NextResponse.json({ error: 'Concept is already approved' }, { status: 400 });
  }

  const { data: updatedConcept, error: updateError } = await supabase
    .from('concepts')
    .update({ status: 'approved' })
    .eq('id', params.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const { data: brief } = await supabase
    .from('campaign_briefs')
    .select('id, status')
    .eq('id', concept.brief_id)
    .single();

  if (brief && brief.status === 'published') {
    await supabase
      .from('campaign_briefs')
      .update({ status: 'in_production' })
      .eq('id', brief.id);
  }

  return NextResponse.json(updatedConcept);
}
