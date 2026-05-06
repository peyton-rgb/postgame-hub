// ============================================================
// POST /api/creator-briefs/generate
//
// Takes an approved concept_id, calls the Brief Writer agent,
// and saves a new creator_briefs row with AI-generated sections.
//
// Body: { concept_id: string }
// Returns: the created creator brief record
// ============================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { generateCreatorBrief } from '@/lib/agents/brief-writer';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { concept_id } = body;

  if (!concept_id) {
    return NextResponse.json({ error: 'concept_id is required' }, { status: 400 });
  }

  try {
    const creatorBrief = await generateCreatorBrief(concept_id, user.id);
    return NextResponse.json(creatorBrief);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Brief generation failed';
    console.error('Creator brief generation error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
