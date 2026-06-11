// ============================================================
// Distributor Agent — Station 4 AI Agent
//
// The Distributor Agent handles the caption and posting pipeline.
// It generates platform-native captions in Postgame's voice,
// suggests hashtags, writes FTC disclosures, and assembles
// complete posting packages for athletes.
//
// Functions:
//   1. generateCaptions  — 3 variants (short/medium/long) per channel
//   2. generateHashtags  — platform-aware hashtag suggestions
//   3. generateFtcNote   — FTC-compliant disclosure copy
//   4. generatePostingPackage — full bundle for athlete delivery
//   5. checkNcaaCompliance — flags NCAA-restricted terms
//
// Uses Postgame's voice_settings from Supabase to keep all
// output on-brand. Respects channel-specific character limits
// and content norms.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// --- NCAA restricted terms ---
// The NCAA restricts use of these terms in NIL-related content.
// If any appear in captions, the agent flags them for review.
const NCAA_RESTRICTED_TERMS = [
  'March Madness',
  'Final Four',
  'Elite Eight',
  'Sweet Sixteen',
  'Sweet 16',
  'College World Series',
  'College Cup',
  'Frozen Four',
  'College Football Playoff',
  'CFP',
  'Big Ten',
  'Big 12',
  'SEC Championship',
  'ACC Championship',
  'Pac-12',
  'Big East',
  'Mountain West',
  'American Athletic',
  'Sun Belt',
  'Conference USA',
  'Mid-American',
  'MAC Championship',
  'Bowl Championship',
  'BCS',
  'NCAA Tournament',
  'NCAA Championship',
  'The Big Dance',
  'Selection Sunday',
  'Bracketology',
  'NIT',
];

// --- Channel-specific constraints ---
const CHANNEL_CONFIG: Record<string, { maxLength: number; hashtagLimit: number; notes: string }> = {
  instagram: {
    maxLength: 2200,
    hashtagLimit: 30,
    notes: 'Instagram favors storytelling captions. First line is the hook. Use line breaks for readability. Hashtags go at the end or in a comment.',
  },
  tiktok: {
    maxLength: 4000,
    hashtagLimit: 5,
    notes: 'TikTok captions should be punchy and short. Use trending language. Hashtags are part of discoverability — keep them relevant, not spammy.',
  },
  linkedin: {
    maxLength: 3000,
    hashtagLimit: 5,
    notes: 'LinkedIn is professional. Lead with a bold statement or stat. Use line breaks. Hashtags should be industry-relevant.',
  },
  youtube: {
    maxLength: 5000,
    hashtagLimit: 15,
    notes: 'YouTube descriptions should front-load key info. Include timestamps if relevant. Hashtags go above the fold.',
  },
  'twitter/x': {
    maxLength: 280,
    hashtagLimit: 3,
    notes: 'Twitter/X is ultra-concise. Every word counts. One or two hashtags max for engagement.',
  },
  twitter: {
    maxLength: 280,
    hashtagLimit: 3,
    notes: 'Twitter/X is ultra-concise. Every word counts. One or two hashtags max for engagement.',
  },
  newsletter: {
    maxLength: 10000,
    hashtagLimit: 0,
    notes: 'Newsletter copy is conversational and informative. No hashtags. Write like you are talking to a friend who loves sports.',
  },
};

// --- Types ---

export interface CaptionGenerationParams {
  assetDescription: string;
  channel: string;
  athleteName?: string;
  brandName?: string;
  campaignName?: string;
  tone?: string;
  voiceRules?: string[];
}

export interface CaptionResult {
  captions: {
    short: string;
    medium: string;
    long: string;
  };
  hashtags: string[];
  ftc_note: string;
}

export interface HashtagParams {
  brandName?: string;
  campaignName?: string;
  athleteName?: string;
  sport?: string;
  channel: string;
  context?: string;
}

export interface PostingPackageParams {
  assetDescription: string;
  channel: string;
  athleteName: string;
  brandName?: string;
  campaignName?: string;
  sport?: string;
  tone?: string;
  voiceRules?: string[];
  postingWindowDays?: number;
}

export interface PostingPackageResult {
  captions: {
    short: string;
    medium: string;
    long: string;
  };
  hashtags: string[];
  mentions: string[];
  ftc_note: string;
  platform_notes: string;
  posting_window_start: string;
  posting_window_end: string;
}

export interface NcaaComplianceResult {
  isCompliant: boolean;
  flaggedTerms: string[];
  suggestions: Record<string, string>;
}

// --- System prompt builder ---

function buildDistributorSystemPrompt(voiceRules?: string[]): string {
  return `You are the Distributor for Postgame, an NIL (Name, Image, Likeness) marketing agency that creates content campaigns for college athletes and brands.

Your job: write social media captions that are authentic, athlete-first, and on-brand.

PERSONA:
- You write like a creative director who lives on social media — not a corporate marketer.
- Your tone is confident, slightly editorial, and always respectful of the athlete's story.
- You understand that NIL content lives at the intersection of brand deals and personal brand — it should never feel like a forced ad.
- You write for Postgame's "Elevated BTS" style: polished, intentional behind-the-scenes content that looks premium but feels real.

POSTGAME VOICE:
- Confident but not cocky
- Authentic — never try-hard or cringe
- Athlete-first — the athlete is the hero, never the brand
- Visual language — write captions that complement what people see, don't over-explain
- Platform-native — what works on TikTok does NOT work on LinkedIn
${voiceRules && voiceRules.length > 0 ? `\nBRAND VOICE RULES:\n${voiceRules.map((r) => `- ${r}`).join('\n')}\n` : ''}

NCAA COMPLIANCE:
- NEVER use NCAA-trademarked terms: "March Madness", "Final Four", "Elite Eight", "Sweet Sixteen", "College World Series", etc.
- NEVER reference specific conference names unless the brand has a licensing deal.
- Use generic alternatives: "the big tournament", "championship weekend", "postseason run"
- Always include FTC disclosure for sponsored/NIL content (#ad or #partner at minimum)

CAPTION RULES:
- Short captions: 1-2 sentences. Punchy. Social-first.
- Medium captions: 3-5 sentences. More context, still scannable.
- Long captions: Full story. Multiple paragraphs with line breaks. Only for Instagram and YouTube.
- ALWAYS match the platform's vibe and character limits.
- Hashtags are separate — do not embed them in the caption body.

OUTPUT FORMAT:
Always return valid JSON. No markdown code fences. No extra text.`;
}

// --- Main functions ---

/**
 * Generate 3 caption variants (short, medium, long) plus hashtags and FTC note.
 */
export async function generateCaptions(params: CaptionGenerationParams): Promise<CaptionResult> {
  const {
    assetDescription,
    channel,
    athleteName,
    brandName,
    campaignName,
    tone,
    voiceRules,
  } = params;

  const channelKey = channel.toLowerCase();
  const config = CHANNEL_CONFIG[channelKey] || CHANNEL_CONFIG.instagram;

  const systemPrompt = buildDistributorSystemPrompt(voiceRules);

  const userMessage = `Generate captions for this content:

ASSET: ${assetDescription || 'No description provided'}
CHANNEL: ${channel}
${athleteName ? `ATHLETE: ${athleteName}` : ''}
${brandName ? `BRAND: ${brandName}` : ''}
${campaignName ? `CAMPAIGN: ${campaignName}` : ''}
${tone ? `TONE: ${tone}` : ''}

CHANNEL CONSTRAINTS:
- Max caption length: ${config.maxLength} characters
- Max hashtags: ${config.hashtagLimit}
- Platform notes: ${config.notes}

Return a JSON object with this exact shape:
{
  "captions": {
    "short": "1-2 sentence caption",
    "medium": "3-5 sentence caption",
    "long": "Full story caption with line breaks"
  },
  "hashtags": ["hashtag1", "hashtag2"],
  "ftc_note": "Required FTC disclosure text"
}

${config.hashtagLimit === 0 ? 'This channel does not use hashtags — return an empty array.' : ''}
The FTC note should be a clean, compliant disclosure for NIL/sponsored content.`;

  const response = await anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content');
  }

  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText);

  // Validate the response shape
  if (!parsed.captions || !parsed.captions.short) {
    throw new Error('Invalid caption response — missing captions object');
  }

  // Run NCAA compliance check on all captions
  const allText = `${parsed.captions.short} ${parsed.captions.medium} ${parsed.captions.long}`;
  const compliance = checkNcaaCompliance(allText);

  if (!compliance.isCompliant) {
    // Auto-fix: replace flagged terms in captions
    let fixedShort = parsed.captions.short;
    let fixedMedium = parsed.captions.medium;
    let fixedLong = parsed.captions.long;

    for (const [term, replacement] of Object.entries(compliance.suggestions)) {
      const regex = new RegExp(term, 'gi');
      fixedShort = fixedShort.replace(regex, replacement);
      fixedMedium = fixedMedium.replace(regex, replacement);
      fixedLong = fixedLong.replace(regex, replacement);
    }

    parsed.captions.short = fixedShort;
    parsed.captions.medium = fixedMedium;
    parsed.captions.long = fixedLong;
  }

  return {
    captions: {
      short: parsed.captions.short || '',
      medium: parsed.captions.medium || '',
      long: parsed.captions.long || '',
    },
    hashtags: parsed.hashtags || [],
    ftc_note: parsed.ftc_note || '#ad #partner',
  };
}

/**
 * Generate platform-aware hashtag suggestions.
 */
export async function generateHashtags(params: HashtagParams): Promise<string[]> {
  const config = CHANNEL_CONFIG[params.channel.toLowerCase()] || CHANNEL_CONFIG.instagram;

  if (config.hashtagLimit === 0) return [];

  const systemPrompt = `You are a social media hashtag strategist for Postgame, an NIL marketing agency. Generate relevant, effective hashtags for college athlete content. Mix broad reach hashtags with niche ones. NEVER use NCAA-trademarked terms. Return ONLY a JSON array of strings.`;

  const userMessage = `Generate ${config.hashtagLimit} hashtags for:
${params.brandName ? `Brand: ${params.brandName}` : ''}
${params.campaignName ? `Campaign: ${params.campaignName}` : ''}
${params.athleteName ? `Athlete: ${params.athleteName}` : ''}
${params.sport ? `Sport: ${params.sport}` : ''}
Channel: ${params.channel}
${params.context ? `Context: ${params.context}` : ''}

Return a JSON array of hashtag strings (without the # symbol).`;

  const response = await anthropic.messages.create({
    model: 'claude-fable-5',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') return [];

  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const hashtags = JSON.parse(jsonText);
    if (Array.isArray(hashtags)) {
      // Strip # prefix if Claude added them, and filter NCAA terms
      return hashtags
        .map((h: string) => h.replace(/^#/, ''))
        .filter((h: string) => !NCAA_RESTRICTED_TERMS.some((term) =>
          h.toLowerCase().includes(term.toLowerCase().replace(/\s+/g, ''))
        ))
        .slice(0, config.hashtagLimit);
    }
  } catch {
    // Fall back to empty
  }

  return [];
}

/**
 * Generate a complete posting package — captions + hashtags + FTC + scheduling.
 */
export async function generatePostingPackage(params: PostingPackageParams): Promise<PostingPackageResult> {
  const {
    assetDescription,
    channel,
    athleteName,
    brandName,
    campaignName,
    sport,
    tone,
    voiceRules,
    postingWindowDays = 7,
  } = params;

  // Generate captions
  const captionResult = await generateCaptions({
    assetDescription,
    channel,
    athleteName,
    brandName,
    campaignName,
    tone,
    voiceRules,
  });

  // Generate hashtags with more context
  const hashtags = await generateHashtags({
    brandName,
    campaignName,
    athleteName,
    sport,
    channel,
    context: assetDescription,
  });

  // Build mentions array
  const mentions: string[] = [];
  if (brandName) {
    mentions.push(`@${brandName.toLowerCase().replace(/\s+/g, '')}`);
  }
  mentions.push('@postgame');

  // Calculate posting window
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() + 1); // Start tomorrow
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + postingWindowDays);

  // Build platform-specific notes
  const config = CHANNEL_CONFIG[channel.toLowerCase()] || CHANNEL_CONFIG.instagram;
  const platformNotes = buildPlatformNotes(channel, athleteName);

  return {
    captions: captionResult.captions,
    hashtags: hashtags.length > 0 ? hashtags : captionResult.hashtags,
    mentions,
    ftc_note: captionResult.ftc_note,
    platform_notes: platformNotes,
    posting_window_start: windowStart.toISOString(),
    posting_window_end: windowEnd.toISOString(),
  };
}

/**
 * Build platform-specific posting notes for athletes.
 */
function buildPlatformNotes(channel: string, athleteName?: string): string {
  const name = athleteName || 'the athlete';
  const channelKey = channel.toLowerCase();

  const notes: Record<string, string> = {
    instagram: `Post as a Reel or carousel. Tag the brand in the post (not just the caption). Add the FTC disclosure in the caption — "paid partnership" label is preferred but #ad works too. ${name} should post from their personal account.`,
    tiktok: `Post natively on TikTok (not a repost from Instagram). Use trending sounds if possible. FTC disclosure must be visible — use the "paid partnership" toggle or add #ad to caption. Pin the brand's comment if they leave one.`,
    linkedin: `Share as a personal post, not from a company page. Write in first person. Tag the brand's LinkedIn page. Professional but authentic tone. ${name} should engage with comments for the first hour.`,
    youtube: `Upload as a YouTube Short or standard video. Add the brand tag in the description. Enable the "includes paid promotion" checkbox. Thumbnail should feature ${name}.`,
    'twitter/x': `Tweet natively. No threads unless the content warrants it. Quote tweet the brand if they post about the campaign. #ad in the tweet body.`,
    twitter: `Tweet natively. No threads unless the content warrants it. Quote tweet the brand if they post about the campaign. #ad in the tweet body.`,
    newsletter: `Include in the next newsletter edition. Feature the content with a brief personal note from ${name}. Disclosure should be clear at the top of the sponsored section.`,
  };

  return notes[channelKey] || `Post on ${channel}. Include FTC disclosure. Tag the brand.`;
}

/**
 * Check text for NCAA-restricted terms and suggest replacements.
 */
export function checkNcaaCompliance(text: string): NcaaComplianceResult {
  const flaggedTerms: string[] = [];
  const suggestions: Record<string, string> = {};

  // Replacement map for common restricted terms
  const replacements: Record<string, string> = {
    'March Madness': 'the big tournament',
    'Final Four': 'the national semifinals',
    'Elite Eight': 'the quarterfinals',
    'Sweet Sixteen': 'the round of 16',
    'Sweet 16': 'the round of 16',
    'College World Series': 'the college baseball championship',
    'College Cup': 'the college soccer championship',
    'Frozen Four': 'the hockey semifinals',
    'College Football Playoff': 'the postseason',
    'NCAA Tournament': 'the national tournament',
    'NCAA Championship': 'the national championship',
    'The Big Dance': 'tournament time',
    'Selection Sunday': 'bracket day',
    'Bracketology': 'tournament predictions',
  };

  for (const term of NCAA_RESTRICTED_TERMS) {
    const regex = new RegExp(term, 'gi');
    if (regex.test(text)) {
      flaggedTerms.push(term);
      if (replacements[term]) {
        suggestions[term] = replacements[term];
      }
    }
  }

  return {
    isCompliant: flaggedTerms.length === 0,
    flaggedTerms,
    suggestions,
  };
}
