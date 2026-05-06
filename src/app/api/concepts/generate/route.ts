// ============================================================
// POST /api/concepts/generate
// Triggers the Creative Director agent to generate 3-5 concepts
// for a published brief.
//
// Body:
//   { brief_id: string }                          — Start Fresh mode
//   { brief_id, athlete_name, shoot_date,          — Collaborate mode
//     location, reference_image_urls,
//     creative_seeds, iteration_feedback }
//
// Returns: { concepts: Concept[], agentRunId: string }
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { generateConcepts, type CollaborateInputs } from '@/lib/agents/creative-director';

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );

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

  // Extract optional Collaborate mode inputs
  const collaborateInputs: CollaborateInputs = {
    athleteName: body.athlete_name || undefined,
    shootDate: body.shoot_date || undefined,
    location: body.location || undefined,
    referenceImageUrls: body.reference_image_urls || undefined,
    creativeSeeds: body.creative_seeds || undefined,
  };

  try {
    const concepts = await generateConcepts(
      brief_id,
      user.id,
      body.iteration_feedback,
      collaborateInputs
    );
    return NextResponse.json({ concepts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Concept generation failed';
    console.error('Concept generation error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
