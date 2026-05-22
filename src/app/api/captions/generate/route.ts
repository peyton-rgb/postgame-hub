// ============================================================
// POST /api/captions/generate — AI caption generation
//
// Takes asset metadata + channel + brand info and uses the
// Distributor Agent to generate 3 caption variants (short,
// medium, long) plus hashtag suggestions and FTC disclosure.
//
// Fetches Postgame voice rules from voice_settings table to
// keep every caption on-brand.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { generateCaptions } from '@/lib/agents/distributor-agent';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  if (!body.channel) {
    return NextResponse.json(
      { error: 'channel is required' },
      { status: 400 }
    );
  }

  // Fetch voice settings from Supabase
  let voiceRules: string[] = [];
  try {
    const { data: voiceData } = await supabase
      .from('voice_settings')
      .select('*');

    if (voiceData && voiceData.length > 0) {
      voiceRules = voiceData.map((v: Record<string, unknown>) => {
        const label = v.label || v.category || '';
        const rules = v.rules || v.content || v.value || '';
        return `${label}: ${rules}`;
      });
    }
  } catch {
    // Voice settings are optional — continue without them
  }

  try {
    const result = await generateCaptions({
      assetDescription: body.asset_description || '',
      channel: body.channel,
      athleteName: body.athlete_name || undefined,
      brandName: body.brand_name || undefined,
      campaignName: body.campaign_name || undefined,
      tone: body.tone || undefined,
      voiceRules,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Caption generation failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Caption generation failed' },
      { status: 500 }
    );
  }
}
