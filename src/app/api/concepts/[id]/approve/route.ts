// ============================================================
// POST /api/concepts/[id]/approve
// Approves a concept — moves it to status=approved.
// If this is the first approved concept for its parent brief,
// the brief's status changes to in_production.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Fetch the concept
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

  // Update the concept status
  const { data: updatedConcept, error: updateError } = await supabase
    .from('concepts')
    .update({ status: 'approved' })
    .eq('id', params.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Check if the parent brief should move to in_production
  // (it should if this is the first approved concept)
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
