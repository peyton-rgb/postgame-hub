// ============================================================
// Analytics Agent — Campaign Performance Analyzer
//
// What it does:
//   1. Fetches campaign context from brand_campaigns
//   2. Pulls all asset_metrics rows for the campaign
//   3. Loads posting_packages for distribution context
//   4. Calculates aggregate stats in code (totals, averages,
//      best/worst performers)
//   5. Sends everything to Claude for deep analysis
//   6. Returns structured JSON based on analysis_type:
//      - performance_review: grade, key metrics, top/under-
//        performers, insights, recommendations
//      - campaign_recap: executive summary, goals met,
//        highlights, athlete breakdown, lessons learned
//      - comparison: same shape as campaign_recap
//   7. Logs the run to agent_runs for auditing
//
// Called by POST /api/agents/analytics
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// Initialize the Anthropic client (reads ANTHROPIC_API_KEY from env)
const anthropic = new Anthropic();

// Admin Supabase client for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---- Types ----

export type AnalysisType = 'performance_review' | 'campaign_recap' | 'comparison';

export interface AnalyticsAgentParams {
  campaign_id: string;
  analysis_type?: AnalysisType;
}

export interface PerformanceReviewResult {
  overall_grade: string;
  key_metrics: { metric: string; value: number; benchmark_comparison: string }[];
  top_performers: { asset_name: string; platform: string; standout_metric: string }[];
  underperformers: { asset_name: string; platform: string; issue: string }[];
  insights: string[];
  recommendations: string[];
  summary: string;
}

export interface CampaignRecapResult {
  executive_summary: string;
  campaign_goals_met: boolean;
  highlights: string[];
  metrics_summary: {
    total_reach: number;
    total_engagement: number;
    total_views: number;
    avg_engagement_rate: number;
    cost_per_view: number | null;
    cost_per_engagement: number | null;
  };
  athlete_performance: {
    name: string;
    assets: number;
    total_views: number;
    avg_engagement_rate: number;
  }[];
  lessons_learned: string[];
  recommendations_for_next: string[];
}

export type AnalyticsResult = PerformanceReviewResult | CampaignRecapResult;

// ---- System Prompt ----

const SYSTEM_PROMPT = `You are the Analytics Agent for Postgame, an NIL (Name, Image, Likeness) marketing agency specializing in college athlete brand campaigns.

Your role is to analyze campaign performance data and produce actionable insights. You think like a data analyst who deeply understands:
- Social media metrics (views, engagement rate, reach, saves, shares)
- NIL marketing benchmarks for college athletes
- Platform-specific performance norms (Instagram, TikTok, YouTube, etc.)
- Content strategy and what drives engagement in athlete marketing

ANALYSIS GUIDELINES:
1. Be specific with numbers — don't just say "good" or "bad," quantify it.
2. Compare metrics against typical NIL campaign benchmarks:
   - Engagement rate above 5% is strong, 2-5% is average, below 2% needs attention
   - View-to-engagement ratio above 10% is excellent
   - Saves and shares indicate high-value content
3. Identify patterns: which platforms, content types, or athletes drive the best results?
4. Recommendations should be concrete and actionable, not generic marketing advice.
5. When grading (A-F), be honest — not every campaign is an A.

OUTPUT: Return ONLY valid JSON matching the requested schema. No extra text, no markdown code fences.`;

// ---- Main Function ----

/**
 * Run the Analytics Agent to analyze campaign performance.
 *
 * @param params - campaign_id and optional analysis_type
 * @returns Structured analysis result
 */
export async function runAnalyticsAgent(
  params: AnalyticsAgentParams
): Promise<AnalyticsResult> {
  const { campaign_id, analysis_type = 'performance_review' } = params;
  const startTime = Date.now();

  // --- Step 1: Fetch campaign context from brand_campaigns ---
  const { data: campaign, error: campaignError } = await supabase
    .from('brand_campaigns')
    .select('id, name, brand, budget, shoot_date, status, settings')
    .eq('id', campaign_id)
    .single();

  if (campaignError || !campaign) {
    throw new Error(`Campaign not found: ${campaign_id}`);
  }

  // --- Step 2: Fetch all asset_metrics for this campaign ---
  const { data: metrics, error: metricsError } = await supabase
    .from('asset_metrics')
    .select('*')
    .eq('campaign_id', campaign_id);

  if (metricsError) {
    throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
  }

  const metricsRows = metrics || [];

  // --- Step 3: Fetch posting_packages for distribution context ---
  const { data: packages, error: packagesError } = await supabase
    .from('posting_packages')
    .select('id, athlete_name, platform_notes, status, posted_at, live_url, intended_post_date')
    .eq('campaign_id', campaign_id);

  if (packagesError) {
    throw new Error(`Failed to fetch posting packages: ${packagesError.message}`);
  }

  const postingPackages = packages || [];

  // --- Step 4: Calculate aggregate stats in code ---
  const aggregates = calculateAggregates(metricsRows, campaign.budget);

  // --- Step 5: Create agent_runs record (status: running) ---
  const { data: agentRun, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'analytics',
      triggered_by: null,
      input_payload: {
        campaign_id,
        analysis_type,
        asset_count: metricsRows.length,
        package_count: postingPackages.length,
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  if (runError) {
    throw new Error(`Failed to create agent run record: ${runError.message}`);
  }

  // --- Step 6: Build the prompt and call Claude ---
  const userPrompt = buildUserPrompt(
    analysis_type,
    campaign,
    metricsRows,
    postingPackages,
    aggregates
  );

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });
  } catch (err) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Claude API call failed',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);
    throw err;
  }

  // --- Step 7: Parse the response ---
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: 'Claude returned no text content',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);
    throw new Error('Claude returned no text content');
  }

  let result: AnalyticsResult;
  try {
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    result = JSON.parse(jsonText) as AnalyticsResult;
  } catch {
    // Retry once with a correction prompt
    console.warn('First JSON parse failed for analytics, retrying...');
    try {
      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: textBlock.text },
          {
            role: 'user',
            content: `Your previous response was not valid JSON. Return ONLY a valid JSON object matching the ${analysis_type} schema. No extra text, no markdown.`,
          },
        ],
      });

      const retryBlock = retryResponse.content.find((b) => b.type === 'text');
      if (retryBlock && retryBlock.type === 'text') {
        let retryJson = retryBlock.text.trim();
        if (retryJson.startsWith('```')) {
          retryJson = retryJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        result = JSON.parse(retryJson) as AnalyticsResult;
        response = retryResponse;
      } else {
        throw new Error('Retry returned no text');
      }
    } catch {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse Claude analytics response after 2 attempts',
          output_payload: { raw_response: textBlock.text },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
      throw new Error('Claude returned malformed JSON twice during analytics. Please retry.');
    }
  }

  // --- Step 8: Update agent_runs with success ---
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  await supabase
    .from('agent_runs')
    .update({
      status: 'complete',
      output_payload: result,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRun.id);

  return result;
}

// ---- Helper: Calculate Aggregates ----

interface AggregateStats {
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  total_reach: number;
  total_engagement: number;
  avg_engagement_rate: number;
  asset_count: number;
  best_by_views: { athlete_name: string; platform: string; views: number } | null;
  best_by_engagement: { athlete_name: string; platform: string; rate: number } | null;
  worst_by_engagement: { athlete_name: string; platform: string; rate: number } | null;
  cost_per_view: number | null;
  cost_per_engagement: number | null;
  platforms: Record<string, number>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function calculateAggregates(rows: any[], budget: number | null): AggregateStats {
  const stats: AggregateStats = {
    total_views: 0,
    total_likes: 0,
    total_comments: 0,
    total_shares: 0,
    total_saves: 0,
    total_reach: 0,
    total_engagement: 0,
    avg_engagement_rate: 0,
    asset_count: rows.length,
    best_by_views: null,
    best_by_engagement: null,
    worst_by_engagement: null,
    cost_per_view: null,
    cost_per_engagement: null,
    platforms: {},
  };

  if (rows.length === 0) return stats;

  let engagementRateSum = 0;
  let engagementRateCount = 0;
  let maxViews = -1;
  let maxEngRate = -1;
  let minEngRate = Infinity;

  for (const row of rows) {
    const views = row.d7_views || 0;
    const likes = row.d7_likes || 0;
    const comments = row.d7_comments || 0;
    const shares = row.d7_shares || 0;
    const saves = row.d7_saves || 0;
    const reach = row.d7_reach || 0;
    const engRate = row.d7_engagement_rate || 0;
    const platform = row.platform || 'unknown';

    stats.total_views += views;
    stats.total_likes += likes;
    stats.total_comments += comments;
    stats.total_shares += shares;
    stats.total_saves += saves;
    stats.total_reach += reach;
    stats.total_engagement += likes + comments + shares + saves;

    // Platform breakdown
    stats.platforms[platform] = (stats.platforms[platform] || 0) + 1;

    // Engagement rate tracking
    if (engRate > 0) {
      engagementRateSum += engRate;
      engagementRateCount++;
    }

    // Best by views
    if (views > maxViews) {
      maxViews = views;
      stats.best_by_views = {
        athlete_name: row.athlete_name || 'Unknown',
        platform,
        views,
      };
    }

    // Best / worst by engagement rate
    if (engRate > maxEngRate) {
      maxEngRate = engRate;
      stats.best_by_engagement = {
        athlete_name: row.athlete_name || 'Unknown',
        platform,
        rate: engRate,
      };
    }
    if (engRate > 0 && engRate < minEngRate) {
      minEngRate = engRate;
      stats.worst_by_engagement = {
        athlete_name: row.athlete_name || 'Unknown',
        platform,
        rate: engRate,
      };
    }
  }

  stats.avg_engagement_rate =
    engagementRateCount > 0
      ? Math.round((engagementRateSum / engagementRateCount) * 100) / 100
      : 0;

  // Cost metrics
  if (budget && budget > 0) {
    if (stats.total_views > 0) {
      stats.cost_per_view = Math.round((budget / stats.total_views) * 100) / 100;
    }
    if (stats.total_engagement > 0) {
      stats.cost_per_engagement = Math.round((budget / stats.total_engagement) * 100) / 100;
    }
  }

  return stats;
}

// ---- Helper: Build the User Prompt ----

function buildUserPrompt(
  analysisType: AnalysisType,
  campaign: any,
  metricsRows: any[],
  postingPackages: any[],
  aggregates: AggregateStats
): string {
  const campaignContext = `
CAMPAIGN: "${campaign.name}"
BRAND: ${campaign.brand || 'N/A'}
BUDGET: ${campaign.budget ? `$${campaign.budget.toLocaleString()}` : 'Not specified'}
SHOOT DATE: ${campaign.shoot_date || 'N/A'}
STATUS: ${campaign.status || 'N/A'}
`;

  const aggregateContext = `
AGGREGATE METRICS (${aggregates.asset_count} assets):
- Total Views: ${aggregates.total_views.toLocaleString()}
- Total Likes: ${aggregates.total_likes.toLocaleString()}
- Total Comments: ${aggregates.total_comments.toLocaleString()}
- Total Shares: ${aggregates.total_shares.toLocaleString()}
- Total Saves: ${aggregates.total_saves.toLocaleString()}
- Total Reach: ${aggregates.total_reach.toLocaleString()}
- Total Engagement: ${aggregates.total_engagement.toLocaleString()}
- Avg Engagement Rate: ${aggregates.avg_engagement_rate}%
- Cost Per View: ${aggregates.cost_per_view !== null ? `$${aggregates.cost_per_view}` : 'N/A'}
- Cost Per Engagement: ${aggregates.cost_per_engagement !== null ? `$${aggregates.cost_per_engagement}` : 'N/A'}
- Platforms: ${JSON.stringify(aggregates.platforms)}
- Best by Views: ${aggregates.best_by_views ? `${aggregates.best_by_views.athlete_name} on ${aggregates.best_by_views.platform} (${aggregates.best_by_views.views.toLocaleString()} views)` : 'N/A'}
- Best by Engagement: ${aggregates.best_by_engagement ? `${aggregates.best_by_engagement.athlete_name} on ${aggregates.best_by_engagement.platform} (${aggregates.best_by_engagement.rate}%)` : 'N/A'}
- Worst by Engagement: ${aggregates.worst_by_engagement ? `${aggregates.worst_by_engagement.athlete_name} on ${aggregates.worst_by_engagement.platform} (${aggregates.worst_by_engagement.rate}%)` : 'N/A'}
`;

  // Per-asset detail (limit to avoid token explosion)
  const assetDetails = metricsRows.slice(0, 50).map((row, i) => {
    return `Asset ${i + 1}: athlete="${row.athlete_name || 'Unknown'}" platform="${row.platform || '?'}" views=${row.d7_views || 0} likes=${row.d7_likes || 0} comments=${row.d7_comments || 0} shares=${row.d7_shares || 0} saves=${row.d7_saves || 0} eng_rate=${row.d7_engagement_rate || 0}% tier=${row.performance_tier || 'unscored'} posted=${row.posted_at || 'N/A'}`;
  });

  const distributionContext = postingPackages.length > 0
    ? `\nDISTRIBUTION (${postingPackages.length} packages):\n` +
      postingPackages.slice(0, 30).map((pkg) =>
        `- ${pkg.athlete_name}: status=${pkg.status || '?'} posted=${pkg.posted_at || 'not yet'}`
      ).join('\n')
    : '\nDISTRIBUTION: No posting packages found.';

  let schemaInstruction = '';

  if (analysisType === 'performance_review') {
    schemaInstruction = `
Analyze this campaign and return JSON with this exact shape:
{
  "overall_grade": "A-F letter grade",
  "key_metrics": [{ "metric": "string", "value": number, "benchmark_comparison": "above/below/at benchmark explanation" }],
  "top_performers": [{ "asset_name": "athlete - platform", "platform": "string", "standout_metric": "what made it stand out" }],
  "underperformers": [{ "asset_name": "athlete - platform", "platform": "string", "issue": "why it underperformed" }],
  "insights": ["insight 1", "insight 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "summary": "2-3 paragraph executive summary"
}`;
  } else {
    // campaign_recap and comparison use the same shape
    schemaInstruction = `
Analyze this campaign and return JSON with this exact shape:
{
  "executive_summary": "2-3 paragraph summary",
  "campaign_goals_met": true/false,
  "highlights": ["highlight 1", "highlight 2", ...],
  "metrics_summary": {
    "total_reach": number,
    "total_engagement": number,
    "total_views": number,
    "avg_engagement_rate": number,
    "cost_per_view": number or null,
    "cost_per_engagement": number or null
  },
  "athlete_performance": [{ "name": "string", "assets": number, "total_views": number, "avg_engagement_rate": number }],
  "lessons_learned": ["lesson 1", "lesson 2", ...],
  "recommendations_for_next": ["rec 1", "rec 2", ...]
}`;
  }

  return `${campaignContext}\n${aggregateContext}\nPER-ASSET BREAKDOWN:\n${assetDetails.join('\n')}\n${distributionContext}\n\n${schemaInstruction}`;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
