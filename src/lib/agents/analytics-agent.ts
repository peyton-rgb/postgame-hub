// ============================================================
// Analytics Agent — Station 5 Performance Scorer
//
// What it does:
//   1. scorePerformance(metrics) — takes D7 data for a single
//      asset and returns a performance tier (S/A/B/C/D) with
//      rationale explaining the rating
//   2. generateInsights(metrics[]) — takes an array of metrics
//      and returns campaign-level insights text
//   3. suggestTopPerformers(metrics[]) — returns ranked list
//      of top assets to reuse or repurpose
//
// Tier definitions:
//   S = Viral (top 1%) — exceptional reach and engagement
//   A = Strong performer — above average across metrics
//   B = Solid — meets expectations, reliable content
//   C = Below average — underperformed norms
//   D = Underperformer — significantly below expectations
//
// Key signals weighted:
//   - engagement_rate: primary signal
//   - saves: high-intent signal (user wants to return)
//   - shares: virality signal (user pushing to their audience)
//   - views relative to platform norms
//   - comments: conversation signal (depth of engagement)
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// Type for metrics data passed to the agent
export interface MetricsInput {
  id: string;
  athlete_name?: string | null;
  platform?: string | null;
  live_url?: string | null;
  posted_at?: string | null;
  d7_views?: number | null;
  d7_likes?: number | null;
  d7_comments?: number | null;
  d7_shares?: number | null;
  d7_saves?: number | null;
  d7_reach?: number | null;
  d7_impressions?: number | null;
  d7_engagement_rate?: number | null;
  d30_views?: number | null;
  d30_likes?: number | null;
  d30_comments?: number | null;
  d30_shares?: number | null;
  d30_saves?: number | null;
  d30_reach?: number | null;
  d30_engagement_rate?: number | null;
  // Joined inspo_item fields
  inspo_item?: {
    content_type?: string;
    visual_description?: string | null;
    sport?: string | null;
    thumbnail_url?: string | null;
  } | null;
}

export interface ScoreResult {
  tier: 'S' | 'A' | 'B' | 'C' | 'D';
  rationale: string;
}

export interface TopPerformer {
  id: string;
  athlete_name: string | null;
  platform: string | null;
  d7_engagement_rate: number | null;
  d7_views: number | null;
  reason: string;
}

// System prompt for the scoring agent
const SCORING_SYSTEM = `You are the Analytics Agent for Postgame, an NIL marketing agency that creates content campaigns with college athletes. Your job is to evaluate content performance and assign tier ratings.

PERFORMANCE TIERS:
- S (Viral): Top 1% — exceptional metrics across the board. Engagement rate >10%, or views 10x+ above platform average, massive shares/saves ratio.
- A (Strong): Above average — solid engagement rate (5-10%), good share-to-view ratio, strong saves indicating high-intent audience.
- B (Solid): Meets expectations — engagement rate 2-5%, decent views, acceptable saves. Reliable content.
- C (Below Average): Underperformed — engagement rate 1-2%, low saves, minimal shares. Content didn't connect.
- D (Underperformer): Significantly below expectations — engagement rate <1%, very low views, near-zero shares/saves.

PLATFORM CONTEXT (typical benchmarks):
- Instagram: avg engagement rate ~3%, good = 5%+, viral = 10%+
- TikTok: avg engagement rate ~5%, good = 8%+, viral = 15%+
- YouTube Shorts: avg engagement rate ~4%, good = 7%+, viral = 12%+
- LinkedIn: avg engagement rate ~2%, good = 4%+, viral = 8%+
- Twitter/X: avg engagement rate ~1.5%, good = 3%+, viral = 6%+

KEY SIGNALS (weighted importance):
1. Engagement Rate (40%) — primary quality signal
2. Saves (20%) — strongest intent signal, user wants to revisit
3. Shares (20%) — virality signal, user endorsing to their audience
4. Views relative to platform norms (10%) — raw reach
5. Comments (10%) — depth of engagement, conversation starter

OUTPUT: Return valid JSON only. No markdown, no extra text.`;

// System prompt for insights generation
const INSIGHTS_SYSTEM = `You are the Analytics Agent for Postgame, an NIL marketing agency. You're analyzing a set of content performance metrics to generate campaign-level insights.

Your insights should be:
1. Actionable — tell the team what to do next
2. Specific — reference actual numbers and patterns
3. Concise — no fluff, just the signal

OUTPUT FORMAT: Return a JSON object with these fields:
{
  "summary": "2-3 sentence overview of campaign performance",
  "wins": ["list of what worked well, max 5 items"],
  "improvements": ["list of what could improve, max 5 items"],
  "patterns": ["notable patterns across the data, max 3 items"],
  "recommendation": "1-2 sentence actionable next step"
}`;

/**
 * Score a single asset's performance using Claude.
 * Takes D7 (and optionally D30) metrics and returns a tier + rationale.
 */
export async function scorePerformance(metrics: MetricsInput): Promise<ScoreResult> {
  const metricsContext = {
    platform: metrics.platform || 'unknown',
    athlete: metrics.athlete_name || 'unknown',
    posted_at: metrics.posted_at || 'unknown',
    d7: {
      views: metrics.d7_views ?? 0,
      likes: metrics.d7_likes ?? 0,
      comments: metrics.d7_comments ?? 0,
      shares: metrics.d7_shares ?? 0,
      saves: metrics.d7_saves ?? 0,
      reach: metrics.d7_reach ?? 0,
      impressions: metrics.d7_impressions ?? 0,
      engagement_rate: metrics.d7_engagement_rate ?? 0,
    },
    d30: metrics.d30_views != null ? {
      views: metrics.d30_views ?? 0,
      likes: metrics.d30_likes ?? 0,
      comments: metrics.d30_comments ?? 0,
      shares: metrics.d30_shares ?? 0,
      saves: metrics.d30_saves ?? 0,
      reach: metrics.d30_reach ?? 0,
      engagement_rate: metrics.d30_engagement_rate ?? 0,
    } : null,
    content_type: metrics.inspo_item?.content_type || 'unknown',
    description: metrics.inspo_item?.visual_description || 'No description available',
  };

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SCORING_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Score this content's performance and return JSON: { "tier": "S"|"A"|"B"|"C"|"D", "rationale": "2-3 sentence explanation" }

Metrics:
${JSON.stringify(metricsContext, null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content for scoring');
  }

  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const result = JSON.parse(jsonText) as ScoreResult;

  // Validate the tier value
  const validTiers = ['S', 'A', 'B', 'C', 'D'];
  if (!validTiers.includes(result.tier)) {
    throw new Error(`Invalid tier returned: ${result.tier}`);
  }

  return result;
}

/**
 * Generate campaign-level insights from an array of metrics.
 * Returns a structured insights object with wins, improvements, and patterns.
 */
export async function generateInsights(
  metrics: MetricsInput[]
): Promise<{
  summary: string;
  wins: string[];
  improvements: string[];
  patterns: string[];
  recommendation: string;
}> {
  if (metrics.length === 0) {
    return {
      summary: 'No metrics data available for analysis.',
      wins: [],
      improvements: [],
      patterns: [],
      recommendation: 'Start tracking content performance to generate insights.',
    };
  }

  // Build a condensed view of the metrics for Claude
  const condensed = metrics.map((m) => ({
    id: m.id,
    athlete: m.athlete_name,
    platform: m.platform,
    tier: (m as Record<string, unknown>).performance_tier || 'unscored',
    d7_views: m.d7_views ?? 0,
    d7_likes: m.d7_likes ?? 0,
    d7_comments: m.d7_comments ?? 0,
    d7_shares: m.d7_shares ?? 0,
    d7_saves: m.d7_saves ?? 0,
    d7_engagement_rate: m.d7_engagement_rate ?? 0,
    content_type: m.inspo_item?.content_type || 'unknown',
  }));

  // Summary stats
  const totalViews = condensed.reduce((s, m) => s + (m.d7_views || 0), 0);
  const totalEngagements = condensed.reduce(
    (s, m) => s + (m.d7_likes || 0) + (m.d7_comments || 0) + (m.d7_shares || 0) + (m.d7_saves || 0),
    0
  );
  const avgEngRate = condensed.filter((m) => m.d7_engagement_rate > 0).length > 0
    ? condensed.reduce((s, m) => s + m.d7_engagement_rate, 0) /
      condensed.filter((m) => m.d7_engagement_rate > 0).length
    : 0;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: INSIGHTS_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Analyze these ${metrics.length} content assets and generate campaign insights.

Summary stats:
- Total Views: ${totalViews.toLocaleString()}
- Total Engagements: ${totalEngagements.toLocaleString()}
- Avg Engagement Rate: ${avgEngRate.toFixed(2)}%
- Asset count: ${metrics.length}

Per-asset data:
${JSON.stringify(condensed, null, 2)}

Return JSON matching the insights schema.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content for insights');
  }

  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(jsonText);
}

/**
 * Suggest top-performing assets to reuse or repurpose.
 * Returns a ranked list with reasons for each recommendation.
 */
export async function suggestTopPerformers(
  metrics: MetricsInput[]
): Promise<TopPerformer[]> {
  if (metrics.length === 0) return [];

  // Sort by engagement rate descending, then by saves (high-intent), then shares (virality)
  const sorted = [...metrics].sort((a, b) => {
    const engDiff = (b.d7_engagement_rate ?? 0) - (a.d7_engagement_rate ?? 0);
    if (engDiff !== 0) return engDiff;
    const savesDiff = (b.d7_saves ?? 0) - (a.d7_saves ?? 0);
    if (savesDiff !== 0) return savesDiff;
    return (b.d7_shares ?? 0) - (a.d7_shares ?? 0);
  });

  // Take top 10 candidates
  const candidates = sorted.slice(0, 10);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are the Analytics Agent for Postgame. Given top-performing content assets, explain WHY each one performed well and how it could be repurposed.

Return a JSON array of objects: [{ "id": "uuid", "reason": "1-2 sentence explanation of why this asset performed well and how to repurpose it" }]

Rank by reuse potential — assets with high saves and shares have the most repurpose value.`,
    messages: [
      {
        role: 'user',
        content: `Rank these top-performing assets by reuse potential:

${JSON.stringify(candidates.map((m) => ({
  id: m.id,
  athlete: m.athlete_name,
  platform: m.platform,
  d7_views: m.d7_views,
  d7_likes: m.d7_likes,
  d7_saves: m.d7_saves,
  d7_shares: m.d7_shares,
  d7_engagement_rate: m.d7_engagement_rate,
  content_type: m.inspo_item?.content_type,
  description: m.inspo_item?.visual_description,
})), null, 2)}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text for top performers');
  }

  let jsonText = textBlock.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const ranked: { id: string; reason: string }[] = JSON.parse(jsonText);

  // Merge Claude's reasons with the actual metric data
  return ranked.map((r) => {
    const original = candidates.find((c) => c.id === r.id);
    return {
      id: r.id,
      athlete_name: original?.athlete_name ?? null,
      platform: original?.platform ?? null,
      d7_engagement_rate: original?.d7_engagement_rate ?? null,
      d7_views: original?.d7_views ?? null,
      reason: r.reason,
    };
  });
}
