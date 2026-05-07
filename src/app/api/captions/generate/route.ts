// ============================================================
// POST /api/captions/generate
// Generate platform-specific captions using Claude AI.
//
// Body:
//   { asset_name, athlete_name, campaign_context, platforms: string[] }
//
// Returns:
//   { captions: { platform, caption_short, caption_long, hashtags, mentions }[] }
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll() {} } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { asset_name, athlete_name, campaign_context, platforms } = body;

  if (!asset_name || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json(
      { error: 'asset_name and platforms[] are required' },
      { status: 400 }
    );
  }

  // Use service role client to read voice_settings (may have RLS restrictions)
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch active voice settings for each requested platform/channel
  const { data: voiceSettings, error: vsError } = await serviceSupabase
    .from('voice_settings')
    .select('*')
    .eq('is_active', true);

  if (vsError) {
    console.error('Error fetching voice settings:', vsError);
    return NextResponse.json({ error: 'Failed to load voice settings' }, { status: 500 });
  }

  // Build a map of channel -> voice setting
  const voiceMap: Record<string, typeof voiceSettings[number]> = {};
  for (const vs of voiceSettings ?? []) {
    voiceMap[vs.channel] = vs;
  }

  const anthropic = new Anthropic();

  try {
    const captions = await Promise.all(
      platforms.map(async (platform: string) => {
        const voice = voiceMap[platform];

        const systemPrompt = voice?.system_prompt
          ? voice.system_prompt
          : `You are a social media caption writer for a sports content agency called Postgame. Write engaging captions for ${platform}.`;

        const toneNotes = voice?.tone_notes ? `\nTone notes: ${voice.tone_notes}` : '';
        const exampleCaptions = voice?.example_captions?.length
          ? `\nExample captions for reference:\n${voice.example_captions.map((c: string) => `- ${c}`).join('\n')}`
          : '';
        const forbiddenPhrases = voice?.forbidden_phrases?.length
          ? `\nNever use these phrases: ${voice.forbidden_phrases.join(', ')}`
          : '';

        const userPrompt = `Generate captions for the following content to be posted on ${platform}.

Asset: ${asset_name}
${athlete_name ? `Athlete: ${athlete_name}` : ''}
${campaign_context ? `Campaign context: ${campaign_context}` : ''}
${toneNotes}${exampleCaptions}${forbiddenPhrases}

Return a JSON object with exactly these fields:
{
  "caption_short": "A short punchy caption (under 100 characters)",
  "caption_long": "A longer detailed caption (150-300 characters)",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "mentions": ["@mention1", "@mention2", ...]
}

Return ONLY valid JSON, no markdown fences or extra text.`;

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const textBlock = message.content.find(
          (block) => block.type === 'text'
        );
        const raw = textBlock?.type === 'text' ? textBlock.text : '{}';
        const parsed = JSON.parse(raw);

        return {
          platform,
          caption_short: parsed.caption_short ?? '',
          caption_long: parsed.caption_long ?? '',
          hashtags: parsed.hashtags ?? [],
          mentions: parsed.mentions ?? [],
        };
      })
    );

    return NextResponse.json({ captions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Caption generation failed';
    console.error('Caption generation error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
