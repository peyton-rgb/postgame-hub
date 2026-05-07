// ============================================================
// Distributor Agent — Content Distribution Strategist
//
// What it does:
//   1. Takes context about a final asset or campaign
//   2. Optionally fetches campaign brief details and existing
//      posting packages to avoid scheduling conflicts
//   3. Sends everything to Claude for analysis
//   4. Claude returns a structured distribution plan:
//      - Recommended platforms with priority + rationale
//      - Posting schedule with optimal dates/times
//      - Caption guidelines per platform
//      - Cross-promotion tips
//      - NIL compliance reminders
//   5. Logs the run to agent_runs for auditing
//
// This function is called by POST /api/agents/distributor
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

// ---------- Types ----------

export interface DistributorParams {
  final_asset_id?: string;
  campaign_id?: string;
  athlete_name: string;
  asset_type: string;           // e.g. "reel", "photo", "carousel", "video"
  content_description: string;  // brief description of the content
}

export interface PlatformRecommendation {
  platform: string;
  priority: 'primary' | 'secondary';
  rationale: string;
}

export interface PostingSlot {
  platform: string;
  recommended_date: string;
  recommended_time: string;
  reasoning: string;
}

export interface CaptionGuideline {
  platform: string;
  tone: string;
  length_guidance: string;
  hashtag_strategy: string;
}

export interface DistributionPlan {
  recommended_platforms: PlatformRecommendation[];
  posting_schedule: PostingSlot[];
  caption_guidelines: CaptionGuideline[];
  cross_promotion_tips: string[];
  compliance_reminders: string[];
  summary: string;
}

// ---------- System Prompt ----------

const SYSTEM_PROMPT = `You are the Distributor Agent for Postgame, an NIL (Name, Image, Likeness) marketing agency that creates content campaigns featuring college athletes.

YOUR ROLE:
You are a social media distribution strategist who specializes in NIL athlete marketing. You decide WHEN, WHERE, and HOW content should be posted to maximize reach, engagement, and brand value while staying fully compliant with NCAA NIL regulations.

WHAT YOU KNOW:
- Platform algorithms and optimal posting windows (Instagram, TikTok, YouTube, X/Twitter, LinkedIn, Snapchat)
- NIL compliance requirements — athletes must have proper disclosures (#ad, #partner, paid partnership tags)
- College athlete audience demographics — primarily 18-24, high engagement on TikTok and Instagram
- Sports calendar awareness — game days, rivalry weeks, off-season timing all affect performance
- Brand safety considerations for athlete-sponsored content

PLATFORM EXPERTISE:
- Instagram: Reels (best reach), Stories (engagement), Feed posts (brand polish), Carousels (education/storytelling)
- TikTok: Native vertical video, trending sounds, duets, 15-60s sweet spot
- YouTube: Shorts for discovery, long-form for depth, community posts for engagement
- X/Twitter: Real-time moments, game day reactions, quote tweets for conversation
- LinkedIn: Professional brand building, brand partner highlights, career milestones
- Snapchat: Behind-the-scenes, day-in-the-life, casual athlete personality

SCHEDULING PRINCIPLES:
1. Never stack multiple posts on the same platform in one day
2. Space content across the week for sustained visibility
3. Align with the athlete's sport schedule (avoid posting during games/practice)
4. Consider time zones for the athlete's school market
5. Primary platform gets first-post advantage
6. Cross-promote within 24-48 hours on secondary platforms

OUTPUT: Return ONLY valid JSON matching the requested schema. No extra text, no markdown.`;

// ---------- Main Function ----------

/**
 * Run the Distributor Agent to generate a distribution plan
 * for athlete marketing content.
 *
 * @param params - Asset, campaign, and content context
 * @returns A structured distribution plan
 */
export async function runDistributorAgent(
  params: DistributorParams
): Promise<DistributionPlan> {
  const startTime = Date.now();

  // --- Step 1: Gather context from the database ---
  let campaignContext = '';
  let assetContext = '';
  let existingPackages = '';

  // Fetch campaign brief if campaign_id provided
  if (params.campaign_id) {
    const { data: campaign } = await supabase
      .from('campaign_briefs')
      .select('name, campaign_type, target_launch_date, brand_name, status')
      .eq('id', params.campaign_id)
      .single();

    if (campaign) {
      campaignContext = `\n\nCAMPAIGN CONTEXT:
- Campaign: ${campaign.name}
- Type: ${campaign.campaign_type || 'general'}
- Brand: ${campaign.brand_name || 'unknown'}
- Target launch: ${campaign.target_launch_date || 'flexible'}
- Status: ${campaign.status}`;
    }
  }

  // Fetch final asset details if final_asset_id provided
  if (params.final_asset_id) {
    const { data: asset } = await supabase
      .from('final_assets')
      .select('*')
      .eq('id', params.final_asset_id)
      .single();

    if (asset) {
      assetContext = `\n\nASSET DETAILS:
- Asset name: ${asset.name || 'Untitled'}
- File type: ${asset.file_type || params.asset_type}
- Status: ${asset.status || 'ready'}`;
    }
  }

  // Fetch existing posting packages to avoid conflicts
  if (params.campaign_id) {
    const { data: packages } = await supabase
      .from('posting_packages')
      .select('platform, scheduled_date, scheduled_time, status')
      .eq('campaign_id', params.campaign_id);

    if (packages && packages.length > 0) {
      existingPackages = `\n\nEXISTING SCHEDULED POSTS (avoid conflicts):
${packages.map((p) => `- ${p.platform} on ${p.scheduled_date} at ${p.scheduled_time} (${p.status})`).join('\n')}`;
    }
  }

  // --- Step 2: Create agent_runs record ---
  const { data: agentRun, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'distributor',
      input_payload: {
        ...params,
        campaign_context: campaignContext ? 'loaded' : 'none',
        asset_context: assetContext ? 'loaded' : 'none',
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  if (runError) {
    throw new Error(`Failed to create agent run record: ${runError.message}`);
  }

  // --- Step 3: Build the user prompt ---
  const userPrompt = `Generate a distribution plan for this NIL athlete content.

ATHLETE: ${params.athlete_name}
ASSET TYPE: ${params.asset_type}
CONTENT: ${params.content_description}${campaignContext}${assetContext}${existingPackages}

Return a JSON object with this exact structure:
{
  "recommended_platforms": [
    { "platform": "instagram_reels", "priority": "primary", "rationale": "why this platform" }
  ],
  "posting_schedule": [
    { "platform": "instagram_reels", "recommended_date": "YYYY-MM-DD or relative like 'Day 1'", "recommended_time": "HH:MM EST", "reasoning": "why this slot" }
  ],
  "caption_guidelines": [
    { "platform": "instagram", "tone": "casual/professional/hype", "length_guidance": "word count range", "hashtag_strategy": "how many, what type" }
  ],
  "cross_promotion_tips": ["tip 1", "tip 2"],
  "compliance_reminders": ["reminder about NIL disclosures"],
  "summary": "2-3 sentence overview of the distribution strategy"
}`;

  // --- Step 4: Call Claude ---
  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Claude call failed',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);
    throw err;
  }

  // --- Step 5: Parse the response ---
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

  let plan: DistributionPlan;
  try {
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    plan = JSON.parse(jsonText) as DistributionPlan;
  } catch {
    // Retry once with a correction prompt
    console.warn('First JSON parse failed for distributor, retrying...');
    try {
      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: textBlock.text },
          {
            role: 'user',
            content: 'Your previous response was not valid JSON. Return ONLY a valid JSON object with these keys: recommended_platforms, posting_schedule, caption_guidelines, cross_promotion_tips, compliance_reminders, summary. No extra text.',
          },
        ],
      });

      const retryBlock = retryResponse.content.find((b) => b.type === 'text');
      if (retryBlock && retryBlock.type === 'text') {
        let retryJson = retryBlock.text.trim();
        if (retryJson.startsWith('```')) {
          retryJson = retryJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        plan = JSON.parse(retryJson) as DistributionPlan;
        response = retryResponse;
      } else {
        throw new Error('Retry returned no text');
      }
    } catch {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse Claude distributor response after 2 attempts',
          output_payload: { raw_response: textBlock.text },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
      throw new Error('Claude returned malformed JSON twice during distribution planning. Please retry.');
    }
  }

  // --- Step 6: Log success to agent_runs ---
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  await supabase
    .from('agent_runs')
    .update({
      status: 'complete',
      output_payload: plan,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRun.id);

  return plan;
}
