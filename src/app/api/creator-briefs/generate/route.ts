// ============================================================
// POST /api/creator-briefs/generate
// Runs the Brief Writer agent for an approved concept and saves
// the result as a draft creator_briefs row.
//
// Body: { concept_id: string }
// Returns: { creatorBrief: CreatorBrief }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { generateBriefSections } from '@/lib/agents/brief-writer';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Lowercase, trim, collapse non-alphanum to hyphens, strip leading/trailing.
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Short random suffix so slugs stay unique even when names collide.
function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { concept_id } = body as { concept_id?: string };

  if (!concept_id) {
    return NextResponse.json({ error: 'concept_id is required' }, { status: 400 });
  }

  try {
    const result = await generateBriefSections(concept_id, user.id);
    const { sections, concept, campaignBrief, brand } = result;

    // Build slug: {brand}-{concept}-{shortid}
    const brandSlug = slugify((brand.name as string) || 'brand');
    const conceptSlug = slugify((concept.name as string) || 'concept');
    const slug = `${brandSlug}-${conceptSlug}-${shortId()}`.replace(/^-+/, '');

    // Brand color falls back to Postgame orange if the brand row doesn't set one.
    const brandColor = (brand.primary_color as string) || '#D73F09';
    const brandLogo = (brand.logo_primary_url as string) || null;

    const refImages = ((concept.reference_image_urls as string[]) || []).map((url) => ({ url }));

    const { data: creatorBrief, error: insertError } = await supabase
      .from('creator_briefs')
      .insert({
        concept_id: concept.id,
        brief_id: campaignBrief.id,
        brand_id: brand.id,
        slug,
        title: `${campaignBrief.name} — ${concept.name}`,
        athlete_name: (concept.athlete_name as string | null) || null,
        sections,
        reference_images: refImages,
        brand_color: brandColor,
        brand_logo_url: brandLogo,
        status: 'draft',
        created_by: user.id,
      })
      .select('*, brand:brands(id, name), campaign_brief:campaign_briefs(id, name)')
      .single();

    if (insertError || !creatorBrief) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to save creator brief' },
        { status: 500 }
      );
    }

    return NextResponse.json({ creatorBrief });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Brief generation failed';
    console.error('Creator brief generation error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
