// ============================================================
// Intake Agent — Station 1 Content Tagger
//
// What it does:
//   1. Takes an inspo_items record that has a file_url (image or
//      video thumbnail stored in Supabase Storage)
//   2. Sends the image to Claude Vision for analysis
//   3. Claude tags it across 13 categories organized into three
//      groups: pro_tags, social_tags, context_tags
//   4. Also generates a visual_description, vibe words, and
//      brief_fit keywords
//   5. Saves the tags back to the inspo_items row
//   6. Logs everything to agent_runs for auditing
//
// The 13 tag categories (from the Blueprint v2):
//   PRO (how it was shot):
//     1. camera_movement    2. lighting
//     3. lens_shot_type     4. grade_post_style
//   SOCIAL (how it feels on platforms):
//     5. trend_format       6. platform_feel
//     7. audience_energy
//   CONTEXT (what it's about):
//     8. sport              9. setting
//     10. product_category  11. athlete_identity
//     12. content_purpose
//   PLUS:
//     13. vibe_words (stored in search_phrases)
//
// This function is called by POST /api/intake/tag
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import type { IntakeTagResult } from '@/lib/types/intake';

// Initialize the Anthropic client (reads ANTHROPIC_API_KEY from env)
const anthropic = new Anthropic();

// Admin Supabase client for full access (same pattern as creative-director.ts)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// The JSON schema Claude must follow when tagging content.
// This tells Claude exactly what shape to return.
// Organized into the original 13 creative categories PLUS new
// Postgame-specific categories for the two-gate approval flow.
const TAG_OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    // --- ORIGINAL 13 CREATIVE TAGS (how it was shot + platform feel) ---
    pro_tags: {
      type: 'object' as const,
      properties: {
        camera_movement: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'How the camera moves. Examples: handheld, dolly, static, tracking, drone, whip_pan, steadicam, tripod, gimbal, pov',
        },
        lighting: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Lighting conditions. Examples: golden_hour, studio, natural, neon, overcast, harsh_sun, soft_diffused, backlit, dramatic_shadow, mixed',
        },
        lens_shot_type: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Lens and framing. Examples: wide, close_up, medium, overhead, macro, ultra_wide, portrait, dutch_angle, split_screen, rack_focus',
        },
        grade_post_style: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Color grading / post style. Examples: warm_film, clean_digital, desaturated, high_contrast, vintage, pastel, dark_moody, vibrant, muted_tones, black_and_white',
        },
      },
      required: ['camera_movement', 'lighting', 'lens_shot_type', 'grade_post_style'],
    },
    social_tags: {
      type: 'object' as const,
      properties: {
        trend_format: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Social media format. Examples: get_ready_with_me, day_in_life, transition, outfit_check, haul, pov_skit, talking_head, montage, before_after, tutorial',
        },
        platform_feel: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Which platform this feels native to. Examples: tiktok_native, ig_editorial, ig_story, youtube_cinematic, linkedin_polished, twitter_raw, snapchat_casual',
        },
        audience_energy: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Emotional energy for the audience. Examples: hype, chill, aspirational, relatable, bold, playful, intense, wholesome, edgy, motivational',
        },
      },
      required: ['trend_format', 'platform_feel', 'audience_energy'],
    },
    context_tags: {
      type: 'object' as const,
      properties: {
        sport: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Sports visible or implied. Examples: football, basketball, soccer, track, volleyball, baseball, tennis, golf, swimming, gymnastics, lacrosse, softball, general_athletic',
        },
        setting: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Where the content takes place. Examples: campus, gym, outdoor_court, studio, urban_street, locker_room, field, dorm, restaurant, car, beach, home, rooftop',
        },
        product_category: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Product types visible. Examples: footwear, apparel, equipment, food_bev, tech, beauty, accessories, supplements, none_visible',
        },
        athlete_identity: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'How athletes are presented. Examples: solo, duo, team, lifestyle, action_shot, posed, candid, behind_scenes, pre_game, post_game, training',
        },
        content_purpose: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'What the content is for. Examples: brand_campaign, bts, product_showcase, lifestyle, game_day, unboxing, review, announcement, hype_video, tutorial',
        },
      },
      required: ['sport', 'setting', 'product_category', 'athlete_identity', 'content_purpose'],
    },

    // --- NEW POSTGAME-SPECIFIC TAGS (what the editing agent needs) ---
    shot_type: {
      type: 'string' as const,
      description: 'Primary shot type. One of: close_up, medium, wide, aerial, pov, overhead, detail, full_body',
    },
    scene_setting: {
      type: 'string' as const,
      description: 'Primary scene location. One of: outdoor_field, indoor_gym, locker_room, restaurant, campus, studio, urban_street, home, car, stadium, weight_room, pool, court',
    },
    action_description: {
      type: 'string' as const,
      description: 'One sentence describing the primary action. e.g. "Athlete eating chicken fingers at Raising Cane\'s counter" or "Running drills on practice field at sunset"',
    },
    mood_tags: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Mood and vibe of the content. 2-5 tags. Examples: hype, focused, candid, cinematic, playful, intimate, gritty, energetic, relaxed, confident, intense, joyful',
    },
    people_count: {
      type: 'number' as const,
      description: 'Number of people clearly visible in the frame. Use 0 if no people visible.',
    },
    content_quality: {
      type: 'string' as const,
      description: 'Quality tier of this content. One of: a_roll_hero (best shots, hero moments), b_roll_support (good supporting footage), bts_candid (behind the scenes, raw moments), filler (background, transition material)',
    },

    // --- KEPT FROM ORIGINAL ---
    vibe_words: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Free-form vibe / mood keywords. 5-10 words that capture the feel. Examples: golden_hour, kinetic, y2k, elevated_casual, raw_energy, premium, playful, gritty, clean, street',
    },
    visual_description: {
      type: 'string' as const,
      description: 'A 2-3 sentence description of what is visually happening in this content. Be specific about subjects, actions, composition, and mood.',
    },
    brief_fit: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'What kinds of campaign briefs this content could serve. 3-5 keywords. Examples: athletic_lifestyle, product_launch, social_first, premium_brand, ugc_style, game_day, off_court_vibe',
    },
  },
  required: ['pro_tags', 'social_tags', 'context_tags', 'shot_type', 'scene_setting', 'action_description', 'mood_tags', 'people_count', 'content_quality', 'vibe_words', 'visual_description', 'brief_fit'],
};

// The system prompt that establishes the Intake agent persona
const SYSTEM_PROMPT = `You are the Intake Agent for Postgame, an NIL (Name, Image, Likeness) marketing agency. Your job is to analyze visual content — photos and video frames from brand campaigns featuring college athletes — and tag them with precise, searchable metadata.

WHY THIS MATTERS:
Every piece of content you tag becomes part of Postgame's creative memory. When the Creative Director agent proposes concepts for future campaigns, it searches this library by tags. Your tags directly determine what gets surfaced as inspiration. Bad tags mean good content gets buried. Good tags mean the right content appears at the right moment.

TAGGING RULES:
1. Be specific, not generic. "golden_hour" beats "nice lighting." "outdoor_court" beats "outside."
2. Use lowercase_snake_case for all tags. No spaces, no capitals.
3. Each category should have 1-5 tags. Don't force tags that don't apply — "none_visible" is valid for product_category.
4. For vibe_words, think like a creative director browsing Pinterest. What search terms would find this?
5. For brief_fit, think: what kind of campaign would want content like this?
6. The visual_description should be factual and useful — "Two athletes in Nike training gear doing partner drills on an outdoor court at sunset, shot handheld with a warm film look" not "cool sports photo."

OUTPUT: Return ONLY valid JSON matching the schema. No extra text, no markdown.`;

/**
 * Tag a single inspo_items record using Claude Vision.
 *
 * @param inspoItemId - The UUID of the inspo_items row to tag
 * @param userId - The UUID of the user who triggered the tagging
 * @returns The tag result that was saved
 */
export async function tagInspoItem(
  inspoItemId: string,
  userId: string
): Promise<IntakeTagResult> {
  const startTime = Date.now();

  // --- Step 1: Load the inspo_items record ---
  const { data: item, error: itemError } = await supabase
    .from('inspo_items')
    .select('*')
    .eq('id', inspoItemId)
    .single();

  if (itemError || !item) {
    throw new Error(`Inspo item not found: ${inspoItemId}`);
  }

  // Get the image URL — use thumbnail_url for videos, file_url for images
  const imageUrl = item.thumbnail_url || item.file_url;
  if (!imageUrl) {
    throw new Error(`Inspo item ${inspoItemId} has no file_url or thumbnail_url to analyze`);
  }

  // --- Step 2: Mark as processing ---
  await supabase
    .from('inspo_items')
    .update({ tagging_status: 'processing' })
    .eq('id', inspoItemId);

  // --- Step 3: Create agent_runs record (status: running) ---
  const { data: agentRun, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      agent_name: 'intake',
      triggered_by: userId,
      input_payload: {
        inspo_item_id: inspoItemId,
        image_url: imageUrl,
        content_type: item.content_type,
        source: item.source,
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  if (runError) {
    throw new Error(`Failed to create agent run record: ${runError.message}`);
  }

  // --- Step 4: Call Claude Vision ---
  let response;
  try {
    // Fetch the image as base64 for Claude Vision
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Determine the media type from the response headers or file extension
    const contentTypeHeader = imageResponse.headers.get('content-type') || 'image/jpeg';
    // Claude Vision accepts: image/jpeg, image/png, image/gif, image/webp
    const mediaType = contentTypeHeader.startsWith('image/')
      ? contentTypeHeader.split(';')[0] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
      : 'image/jpeg';

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analyze this content and return structured tags as JSON.\n\nContext: This is ${item.content_type} content from source "${item.source}"${item.sport ? `, sport: ${item.sport}` : ''}${item.athlete_name ? `, athlete: ${item.athlete_name}` : ''}.\n\nReturn JSON matching the tag schema.`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    // Log the failure
    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Claude Vision call failed',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);

    // Mark the item as failed
    await supabase
      .from('inspo_items')
      .update({ tagging_status: 'failed' })
      .eq('id', inspoItemId);

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
    await supabase
      .from('inspo_items')
      .update({ tagging_status: 'failed' })
      .eq('id', inspoItemId);
    throw new Error('Claude returned no text content');
  }

  let tagResult: IntakeTagResult;
  try {
    // Strip markdown code fences if present
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    tagResult = JSON.parse(jsonText) as IntakeTagResult;
  } catch (parseErr) {
    // Retry once with a correction prompt
    console.warn('First JSON parse failed for tagging, retrying...');
    try {
      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: '', // We won't re-send the image on retry
                },
              },
              { type: 'text', text: 'Analyze this content and return structured tags as JSON.' },
            ],
          },
          { role: 'assistant', content: textBlock.text },
          {
            role: 'user',
            content: `Your previous response was not valid JSON. Return ONLY a valid JSON object, no extra text. Schema:\n${JSON.stringify(TAG_OUTPUT_SCHEMA, null, 2)}`,
          },
        ],
      });

      const retryBlock = retryResponse.content.find((b) => b.type === 'text');
      if (retryBlock && retryBlock.type === 'text') {
        let retryJson = retryBlock.text.trim();
        if (retryJson.startsWith('```')) {
          retryJson = retryJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        tagResult = JSON.parse(retryJson) as IntakeTagResult;
        response = retryResponse;
      } else {
        throw new Error('Retry returned no text');
      }
    } catch {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse Claude tagging response after 2 attempts',
          output_payload: { raw_response: textBlock.text },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);
      await supabase
        .from('inspo_items')
        .update({ tagging_status: 'failed' })
        .eq('id', inspoItemId);
      throw new Error('Claude returned malformed JSON twice during tagging. Please retry.');
    }
  }

  // --- Step 6: Save tags to inspo_items ---
  // Save both the original 13 creative tags AND the new Postgame-specific tags.
  // Also look up the athlete's tier from the brief/roster if available.
  let athleteTier: number | null = null;
  if (item.brand_id) {
    // Try to find athlete tier from campaign_briefs athlete_roster
    const { data: briefs } = await supabase
      .from('campaign_briefs')
      .select('athlete_roster')
      .eq('brand_id', item.brand_id)
      .not('athlete_roster', 'is', null);

    if (briefs) {
      for (const brief of briefs) {
        const roster = (brief.athlete_roster || []) as Array<{ name: string; tier?: number }>;
        const match = roster.find((a) =>
          a.name && item.athlete_name &&
          a.name.toLowerCase() === item.athlete_name.toLowerCase()
        );
        if (match?.tier) {
          athleteTier = match.tier;
          break;
        }
      }
    }
  }

  // Check brand approval settings to determine if auto-approve applies
  let triageStatus = 'pending';
  if (athleteTier && item.brand_id) {
    const { data: brand } = await supabase
      .from('brands')
      .select('approval_settings')
      .eq('id', item.brand_id)
      .single();

    if (brand?.approval_settings) {
      const settings = brand.approval_settings as { auto_approve_tiers?: number[] };
      if (settings.auto_approve_tiers?.includes(athleteTier)) {
        triageStatus = 'auto_approved';
      }
    }
  }

  const { error: updateError } = await supabase
    .from('inspo_items')
    .update({
      // Original creative tags
      pro_tags: tagResult.pro_tags,
      social_tags: tagResult.social_tags,
      context_tags: tagResult.context_tags,
      search_phrases: tagResult.vibe_words,
      brief_fit: tagResult.brief_fit,
      visual_description: tagResult.visual_description,
      // New Postgame-specific tags
      shot_type: tagResult.shot_type,
      scene_setting: tagResult.scene_setting,
      action_description: tagResult.action_description,
      mood_tags: tagResult.mood_tags,
      people_count: tagResult.people_count,
      content_quality: tagResult.content_quality,
      // Tier + approval
      athlete_tier: athleteTier,
      triage_status: triageStatus,
      tagging_status: 'tagged',
    })
    .eq('id', inspoItemId);

  if (updateError) {
    throw new Error(`Failed to save tags: ${updateError.message}`);
  }

  // --- Step 7: Update agent_runs with success ---
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  await supabase
    .from('agent_runs')
    .update({
      status: 'complete',
      output_payload: tagResult,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRun.id);

  return tagResult;
}

/**
 * Tag multiple inspo_items in sequence.
 * Useful for batch processing uploads.
 *
 * @param inspoItemIds - Array of UUIDs to tag
 * @param userId - The UUID of the user who triggered the batch
 * @returns Array of results (successes and failures)
 */
export async function tagBatch(
  inspoItemIds: string[],
  userId: string
): Promise<{ id: string; success: boolean; result?: IntakeTagResult; error?: string }[]> {
  const results = [];

  for (const id of inspoItemIds) {
    try {
      const result = await tagInspoItem(id, userId);
      results.push({ id, success: true, result });
    } catch (err) {
      results.push({
        id,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}
