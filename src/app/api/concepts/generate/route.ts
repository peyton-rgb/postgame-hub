// ============================================================
// POST /api/concepts/generate
// Triggers the Creative Director agent to generate 3-5 concepts
// for a published brief.
//
// Body: { brief_id: string }
// Returns: { concepts: Concept[] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { generateConcepts } from '@/lib/agents/creative-director';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { brief_id } = body;

  if (!brief_id) {
    return NextResponse.json(
      { error: 'brief_id is required' },
      { status: 400 }
    );
  }

  try {
    const concepts = await generateConcepts(brief_id, user.id);
    return NextResponse.json({ concepts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Concept generation failed';
    console.error('Concept generation error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
