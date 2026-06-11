// ============================================================
// POST /api/captions/generate — AI caption generation
//
// Takes asset metadata + channel + brand info and uses the
// Distributor Agent to generate 3 caption variants (short,
// medium, long) plus hashtag suggestions and FTC disclosure.
//
// Two callers, two request/response shapes — this route adapts
// between them:
//   - Composer (/dashboard/composer): POSTs { channel,
//     template_type, assets[], athlete_name, ftc_required } and
//     reads { variants: [{ text, hashtags }], ftc_note }.
//   - Captions page (/dashboard/captions): POSTs
//     { asset_description, brand_name, tone, ... } and reads the
//     legacy { captions: {short,medium,long}, hashtags, ftc_note }.
// The response is a superset so both callers keep working.
//
// Fetches Postgame voice rules from voice_settings table to
// keep every caption on-brand.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { generateCaptions, checkNcaaCompliance } from '@/lib/agents/distributor-agent';

// Composer asset shape (built client-side in composer/page.tsx).
interface ComposerAsset {
  content_type?: string;
  description?: string | null;
  sport?: string | null;
  athlete?: string | null;
  vibes?: string[] | null;
}

// Safe replacements for restricted terms that checkNcaaCompliance flags but
// doesn't supply a suggestion for (conference names, playoff abbreviations).
// Guarantees we can scrub every flagged term, not just the 14 with built-in
// suggestions.
const NCAA_FALLBACK_REPLACEMENTS: Record<string, string> = {
  CFP: 'the playoff',
  'Big Ten': 'the conference',
  'Big 12': 'the conference',
  'SEC Championship': 'the conference championship',
  'ACC Championship': 'the conference championship',
  'Pac-12': 'the conference',
  'Big East': 'the conference',
  'Mountain West': 'the conference',
  'American Athletic': 'the conference',
  'Sun Belt': 'the conference',
  'Conference USA': 'the conference',
  'Mid-American': 'the conference',
  'MAC Championship': 'the conference championship',
  'Bowl Championship': 'the postseason',
  BCS: 'the postseason',
  NIT: 'the postseason tournament',
};

// Build a readable context string from the composer's structured assets.
function buildAssetDescription(assets: ComposerAsset[]): string {
  return assets
    .map((a) => {
      const parts: string[] = [];
      if (a.description) parts.push(String(a.description));
      if (a.sport) parts.push(`Sport: ${a.sport}`);
      if (a.athlete) parts.push(`Athlete: ${a.athlete}`);
      if (Array.isArray(a.vibes) && a.vibes.length) {
        parts.push(`Vibes: ${a.vibes.join(', ')}`);
      }
      return parts.join(' — ');
    })
    .filter(Boolean)
    .join('\n');
}

// Replace every NCAA-restricted term in `text` with a safe alternative.
// Loops until checkNcaaCompliance reports clean so no restricted term ships.
function scrubNcaaTerms(text: string): string {
  let out = text;
  for (let i = 0; i < 5; i++) {
    const { isCompliant, flaggedTerms, suggestions } = checkNcaaCompliance(out);
    if (isCompliant) break;
    for (const term of flaggedTerms) {
      const replacement =
        suggestions[term] || NCAA_FALLBACK_REPLACEMENTS[term] || 'the championship';
      out = out.replace(new RegExp(term, 'gi'), replacement);
    }
  }
  return out;
}

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

  // --- Build the asset description ---
  // Composer sends a structured assets[] array; the captions page sends a flat
  // asset_description string (kept for backward compatibility).
  let assetDescription = '';
  if (Array.isArray(body.assets) && body.assets.length > 0) {
    assetDescription = buildAssetDescription(body.assets as ComposerAsset[]);
  } else if (body.asset_description) {
    assetDescription = String(body.asset_description);
  }
  // Pass the composer's template type through as extra context.
  if (body.template_type) {
    assetDescription = [assetDescription, `Template: ${body.template_type}`]
      .filter(Boolean)
      .join('\n');
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
      assetDescription,
      channel: body.channel,
      athleteName: body.athlete_name || undefined,
      brandName: body.brand_name || undefined,
      campaignName: body.campaign_name || undefined,
      tone: body.tone || undefined,
      voiceRules,
    });

    const { captions, hashtags, ftc_note } = result;

    // --- Map to the composer's variant contract ---
    // Append the FTC disclosure when the composer requested it, then scrub any
    // NCAA-restricted terms so no variant ships with one.
    const variants = [captions.short, captions.medium, captions.long].map((base) => {
      let text = base;
      if (body.ftc_required) {
        text = `${text}\n\n${ftc_note}`;
      }
      text = scrubNcaaTerms(text);
      return { text, hashtags };
    });

    // Superset response: `variants` + `ftc_note` for the composer, plus the
    // legacy `captions`/`hashtags` the captions page still reads.
    return NextResponse.json({
      variants,
      ftc_note,
      captions,
      hashtags,
    });
  } catch (err) {
    console.error('Caption generation failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Caption generation failed' },
      { status: 500 }
    );
  }
}
