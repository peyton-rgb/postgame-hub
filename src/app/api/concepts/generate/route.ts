// ============================================================
// POST /api/concepts/generate
// Triggers the Creative Director agent to generate 3-5 concepts
// for a published brief.
//
// Body:
//   {
//     brief_id: string (required),
//     athlete_name?: string,
//     reference_image_urls?: string[],
//     creative_seeds?: { name: string, description: string }[]
//   }
//
// Returns: { concepts: Concept[] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { generateConcepts } from '@/lib/agents/creative-director';
import type { CreativeSeed } from '@/lib/types/briefs';

export const runtime = 'nodejs';
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const {
    brief_id,
    athlete_name,
    reference_image_urls,
    creative_seeds,
  } = body as {
    brief_id?: string;
    athlete_name?: string;
    reference_image_urls?: string[];
    creative_seeds?: CreativeSeed[];
  };

  if (!brief_id) {
    return NextResponse.json(
      { error: 'brief_id is required' },
      { status: 400 }
    );
  }

  try {
    const concepts = await generateConcepts(brief_id, user.id, {
      athleteName: athlete_name,
      referenceImageUrls: Array.isArray(reference_image_urls) ? reference_image_urls : undefined,
      creativeSeeds: Array.isArray(creative_seeds) ? creative_seeds : undefined,
    });
    return NextResponse.json({ concepts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Concept generation failed';
    console.error('Concept generation error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
