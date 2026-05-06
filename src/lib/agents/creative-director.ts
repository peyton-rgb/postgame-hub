// ============================================================
// Creative Director Agent
// The first AI agent in the Postgame Creative Brain.
//
// What it does:
//   1. Reads a published brief from Supabase
//   2. Loads the brand's history (prior campaigns, what worked)
//   3. Finds relevant inspo items using tag-based filtering
//   4. Sends everything to Claude with a structured prompt
//   5. Parses Claude's JSON response into concept records
//   6. Saves concepts + the agent run audit log to Supabase
//
// This function is called by POST /api/concepts/generate
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createServiceSupabase } from '@/lib/supabase';
import type { Concept } from '@/lib/types/briefs';

// Lazy clients — instantiated on first use, not at module load.
// This keeps Next.js build-time page-data collection from crashing
// when env vars (ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY) are
// absent in the build environment.
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

let _supabase: ReturnType<typeof createServiceSupabase> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createServiceSupabase();
  return _supabase;
}

// The JSON schema we tell Claude to follow for its output.
// Claude will return an array of concept objects matching this shape.
const CONCEPT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'A memorable, evocative concept title' },
          hook: { type: 'string', description: 'One-paragraph pitch that sells the concept' },
          athlete_archetype: { type: 'string', description: 'Description of ideal athlete type' },
          settings_suggestions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Locations, environments, and settings',
          },
          production_scope: {
            type: 'string',
            enum: ['ugc_only', 'hybrid', 'full_production'],
            description: 'Level of production needed',
          },
          estimated_assets: {
            type: 'number',
            description: 'Rough count of expected deliverables',
          },
          inspo_item_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of inspo_items that informed this concept',
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of why this concept fits the brief',
          },
        },
        required: ['name', 'hook', 'athlete_archetype', 'settings_suggestions', 'production_scope', 'estimated_assets'],
      },
      minItems: 3,
      maxItems: 5,
    },
  },
  required: ['concepts'],
};

// Normalize whatever Claude returns into a valid production_scope enum.
// Claude tends to write free-text descriptions ("medium production",
// "full crew", etc.) instead of the literal enum string, even when the
// schema specifies it. We map common phrasings to the closest enum,
// defaulting to 'hybrid' when nothing matches.
type ProductionScope = 'ugc_only' | 'hybrid' | 'full_production';

function normalizeProductionScope(raw: unknown): ProductionScope {
  if (typeof raw !== 'string') return 'hybrid';
  const v = raw.toLowerCase().trim();

  if (v === 'ugc_only' || v === 'hybrid' || v === 'full_production') {
    return v;
  }

  // ugc_only: athlete-captured, phone-shot, no crew
  if (
    v.includes('ugc') ||
    v.includes('user generated') ||
    v.includes('user-generated') ||
    v.includes('athlete captured') ||
    v.includes('athlete-captured') ||
    v.includes('self shot') ||
    v.includes('self-shot') ||
    v.includes('phone') ||
    v.includes('no production') ||
    v.includes('no crew')
  ) {
    return 'ugc_only';
  }

  // full_production: full crew, cinematic, commercial-grade
  if (
    v.includes('full production') ||
    v.includes('full_production') ||
    v.includes('full crew') ||
    v.includes('full-crew') ||
    v.includes('commercial') ||
    v.includes('cinematic') ||
    v.includes('high production') ||
    v.includes('high-production') ||
    v.includes('professional production')
  ) {
    return 'full_production';
  }

  // hybrid covers everything in between (mix of UGC + crew, mid-tier, etc.)
  return 'hybrid';
}

// Build the system prompt for the Creative Director persona
function buildSystemPrompt(voiceRules: string | null): string {
  return `You are the Creative Director for Postgame, an NIL (Name, Image, Likeness) marketing agency that runs campaigns where brands sponsor college athletes to create social media content.

Your job: take a brand brief and produce 3 to 5 distinct creative concept proposals. Each concept should be a complete creative direction — not just a title, but a full pitch with reasoning.

PERSONA:
- You are confident, brand-savvy, and slightly opinionated. Creative Directors have taste.
- You think in terms of visual storytelling, athlete authenticity, and platform-native content.
- You balance brand objectives with what actually performs on social media.
- You consider production feasibility — not every concept needs a full crew.

${voiceRules ? `POSTGAME VOICE RULES:\n${voiceRules}\n` : ''}
OUTPUT REQUIREMENTS:
- Return ONLY valid JSON matching the schema provided.
- Generate exactly 3 to 5 concepts. Each must be distinct — different angles, not variations on one idea.
- Each concept needs: a memorable name, a one-paragraph hook that sells it, an athlete archetype, setting suggestions, production scope, and estimated asset count.
- If inspo items are provided, reference them by ID in your concepts. Pull visual and tonal inspiration from them.

PRODUCTION SCOPE — STRICT ENUM:
The "production_scope" field MUST be EXACTLY one of these three literal strings, with no variations, no descriptive text, no extra words:
  - "ugc_only"         (athlete shoots on their phone, no crew)
  - "hybrid"           (mix of athlete-captured + light crew/editing)
  - "full_production"  (full crew, cinematic, commercial-grade)
Do NOT write "Medium Production", "UGC", "Full Production", or any prose. Use only the lowercase enum string with the underscore exactly as shown above. Any other value will be rejected.

CONSTRAINTS:
- Do NOT use real athlete names unless they appear in the brief.
- ALWAYS respect the brief's mandatories (must-include items) and restrictions (do-not-mention items).
- Lean on the inspo references — they're Postgame's creative memory from prior campaigns.
- Consider the brand's history if provided. What worked before? What didn't?`;
}

// Build the user message with the actual brief data
function buildUserMessage(
  brief: Record<string, unknown>,
  brand: Record<string, unknown>,
  priorCampaigns: Record<string, unknown>[],
  inspoItems: Record<string, unknown>[],
  iterationFeedback?: string
): string {
  let message = `## BRAND BRIEF\n\n`;
  message += `**Brand:** ${brand.name || 'Unknown'}\n`;
  message += `**Campaign:** ${brief.name}\n`;
  message += `**Type:** ${brief.campaign_type}\n`;
  message += `**Production Config:** ${brief.production_config}\n`;

  if (brief.start_date) message += `**Start Date:** ${brief.start_date}\n`;
  if (brief.target_launch_date) message += `**Target Launch:** ${brief.target_launch_date}\n`;
  if (brief.budget) message += `**Budget:** $${brief.budget}\n`;

  // Brief content (the rich text body)
  if (brief.brief_content) {
    message += `\n### Brief Content\n`;
    // Extract text from Tiptap JSON if possible, otherwise stringify
    message += typeof brief.brief_content === 'string'
      ? brief.brief_content
      : JSON.stringify(brief.brief_content, null, 2);
    message += '\n';
  }

  // Mandatories and restrictions
  const mandatories = brief.mandatories as string[] | undefined;
  const restrictions = brief.restrictions as string[] | undefined;
  if (mandatories && mandatories.length > 0) {
    message += `\n### MANDATORIES (must include)\n`;
    mandatories.forEach((m: string) => { message += `- ${m}\n`; });
  }
  if (restrictions && restrictions.length > 0) {
    message += `\n### RESTRICTIONS (do NOT mention or show)\n`;
    restrictions.forEach((r: string) => { message += `- ${r}\n`; });
  }

  // Athlete targeting
  if (brief.athlete_targeting && Object.keys(brief.athlete_targeting as object).length > 0) {
    message += `\n### Athlete Targeting\n`;
    message += JSON.stringify(brief.athlete_targeting, null, 2);
    message += '\n';
  }

  // Brand history
  if (priorCampaigns.length > 0) {
    message += `\n## BRAND HISTORY (last ${priorCampaigns.length} campaigns)\n`;
    priorCampaigns.forEach((c, i) => {
      message += `\n### Campaign ${i + 1}: ${c.name || 'Unnamed'}\n`;
      if (c.status) message += `Status: ${c.status}\n`;
      // Include any performance summary if available
      if (c.performance_summary) message += `Performance: ${JSON.stringify(c.performance_summary)}\n`;
    });
  }

  // Inspo items
  if (inspoItems.length > 0) {
    message += `\n## INSPO LIBRARY (${inspoItems.length} relevant items)\n`;
    message += `Reference these by ID in your concepts.\n\n`;
    inspoItems.forEach((item) => {
      message += `- **ID:** ${item.id}`;
      if (item.title) message += ` | **Title:** ${item.title}`;
      if (item.tags) message += ` | **Tags:** ${JSON.stringify(item.tags)}`;
      if (item.vibe_words) message += ` | **Vibe:** ${item.vibe_words}`;
      message += '\n';
    });
  }

  // Iteration feedback (when an AM asks for changes to a concept)
  if (iterationFeedback) {
    message += `\n## ITERATION REQUEST\n`;
    message += `The AM has reviewed your previous concepts and wants changes:\n`;
    message += `"${iterationFeedback}"\n`;
    message += `Generate new concepts that address this feedback while staying true to the brief.\n`;
  }

  message += `\n## OUTPUT\nReturn your concepts as JSON matching the required schema.`;

  return message;
}

/**
 * Main function: generates concepts for a published brief.
 *
 * @param briefId - The UUID of the published brief
 * @param userId - The UUID of the user who triggered the generation
 * @param iterationFeedback - Optional feedback for re-generating concepts
 * @returns Array of created concept records
 */
export async function generateConcepts(
  briefId: string,
  userId: string,
  iterationFeedback?: string
): Promise<Concept[]> {
  const startTime = Date.now();
  const supabase = getSupabase();
  const anthropic = getAnthropic();

  // --- Step 1: Load the brief ---
  const { data: brief, error: briefError } = await supabase
    .from('campaign_briefs')
    .select('*')
    .eq('id', briefId)
    .single();

  if (briefError || !brief) {
    throw new Error(`Brief not found: ${briefId}`);
  }

  if (brief.status === 'draft') {
    throw new Error('Cannot generate concepts for a draft brief. Publish it first.');
  }

  // --- Step 2: Load the brand + prior campaigns ---
  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brief.brand_id)
    .single();

  if (!brand) {
    throw new Error(`Brand not found: ${brief.brand_id}`);
  }

  // Get the last 3 campaigns for this brand (for context)
  const { data: priorCampaigns } = await supabase
    .from('brand_campaigns')
    .select('*')
    .eq('brand_id', brief.brand_id)
    .order('created_at', { ascending: false })
    .limit(3);

  // --- Step 3: Find relevant inspo items ---
  // Using tag-based filtering for v1 (will upgrade to pgvector later)
  let inspoItems: Record<string, unknown>[] = [];
  try {
    // Extract keywords from the brief for tag matching
    const targeting = brief.athlete_targeting as Record<string, unknown> | null;
    const sports = (targeting?.sports as string[]) || [];

    // Build a simple tag-based query
    let inspoQuery = supabase
      .from('inspo_items')
      .select('id, title, tags, vibe_words, sport, content_purpose')
      .limit(25);

    // Filter by sport if targeting specifies one
    if (sports.length > 0) {
      inspoQuery = inspoQuery.in('sport', sports);
    }

    const { data: inspoData } = await inspoQuery;
    inspoItems = inspoData || [];
  } catch (err) {
    // If inspo query fails, we can still generate concepts — just without references
    console.warn('Failed to fetch inspo items:', err);
  }

  // --- Step 4: Load voice rules ---
  let voiceRules: string | null = null;
  try {
    const { data: voiceData } = await supabase
      .from('voice_settings')
      .select('rules')
      .limit(1)
      .single();
    voiceRules = voiceData?.rules || null;
  } catch {
    // Voice settings are optional
  }

  // --- Step 5: Build the prompt and call Claude ---
  const systemPrompt = buildSystemPrompt(voiceRules);
  const userMessage = buildUserMessage(
    brief,
    brand,
    priorCampaigns || [],
    inspoItems,
    iterationFeedback
  );

  // Create the agent_runs record BEFORE calling Claude (status: running)
  const { data: agentRun, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'creative_director',
      triggered_by: userId,
      input_payload: {
        system_prompt: systemPrompt,
        user_message: userMessage,
        brief_id: briefId,
        inspo_count: inspoItems.length,
        iteration_feedback: iterationFeedback || null,
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  if (runError) {
    throw new Error(`Failed to create agent run record: ${runError.message}`);
  }

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    });
  } catch (err) {
    // Log the failure
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

  // --- Step 6: Parse the response ---
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

  let parsedConcepts;
  try {
    // Claude might wrap the JSON in markdown code fences — strip them
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsedConcepts = JSON.parse(jsonText);
  } catch (parseErr) {
    // First parse failed — retry once with a correction prompt
    console.warn('First JSON parse failed, retrying with correction...');

    try {
      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: textBlock.text },
          {
            role: 'user',
            content: `Your previous response was not valid JSON. Please return ONLY a valid JSON object matching this schema, with no extra text or markdown:\n\n${JSON.stringify(CONCEPT_OUTPUT_SCHEMA, null, 2)}`,
          },
        ],
      });

      const retryBlock = retryResponse.content.find((b) => b.type === 'text');
      if (retryBlock && retryBlock.type === 'text') {
        let retryJson = retryBlock.text.trim();
        if (retryJson.startsWith('```')) {
          retryJson = retryJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        parsedConcepts = JSON.parse(retryJson);

        // Update token counts to include retry
        response = retryResponse;
      }
    } catch {
      // Both attempts failed
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse Claude response as JSON after 2 attempts',
          output_payload: { raw_response: textBlock.text },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
      throw new Error('Claude returned malformed JSON twice. Please try again.');
    }
  }

  // Validate we got an array of concepts
  const conceptsArray = parsedConcepts.concepts || parsedConcepts;
  if (!Array.isArray(conceptsArray) || conceptsArray.length === 0) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: 'Claude response did not contain a concepts array',
        output_payload: parsedConcepts,
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);
    throw new Error('Claude did not return any concepts');
  }

  // --- Step 7: Save concepts to Supabase ---
  const conceptRecords = conceptsArray.map((c: Record<string, unknown>) => ({
    brief_id: briefId,
    name: c.name as string,
    hook: c.hook as string,
    athlete_archetype: (c.athlete_archetype as string) || null,
    settings_suggestions: (c.settings_suggestions as string[]) || [],
    inspo_references: (c.inspo_item_ids as string[]) || [],
    production_scope: normalizeProductionScope(c.production_scope),
    estimated_assets: (c.estimated_assets as number) || null,
    status: 'proposed' as const,
    generated_by: 'claude' as const,
    claude_run_id: agentRun.id,
    iteration_history: iterationFeedback
      ? [{ prompt: iterationFeedback, response: JSON.stringify(c), timestamp: new Date().toISOString() }]
      : [],
  }));

  const { data: savedConcepts, error: saveError } = await supabase
    .from('concepts')
    .insert(conceptRecords)
    .select();

  if (saveError) {
    throw new Error(`Failed to save concepts: ${saveError.message}`);
  }

  // --- Step 8: Update the agent run with success data ---
  // Calculate cost (approximate: Sonnet input $3/M tokens, output $15/M tokens)
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  await supabase
    .from('agent_runs')
    .update({
      status: 'complete',
      output_payload: parsedConcepts,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRun.id);

  return savedConcepts as Concept[];
}
