// ============================================================
// Content Strategist Agent
//
// AI agent that analyzes Postgame's existing content pipeline
// (briefs, assets, athletes, brands) and generates platform-
// specific content suggestions for 5 social channels.
//
// Each platform has a distinct role:
//   - Instagram: Best visual content — polished, portfolio-grade
//   - TikTok: Up-close, personal BTS raw footage for fans
//   - LinkedIn: Display of work + written case studies
//   - YouTube: Longform + Shorts for a full view of Postgame
//   - Twitter/X: Real-time updates and quick takes
//
// Functions:
//   1. generatePlatformStrategy — Overall strategy per platform
//   2. generateWeeklyCalendar  — 7-day content plan per platform
//   3. generateOnDemand        — Fresh suggestions on button click
//   4. analyzeContentGaps      — What's missing from current output
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Use Haiku for speed — suggestions don't need the full power of Sonnet,
// and Vercel serverless functions have tight time limits.
const MODEL = 'claude-haiku-4-5-20251001';

// --- Platform definitions ---
// These encode Postgame's specific strategy for each platform.

export const PLATFORM_STRATEGY: Record<string, {
  key: string;
  label: string;
  role: string;
  icon: string;
  color: string;
  contentPillars: string[];
  postingCadence: string;
  bestTimes: string;
  contentMix: { type: string; percentage: number; description: string }[];
}> = {
  instagram: {
    key: 'instagram',
    label: 'Instagram',
    role: 'Visual portfolio — the best of what Postgame produces',
    icon: 'IG',
    color: 'bg-pink-600',
    contentPillars: [
      'Brand partnership activations (current strength)',
      'Athlete spotlight portraits (non-branded)',
      'Behind-the-scenes shoot days (elevated BTS)',
      'Campaign recap carousels',
      'Team/culture posts (Postgame as a brand)',
      'Reels showcasing the production process',
    ],
    postingCadence: '1-2 posts per day, Stories 3-5x daily',
    bestTimes: '11am-1pm and 7pm-9pm EST',
    contentMix: [
      { type: 'Brand Activations', percentage: 50, description: 'Polished athlete + brand content (what you do now)' },
      { type: 'Athlete Spotlights', percentage: 15, description: 'Non-branded athlete portraits and features — shows you care about the athletes, not just the deals' },
      { type: 'Elevated BTS', percentage: 15, description: 'Behind-the-scenes shoot day content, production process, team at work' },
      { type: 'Campaign Recaps', percentage: 10, description: 'Carousel-style recaps of completed campaigns with multiple athletes' },
      { type: 'Postgame Culture', percentage: 10, description: 'Team highlights, office/set vibes, milestones, hiring, industry events' },
    ],
  },
  tiktok: {
    key: 'tiktok',
    label: 'TikTok',
    role: 'Up-close, personal BTS raw footage that connects with fans',
    icon: 'TT',
    color: 'bg-gray-800',
    contentPillars: [
      'Raw BTS from shoot days',
      'Athlete personality moments',
      'Day-in-the-life at Postgame',
      'Trending audio/format adaptations',
      'Quick tips: NIL industry insights',
      'Before/after production reveals',
    ],
    postingCadence: '1-2 posts per day',
    bestTimes: '10am-12pm and 7pm-10pm EST',
    contentMix: [
      { type: 'Raw BTS', percentage: 35, description: 'Unpolished, authentic behind-the-scenes from shoot days — the stuff that feels real' },
      { type: 'Athlete Personality', percentage: 25, description: 'Athletes being themselves — funny moments, reactions, outtakes' },
      { type: 'Trending Formats', percentage: 15, description: 'Adapt trending audios/formats to NIL and sports marketing context' },
      { type: 'Production Reveals', percentage: 15, description: 'Before/after, gear setups, editing process — satisfy the "how did they make that" curiosity' },
      { type: 'NIL Quick Takes', percentage: 10, description: 'Short educational/opinion content about the NIL industry' },
    ],
  },
  linkedin: {
    key: 'linkedin',
    label: 'LinkedIn',
    role: 'Professional showcase — display work + case study write-ups',
    icon: 'LI',
    color: 'bg-blue-700',
    contentPillars: [
      'Campaign case studies with results',
      'Industry thought leadership on NIL',
      'Partnership announcements',
      'Team growth and hiring updates',
      'Brand strategy breakdowns',
      'Event recaps (conferences, panels)',
    ],
    postingCadence: '3-5 posts per week',
    bestTimes: '8am-10am and 12pm-1pm EST (weekdays)',
    contentMix: [
      { type: 'Case Studies', percentage: 30, description: 'Break down a campaign: the brief, the strategy, the creative, the execution — show your thinking' },
      { type: 'Thought Leadership', percentage: 25, description: 'Hot takes and insights about the NIL industry, sports marketing trends, creator economy' },
      { type: 'Partnership Announcements', percentage: 20, description: 'New brand partnerships, new athlete signings — framed professionally' },
      { type: 'Team & Culture', percentage: 15, description: 'Hiring, team growth, behind-the-business updates, employee spotlights' },
      { type: 'Event Coverage', percentage: 10, description: 'Conferences, panels, industry events Postgame attends or speaks at' },
    ],
  },
  youtube: {
    key: 'youtube',
    label: 'YouTube',
    role: 'Longform + Shorts for an all-around view of Postgame',
    icon: 'YT',
    color: 'bg-red-600',
    contentPillars: [
      'Full campaign behind-the-scenes (longform)',
      'Day-in-the-life with athletes',
      'Production tutorials and breakdowns',
      'Campaign sizzle reels (Shorts)',
      'Founder/team vlogs',
      'Industry commentary and analysis',
    ],
    postingCadence: '1-2 longform per month, 2-3 Shorts per week',
    bestTimes: '2pm-4pm EST (weekdays), 9am-11am (weekends)',
    contentMix: [
      { type: 'Campaign BTS (Long)', percentage: 30, description: '5-15 min behind-the-scenes of major campaigns — the full story from brief to delivery' },
      { type: 'Shorts (Repurposed)', percentage: 25, description: 'Repurpose TikTok/Reels content as YouTube Shorts — extend reach with minimal effort' },
      { type: 'Production Breakdowns', percentage: 15, description: 'How you light, shoot, and edit athlete content — educational and aspirational' },
      { type: 'Athlete Day-in-the-Life', percentage: 15, description: 'Follow an athlete through a shoot day — fans love this format' },
      { type: 'Vlogs & Commentary', percentage: 15, description: 'Founder perspectives, industry analysis, company updates' },
    ],
  },
  'twitter/x': {
    key: 'twitter/x',
    label: 'Twitter/X',
    role: 'Real-time updates, quick takes, and industry conversation',
    icon: 'X',
    color: 'bg-gray-700',
    contentPillars: [
      'Real-time campaign announcements',
      'Quick reactions to sports/NIL news',
      'Thread-style breakdowns',
      'Retweet/engage with athletes and brands',
      'Behind-the-scenes teasers',
      'Industry hot takes',
    ],
    postingCadence: '2-5 tweets per day',
    bestTimes: '8am-10am and 12pm-3pm EST',
    contentMix: [
      { type: 'Real-time Updates', percentage: 30, description: 'New campaigns, partnerships, milestones — be the first to share your own news' },
      { type: 'Industry Commentary', percentage: 25, description: 'React to NIL news, sports marketing trends, athlete deals — join the conversation' },
      { type: 'Teasers & Previews', percentage: 20, description: 'Quick BTS clips, sneak peeks of upcoming content — drive traffic to other platforms' },
      { type: 'Engagement Posts', percentage: 15, description: 'Polls, questions, takes that spark conversation — build community' },
      { type: 'Threads', percentage: 10, description: 'Longer breakdowns in thread format — campaign stories, industry analysis' },
    ],
  },
};

// --- Types ---

export interface ContentSuggestion {
  id: string;
  platform: string;
  contentType: string;
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  priority: 'high' | 'medium' | 'low';
  suggestedDate?: string;
  relatedBriefId?: string;
  relatedAthlete?: string;
  relatedBrand?: string;
  assetNotes: string;
  reasoning: string;
}

export interface WeeklyCalendar {
  platform: string;
  week: { day: string; date: string; suggestions: ContentSuggestion[] }[];
}

export interface ContentGap {
  platform: string;
  gap: string;
  impact: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
}

export interface StrategyAnalysis {
  platform: string;
  currentStrength: string;
  gaps: ContentGap[];
  quickWins: string[];
  weeklyCalendar: WeeklyCalendar;
  suggestions: ContentSuggestion[];
}

// --- Context gathering ---

interface HubContext {
  recentBriefs: Array<{ id: string; brand_name: string; athlete_name: string; campaign_type: string; status: string; sport: string }>;
  upcomingContent: Array<{ channel: string; athlete_name: string; caption: string; scheduled_for: string }>;
  recentAssets: Array<{ type: string; athlete_name: string; brand: string }>;
  activeBrands: string[];
  activeAthletes: string[];
  highProfileAthletes: string[];
  highProfileBrands: string[];
}

// --- Main generation functions ---

/**
 * generateOnDemandSuggestions
 *
 * Called when the user clicks "Suggest Content" — generates fresh
 * post ideas for one or all platforms based on current Hub data.
 */
export async function generateOnDemandSuggestions(
  platform: string | 'all',
  hubContext: HubContext,
  count: number = 5,
): Promise<ContentSuggestion[]> {
  const platforms = platform === 'all'
    ? Object.keys(PLATFORM_STRATEGY)
    : [platform];

  const contextSummary = buildContextSummary(hubContext);

  const prompt = `You are Postgame's Content Strategist AI. Postgame is the #1 NIL (Name, Image & Likeness) sports marketing agency, managing campaigns for 65,000+ college athletes reaching 200M+ fans.

CURRENT HUB DATA:
${contextSummary}

PLATFORM STRATEGIES:
${platforms.map(p => {
  const s = PLATFORM_STRATEGY[p];
  return `
${s.label} — ${s.role}
Content pillars: ${s.contentPillars.join(', ')}
Posting cadence: ${s.postingCadence}
Content mix: ${s.contentMix.map(m => `${m.type} (${m.percentage}%): ${m.description}`).join('\n')}
`;
}).join('\n---\n')}

INSTAGRAM CAPTION ANALYSIS:
Currently, every Instagram post follows an identical template:
- Title: "Postgame Sports Marketing | [Brand] | NIL"
- Body: [School] [position] @athlete [action phrase] with @brand
- CTA: "Brands looking to partner with college athletes - start by following @postgame.official"
- Hashtags: #nil #sportsmarketing #nilmarketing + brand-specific

This means 100% of Instagram content is brand partnership activations with zero variety. The captions are formulaic and the feed has no personality, storytelling, or non-sponsored content.

IMPORTANT RULES:
- Suggestions should reference REAL athletes and brands from the Hub data when possible
- High-profile athletes and brands should get priority placement
- Each suggestion must include a specific, ready-to-use caption draft
- Vary the caption style — NOT every post should follow the same template
- Include at least some non-branded content suggestions (athlete spotlights, BTS, culture posts)
- For Twitter/X: account is brand new, suggest foundational content to build the brand presence

Generate ${count} content suggestions ${platform === 'all' ? 'spread across all platforms' : `for ${PLATFORM_STRATEGY[platform]?.label || platform}`}. For each suggestion, provide:
1. platform (instagram, tiktok, linkedin, youtube, twitter/x)
2. contentType (from the platform's content mix categories)
3. title (short internal name)
4. description (what this post is about, 1-2 sentences)
5. caption (complete, ready-to-post caption with appropriate tone for the platform)
6. hashtags (array of tags without # symbol)
7. priority (high/medium/low — high = timely or high-profile)
8. relatedAthlete (if applicable)
9. relatedBrand (if applicable)
10. assetNotes (what photo/video is needed)
11. reasoning (why this is a good post right now)

Return ONLY valid JSON array of objects. No markdown code fences.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const suggestions = JSON.parse(text.trim());
    return suggestions.map((s: Record<string, unknown>, i: number) => ({
      id: `suggestion-${Date.now()}-${i}`,
      platform: s.platform || platform,
      contentType: s.contentType || 'general',
      title: s.title || 'Untitled Suggestion',
      description: s.description || '',
      caption: s.caption || '',
      hashtags: Array.isArray(s.hashtags) ? s.hashtags : [],
      priority: s.priority || 'medium',
      suggestedDate: s.suggestedDate,
      relatedBriefId: s.relatedBriefId,
      relatedAthlete: s.relatedAthlete,
      relatedBrand: s.relatedBrand,
      assetNotes: s.assetNotes || '',
      reasoning: s.reasoning || '',
    }));
  } catch {
    console.error('Failed to parse content suggestions:', text.slice(0, 200));
    return [];
  }
}

/**
 * generateWeeklyCalendar
 *
 * Creates a 7-day content plan for a specific platform.
 */
export async function generateWeeklyCalendar(
  platform: string,
  hubContext: HubContext,
  startDate?: string,
): Promise<WeeklyCalendar> {
  const start = startDate ? new Date(startDate) : new Date();
  const days: { day: string; date: string }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push({
      day: d.toLocaleDateString('en-US', { weekday: 'long' }),
      date: d.toISOString().split('T')[0],
    });
  }

  const platformConfig = PLATFORM_STRATEGY[platform];
  if (!platformConfig) {
    return { platform, week: days.map(d => ({ ...d, suggestions: [] })) };
  }

  const contextSummary = buildContextSummary(hubContext);

  const prompt = `You are Postgame's Content Strategist. Create a 7-day content calendar for ${platformConfig.label}.

PLATFORM ROLE: ${platformConfig.role}
POSTING CADENCE: ${platformConfig.postingCadence}
BEST TIMES: ${platformConfig.bestTimes}
CONTENT MIX: ${platformConfig.contentMix.map(m => `${m.type} (${m.percentage}%): ${m.description}`).join('\n')}

HUB DATA:
${contextSummary}

DAYS TO PLAN:
${days.map(d => `${d.day}, ${d.date}`).join('\n')}

For each day, suggest 1-2 posts that follow the content mix percentages over the week. Include complete captions, hashtags, and asset notes. Vary the style — don't make every caption follow the same template.

For Twitter/X: This is a brand new account. The first week should establish Postgame's presence with a mix of introduction, recent work highlights, and industry commentary.

Return JSON: { "week": [{ "day": "Monday", "date": "2026-05-25", "suggestions": [{ "contentType": "...", "title": "...", "description": "...", "caption": "...", "hashtags": ["..."], "priority": "high|medium|low", "relatedAthlete": "...", "relatedBrand": "...", "assetNotes": "...", "reasoning": "..." }] }] }

Return ONLY valid JSON. No markdown code fences.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const parsed = JSON.parse(text.trim());
    return {
      platform,
      week: parsed.week.map((day: Record<string, unknown>, dayIdx: number) => ({
        day: day.day || days[dayIdx]?.day,
        date: day.date || days[dayIdx]?.date,
        suggestions: (Array.isArray(day.suggestions) ? day.suggestions : []).map(
          (s: Record<string, unknown>, i: number) => ({
            id: `cal-${Date.now()}-${dayIdx}-${i}`,
            platform,
            contentType: s.contentType || 'general',
            title: s.title || '',
            description: s.description || '',
            caption: s.caption || '',
            hashtags: Array.isArray(s.hashtags) ? s.hashtags : [],
            priority: s.priority || 'medium',
            suggestedDate: day.date || days[dayIdx]?.date,
            relatedAthlete: s.relatedAthlete,
            relatedBrand: s.relatedBrand,
            assetNotes: s.assetNotes || '',
            reasoning: s.reasoning || '',
          }),
        ),
      })),
    };
  } catch {
    console.error('Failed to parse weekly calendar:', text.slice(0, 200));
    return { platform, week: days.map(d => ({ ...d, suggestions: [] })) };
  }
}

/**
 * analyzeContentGaps
 *
 * Looks at what Postgame is currently posting vs. what the strategy
 * says they should be posting, and identifies gaps.
 */
export async function analyzeContentGaps(
  hubContext: HubContext,
): Promise<ContentGap[]> {
  const contextSummary = buildContextSummary(hubContext);

  const prompt = `You are Postgame's Content Strategist. Analyze the current content output and identify gaps.

CURRENT STATE:
${contextSummary}

KNOWN ISSUES:
1. Instagram is 100% brand activation posts with identical caption templates — zero non-branded content, no variety in voice
2. TikTok purpose is raw BTS but unknown current state
3. LinkedIn purpose is work showcase + write-ups but unknown current cadence
4. YouTube has a channel but minimal content
5. Twitter/X account exists but has never been used

PLATFORM STRATEGIES:
${Object.values(PLATFORM_STRATEGY).map(s => `${s.label}: ${s.role}\nContent pillars: ${s.contentPillars.join(', ')}`).join('\n\n')}

Identify the top content gaps across all platforms. For each gap:
1. platform — which platform
2. gap — what's missing (specific)
3. impact — why this matters for growth/engagement
4. suggestion — specific action to fill this gap
5. priority — high/medium/low

Return ONLY a valid JSON array. No markdown code fences.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    return JSON.parse(text.trim());
  } catch {
    console.error('Failed to parse content gaps:', text.slice(0, 200));
    return [];
  }
}

// --- Helpers ---

function buildContextSummary(ctx: HubContext): string {
  const parts: string[] = [];

  if (ctx.highProfileAthletes.length > 0) {
    parts.push(`HIGH-PROFILE ATHLETES: ${ctx.highProfileAthletes.join(', ')}`);
  }
  if (ctx.highProfileBrands.length > 0) {
    parts.push(`HIGH-PROFILE BRANDS: ${ctx.highProfileBrands.join(', ')}`);
  }
  if (ctx.activeBrands.length > 0) {
    parts.push(`ACTIVE BRANDS: ${ctx.activeBrands.join(', ')}`);
  }
  if (ctx.activeAthletes.length > 0) {
    parts.push(`ACTIVE ATHLETES: ${ctx.activeAthletes.join(', ')}`);
  }
  if (ctx.recentBriefs.length > 0) {
    parts.push(`RECENT BRIEFS:\n${ctx.recentBriefs.map(b =>
      `- ${b.brand_name} x ${b.athlete_name} (${b.campaign_type}, ${b.status}, ${b.sport})`
    ).join('\n')}`);
  }
  if (ctx.upcomingContent.length > 0) {
    parts.push(`ALREADY SCHEDULED:\n${ctx.upcomingContent.map(c =>
      `- ${c.channel}: ${c.athlete_name} — ${(c.caption || '').slice(0, 60)}... (${c.scheduled_for})`
    ).join('\n')}`);
  }

  return parts.length > 0 ? parts.join('\n\n') : 'No Hub data currently available — generate general strategy suggestions.';
}
