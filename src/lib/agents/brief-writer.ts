// ============================================================
// Brief Writer Agent
// Takes an approved concept + its parent campaign brief, returns
// a structured creator/videographer brief composed of typed
// sections (concept, photos, deliverables, do's/don'ts, etc.).
//
// Called by POST /api/creator-briefs/generate.
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createServiceSupabase } from '@/lib/supabase';
import type { CreatorBriefSection } from '@/lib/types/briefs';

// Lazy clients — same pattern as creative-director.ts so the module
// can be imported during build-time page-data collection without env
// vars present.
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

// What we tell Claude to return — gives the model a precise schema
// to fill in. We instruct it to generate ALL eleven section types.
const BRIEF_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      description:
        'Array of brief sections. Generate one of each type below, in this order, with the matching `number` and `title`.',
      minItems: 11,
      maxItems: 11,
    },
  },
  required: ['sections'],
};

const SECTION_BLUEPRINT = `Generate EXACTLY these 11 sections in this order:

01 The Concept (type: "concept")
   content: { description: string, callout?: { title: string, text: string } }

02 Photo Examples (type: "photos")
   content: { description: string, images: { url: string, caption?: string }[] }

03 Video Examples (type: "videos")
   content: { description: string, videos: { url: string, caption?: string }[] }

04 Required Deliverables (type: "deliverables")
   content: {
     video?: { title: string, count: string, description: string, orientation: string },
     photography?: { title: string, minimum: string, style: string }
   }

05 Product Requirements (type: "product_reqs")
   content: { items: { name: string, requirements: string[] }[] }

06 Athlete Requirements (type: "athlete_reqs")
   content: { requirements: string[], tip?: { title: string, text: string } }

07 Creative Direction (type: "creative_direction")
   content: { tone: string[], visual_style: string, lighting_notes: string }

08 Camera & Technical (type: "camera_specs")
   content: {
     video_settings: { frame_rate, resolution, orientation, stabilization, color_profile },
     photography_settings: { format, shutter_speed, aperture, mode },
     lens_recommendation: string
   }

09 Shoot Workflow (type: "workflow")
   content: { steps: { number: number, title: string, description: string }[] }

10 Do's & Don'ts (type: "dos_donts")
   content: { dos: string[], donts: string[] }

11 File Delivery (type: "file_delivery")
   content: {
     video_specs: { format, resolution, color_profile },
     photo_specs: { format, color_grading },
     delivery_method: string,
     deadline: string
   }`;

function buildSystemPrompt(): string {
  return `You are the Brief Writer for Postgame, an NIL marketing agency. You take an approved creative concept and produce a structured, production-ready brief that a videographer and athlete will execute.

PERSONA:
- Professional, confident, specific. These briefs go to real production crews.
- You think in concrete deliverables, camera settings, and shot lists — not vibes.
- You assume the reader is competent but needs explicit direction.

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON. No prose, no markdown fences, no commentary.
- The JSON must be: { "sections": [ ...11 section objects... ] }
- Each section object has: { number, title, type, content }
- ${SECTION_BLUEPRINT}

CONTENT RULES:
- Every mandatory from the campaign brief MUST appear in an appropriate section (deliverables, product_reqs, athlete_reqs, or as a callout in the concept).
- Every restriction MUST appear in the "donts" list of section 10.
- For section 02 (Photo Examples): if reference image URLs are provided in the input, include them in the images array with thoughtful captions. If none are provided, leave images as an empty array but still write a strong description.
- For section 03 (Video Examples): leave videos as an empty array unless reference video URLs are provided. Write a description anyway.
- Camera specs (section 08) must be realistic and specific to the concept's production_scope:
  - ugc_only → assume athlete's iPhone (1080p, 30fps, vertical 9:16)
  - hybrid → mix of phone + DSLR/mirrorless (4K, 24-30fps)
  - full_production → cinema-grade (4K, 24fps, S-Log/LOG color profile, prime lenses)
- Workflow (section 09) should have 4-7 sequential steps that fit the concept and production scope.
- Tone array (section 07) is 2-4 short adjective phrases like "Confident & Game-Ready" or "Clean & Cinematic".
- Be specific. "Use good lighting" is bad. "Shoot during golden hour, last 90 minutes before sunset, with the sun at the athlete's back" is good.`;
}

function buildUserMessage(args: {
  concept: Record<string, unknown>;
  brief: Record<string, unknown>;
  brand: Record<string, unknown>;
  referenceImageUrls: string[];
  athleteName: string | null;
}): string {
  const { concept, brief, brand, referenceImageUrls, athleteName } = args;
  let m = `## CAMPAIGN BRIEF\n\n`;
  m += `**Brand:** ${brand.name || 'Unknown'}\n`;
  m += `**Campaign:** ${brief.name}\n`;
  m += `**Type:** ${brief.campaign_type}\n`;
  m += `**Production Config:** ${brief.production_config}\n`;
  if (brief.start_date) m += `**Start Date:** ${brief.start_date}\n`;
  if (brief.target_launch_date) m += `**Target Launch:** ${brief.target_launch_date}\n`;
  if (brief.budget) m += `**Budget:** $${brief.budget}\n`;

  if (brief.brief_content) {
    m += `\n### Brief Body\n`;
    m += typeof brief.brief_content === 'string'
      ? brief.brief_content
      : JSON.stringify(brief.brief_content, null, 2);
    m += '\n';
  }

  const mandatories = brief.mandatories as string[] | undefined;
  const restrictions = brief.restrictions as string[] | undefined;
  if (mandatories && mandatories.length > 0) {
    m += `\n### MANDATORIES\n`;
    mandatories.forEach((x) => { m += `- ${x}\n`; });
  }
  if (restrictions && restrictions.length > 0) {
    m += `\n### RESTRICTIONS\n`;
    restrictions.forEach((x) => { m += `- ${x}\n`; });
  }

  m += `\n## APPROVED CONCEPT\n`;
  m += `**Name:** ${concept.name}\n`;
  m += `**Hook:** ${concept.hook}\n`;
  if (concept.athlete_archetype) m += `**Athlete Archetype:** ${concept.athlete_archetype}\n`;
  if (Array.isArray(concept.settings_suggestions) && (concept.settings_suggestions as string[]).length > 0) {
    m += `**Settings:** ${(concept.settings_suggestions as string[]).join(', ')}\n`;
  }
  m += `**Production Scope:** ${concept.production_scope}\n`;
  if (concept.estimated_assets) m += `**Estimated Assets:** ${concept.estimated_assets}\n`;

  if (athleteName) {
    m += `\n## ATHLETE\n${athleteName}\n`;
  }

  if (referenceImageUrls.length > 0) {
    m += `\n## REFERENCE IMAGE URLS\n`;
    m += `Use these in section 02 (Photo Examples):\n`;
    referenceImageUrls.forEach((url) => { m += `- ${url}\n`; });
  }

  m += `\n## OUTPUT\nReturn the brief as JSON: { "sections": [...11 sections...] }. No markdown, no prose, no commentary.`;
  return m;
}

// Generate sections for an approved concept. Returns the raw section array
// (the API route is responsible for inserting the creator_briefs row).
export async function generateBriefSections(
  conceptId: string,
  userId: string
): Promise<{
  sections: CreatorBriefSection[];
  concept: Record<string, unknown>;
  campaignBrief: Record<string, unknown>;
  brand: Record<string, unknown>;
  agentRunId: string;
}> {
  const startTime = Date.now();
  const supabase = getSupabase();
  const anthropic = getAnthropic();

  // Step 1: load concept + parent brief + brand
  const { data: concept, error: conceptError } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', conceptId)
    .single();

  if (conceptError || !concept) {
    throw new Error(`Concept not found: ${conceptId}`);
  }

  if (concept.status !== 'approved') {
    throw new Error('Only approved concepts can have a creator brief generated.');
  }

  const { data: brief, error: briefError } = await supabase
    .from('campaign_briefs')
    .select('*')
    .eq('id', concept.brief_id)
    .single();

  if (briefError || !brief) {
    throw new Error(`Campaign brief not found: ${concept.brief_id}`);
  }

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brief.brand_id)
    .single();

  if (brandError || !brand) {
    throw new Error(`Brand not found: ${brief.brand_id}`);
  }

  // Step 2: build prompts
  const systemPrompt = buildSystemPrompt();
  const userMessage = buildUserMessage({
    concept,
    brief,
    brand,
    referenceImageUrls: (concept.reference_image_urls as string[]) || [],
    athleteName: (concept.athlete_name as string | null) || null,
  });

  // Step 3: log run start
  const { data: agentRun, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'brief_writer',
      triggered_by: userId,
      input_payload: {
        system_prompt: systemPrompt,
        user_message: userMessage,
        concept_id: conceptId,
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  if (runError) {
    throw new Error(`Failed to create agent run: ${runError.message}`);
  }

  // Step 4: call Claude
  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
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

  // Step 5: parse response
  const textBlock = response.content.find((b) => b.type === 'text');
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

  let parsed;
  try {
    let json = textBlock.text.trim();
    if (json.startsWith('```')) {
      json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsed = JSON.parse(json);
  } catch {
    // Retry once with a correction prompt
    try {
      const retry = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: textBlock.text },
          {
            role: 'user',
            content: `Your previous response was not valid JSON. Return ONLY the JSON object: { "sections": [...] }. No markdown fences. No prose. Schema:\n${JSON.stringify(BRIEF_OUTPUT_SCHEMA)}`,
          },
        ],
      });
      const retryBlock = retry.content.find((b) => b.type === 'text');
      if (!retryBlock || retryBlock.type !== 'text') throw new Error('retry empty');
      let json = retryBlock.text.trim();
      if (json.startsWith('```')) {
        json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(json);
      response = retry;
    } catch {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse Brief Writer response as JSON after 2 attempts',
          output_payload: { raw_response: textBlock.text },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
      throw new Error('Brief Writer returned malformed JSON twice. Please try again.');
    }
  }

  const sections = parsed.sections || parsed;
  if (!Array.isArray(sections) || sections.length === 0) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: 'Response did not contain a sections array',
        output_payload: parsed,
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);
    throw new Error('Brief Writer did not return any sections');
  }

  // Step 6: log run complete
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  await supabase
    .from('agent_runs')
    .update({
      status: 'complete',
      output_payload: parsed,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRun.id);

  return {
    sections: sections as CreatorBriefSection[],
    concept,
    campaignBrief: brief,
    brand,
    agentRunId: agentRun.id,
  };
}
