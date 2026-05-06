// ============================================================
// Brief Writer Agent
//
// Takes an approved concept + its parent campaign brief and
// generates a structured creator/videographer brief with
// numbered sections. The output is a JSON array of sections
// that gets saved to the creator_briefs table.
//
// The shoot_logistics section (section 00) is always included
// as a placeholder — the AM fills in contacts and times via
// the editor before publishing.
//
// Called by POST /api/creator-briefs/generate
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { CreatorBrief, CreatorBriefSection } from '@/lib/types/briefs';

const anthropic = new Anthropic();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---- System prompt for the Brief Writer ----
const BRIEF_WRITER_SYSTEM_PROMPT = `You are the Brief Writer for Postgame, an NIL marketing agency. Your job is to take an approved creative concept and its parent campaign brief, then produce a complete, professional videographer/creator brief.

CONTEXT:
Postgame runs campaigns where brands sponsor college athletes to create social media content. A campaign brief describes what the brand wants. A concept is a specific creative direction approved by the campaign manager. Your job is to turn that concept into a structured, actionable brief that a videographer can follow on set.

YOUR OUTPUT:
Generate a JSON array of sections. Each section has:
- "number": a two-digit string ("01", "02", etc.)
- "title": the section heading
- "type": one of the defined section types
- "content": an object matching that section type's schema

SECTION TYPES (generate in this order):
1. concept — The creative concept overview. Include a description paragraph and optionally a callout for critical info.
2. photos — Reference photo guidance. Describe what kinds of photos to look for. Include any reference image URLs from the concept.
3. videos — Reference video guidance. Describe the video style and approach.
4. deliverables — Required deliverables. Break into video and photography sections with counts, formats, and orientation.
5. product_reqs — Product/brand requirements. List each product or brand element with its specific requirements.
6. athlete_reqs — What the athlete needs to do. Bullet list of requirements plus an optional pro tip.
7. creative_direction — Tone badges, visual style description, and lighting notes.
8. camera_specs — Technical camera settings for video and photography, plus lens recommendations.
9. workflow — Step-by-step shoot workflow. Number each step with a title and description.
10. dos_donts — Do's and Don'ts lists. Be specific and actionable.
11. file_delivery — File specs, delivery method, and deadline.

RULES:
- Be specific and actionable. A videographer reads this on their way to a shoot.
- Pull all mandatories from the campaign brief into the appropriate sections (product_reqs, athlete_reqs, dos_donts).
- Pull all restrictions into the Don'ts.
- Match the concept's creative direction — if the concept says "cinematic," the camera specs should reflect that.
- Generate realistic camera specs appropriate to the production scope (ugc_only = phone-friendly, full_production = pro specs).
- The workflow should be practical and ordered logically for a real shoot day.
- Return ONLY valid JSON — an array of section objects. No markdown, no extra text.`;

// ---- Slug generator ----
function generateSlug(brandName: string, conceptName: string): string {
  const base = `${brandName}-${conceptName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const shortId = Math.random().toString(36).slice(2, 8);
  return `${base}-${shortId}`;
}

// ---- Build the user message ----
function buildBriefWriterMessage(
  concept: Record<string, unknown>,
  brief: Record<string, unknown>,
  brand: Record<string, unknown>
): string {
  let msg = `## APPROVED CONCEPT\n\n`;
  msg += `**Name:** ${concept.name}\n`;
  msg += `**Hook:** ${concept.hook}\n`;
  if (concept.athlete_archetype) msg += `**Athlete Archetype:** ${concept.athlete_archetype}\n`;
  if (concept.athlete_name) msg += `**Assigned Athlete:** ${concept.athlete_name}\n`;
  msg += `**Production Scope:** ${concept.production_scope}\n`;
  msg += `**Estimated Assets:** ${concept.estimated_assets || 'TBD'}\n`;

  const settings = concept.settings_suggestions as string[] | undefined;
  if (settings && settings.length > 0) {
    msg += `**Settings:** ${settings.join(', ')}\n`;
  }

  const refImages = concept.reference_image_urls as string[] | undefined;
  if (refImages && refImages.length > 0) {
    msg += `\n### Reference Images (${refImages.length})\n`;
    refImages.forEach((url, i) => { msg += `- Ref ${i + 1}: ${url}\n`; });
  }

  msg += `\n## CAMPAIGN BRIEF\n\n`;
  msg += `**Brand:** ${brand.name || 'Unknown'}\n`;
  msg += `**Campaign:** ${brief.name}\n`;
  msg += `**Type:** ${brief.campaign_type}\n`;
  msg += `**Production Config:** ${brief.production_config}\n`;

  if (brief.brief_content) {
    msg += `\n### Brief Content\n`;
    msg += typeof brief.brief_content === 'string'
      ? brief.brief_content
      : JSON.stringify(brief.brief_content, null, 2);
    msg += '\n';
  }

  const mandatories = brief.mandatories as string[] | undefined;
  if (mandatories && mandatories.length > 0) {
    msg += `\n### MANDATORIES (must appear in the brief)\n`;
    mandatories.forEach((m) => { msg += `- ${m}\n`; });
  }

  const restrictions = brief.restrictions as string[] | undefined;
  if (restrictions && restrictions.length > 0) {
    msg += `\n### RESTRICTIONS (must appear in Don'ts)\n`;
    restrictions.forEach((r) => { msg += `- ${r}\n`; });
  }

  if (brief.athlete_targeting) {
    msg += `\n### Athlete Targeting\n${JSON.stringify(brief.athlete_targeting, null, 2)}\n`;
  }

  msg += `\n## OUTPUT\nReturn a JSON array of section objects matching the defined section types. Start with section "01" (concept). Do NOT include a shoot_logistics section — that is added separately.`;

  return msg;
}

/**
 * Generates a creator brief from an approved concept.
 *
 * @param conceptId — UUID of the approved concept
 * @param userId — UUID of the user triggering generation
 * @returns The created creator_briefs record
 */
export async function generateCreatorBrief(
  conceptId: string,
  userId: string
): Promise<CreatorBrief> {
  const startTime = Date.now();

  // --- Load concept ---
  const { data: concept, error: conceptError } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', conceptId)
    .single();

  if (conceptError || !concept) {
    throw new Error(`Concept not found: ${conceptId}`);
  }

  if (concept.status !== 'approved') {
    throw new Error('Only approved concepts can generate creator briefs');
  }

  // --- Load parent brief + brand ---
  const { data: brief } = await supabase
    .from('campaign_briefs')
    .select('*')
    .eq('id', concept.brief_id)
    .single();

  if (!brief) throw new Error(`Campaign brief not found: ${concept.brief_id}`);

  const { data: brand } = await supabase
    .from('brands')
    .select('*')
    .eq('id', brief.brand_id)
    .single();

  if (!brand) throw new Error(`Brand not found: ${brief.brand_id}`);

  // --- Create agent run record ---
  const { data: agentRun, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'brief_writer',
      triggered_by: userId,
      input_payload: {
        concept_id: conceptId,
        brief_id: concept.brief_id,
        brand_id: brief.brand_id,
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  if (runError) throw new Error(`Failed to create agent run: ${runError.message}`);

  // --- Call Claude ---
  const userMessage = buildBriefWriterMessage(concept, brief, brand);
  let response;

  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: BRIEF_WRITER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Claude API failed',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);
    throw err;
  }

  // --- Parse response ---
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    await supabase
      .from('agent_runs')
      .update({ status: 'failed', error_message: 'No text in response', duration_ms: Date.now() - startTime })
      .eq('id', agentRun.id);
    throw new Error('Claude returned no text');
  }

  let sections: CreatorBriefSection[];
  try {
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    sections = JSON.parse(jsonText);
  } catch {
    // Retry once
    try {
      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: BRIEF_WRITER_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: textBlock.text },
          { role: 'user', content: 'Not valid JSON. Return ONLY a JSON array of section objects. No markdown.' },
        ],
      });
      const retryBlock = retryResponse.content.find((b) => b.type === 'text');
      if (retryBlock && retryBlock.type === 'text') {
        let retryJson = retryBlock.text.trim();
        if (retryJson.startsWith('```')) {
          retryJson = retryJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        sections = JSON.parse(retryJson);
        response = retryResponse;
      } else {
        throw new Error('Retry returned no text');
      }
    } catch {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse JSON after 2 attempts',
          output_payload: { raw: textBlock.text },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
      throw new Error('Brief Writer returned malformed JSON twice');
    }
  }

  if (!Array.isArray(sections) || sections.length === 0) {
    await supabase
      .from('agent_runs')
      .update({ status: 'failed', error_message: 'Empty sections array', duration_ms: Date.now() - startTime })
      .eq('id', agentRun.id);
    throw new Error('Brief Writer returned no sections');
  }

  // --- Prepend the shoot_logistics placeholder (section 00) ---
  // The AM fills this in via the editor before publishing.
  const shootLogisticsSection: CreatorBriefSection = {
    number: '00',
    title: 'Shoot Logistics',
    type: 'shoot_logistics',
    content: {
      shoot_date: null,
      shoot_time: null,
      location: null,
      postgame_contacts: [],
      videographer: null,
    },
  };

  // Re-number the AI-generated sections starting at 01
  const numberedSections = sections.map((s, i) => ({
    ...s,
    number: String(i + 1).padStart(2, '0'),
  }));

  const allSections = [shootLogisticsSection, ...numberedSections];

  // --- Build title ---
  const title = concept.athlete_name
    ? `${brief.name} (${concept.athlete_name}) — ${concept.name}`
    : `${brief.name} — ${concept.name}`;

  // --- Save to database ---
  const slug = generateSlug(brand.name || 'brand', concept.name || 'brief');

  const { data: creatorBrief, error: saveError } = await supabase
    .from('creator_briefs')
    .insert({
      concept_id: conceptId,
      brief_id: concept.brief_id,
      brand_id: brief.brand_id,
      slug,
      title,
      athlete_name: concept.athlete_name || null,
      sections: allSections,
      reference_images: concept.reference_image_urls || [],
      brand_color: null, // AM sets this in the editor
      brand_logo_url: null,
      status: 'draft',
      created_by: userId,
    })
    .select()
    .single();

  if (saveError) throw new Error(`Failed to save creator brief: ${saveError.message}`);

  // --- Log success ---
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  await supabase
    .from('agent_runs')
    .update({
      status: 'complete',
      output_payload: { sections: allSections, slug, creator_brief_id: creatorBrief.id },
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRun.id);

  return creatorBrief as CreatorBrief;
}
