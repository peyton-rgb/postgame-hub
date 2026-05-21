// ============================================================
// POST /api/concepts/[id]/iterate
// Re-runs the Creative Director with feedback on a specific concept.
// Body: { feedback: string }
//
// What happens:
//   1. The existing concept is archived
//   2. The Creative Director generates new concepts using the feedback
//   3. New concepts replace the archived one
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { generateConcepts } from '@/lib/agents/creative-director';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { feedback } = body;

  if (!feedback) {
    return NextResponse.json(
      { error: 'Iteration feedback is required — tell the Creative Director what to change.' },
      { status: 400 }
    );
  }

  // Fetch the concept to get its brief_id
  const { data: concept, error: fetchError } = await supabase
    .from('concepts')
    .select('id, brief_id, iteration_history')
    .eq('id', params.id)
    .single();

  if (fetchError || !concept) {
    return NextResponse.json({ error: 'Concept not found' }, { status: 404 });
  }

  // Archive the current concept
  const currentHistory = (concept.iteration_history as unknown[]) || [];
  await supabase
    .from('concepts')
    .update({
      status: 'archived',
      iteration_history: [
        ...currentHistory,
        { prompt: feedback, response: 'regenerating', timestamp: new Date().toISOString() },
      ],
    })
    .eq('id', params.id);

  // Re-run the Creative Director with the iteration feedback
  try {
    const newConcepts = await generateConcepts(
      concept.brief_id,
      user.id,
      feedback
    );

    return NextResponse.json({ concepts: newConcepts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Iteration failed';
    console.error('Concept iteration error:', err);

    // Restore the original concept status if iteration fails
    await supabase
      .from('concepts')
      .update({ status: 'iterating' })
      .eq('id', params.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
