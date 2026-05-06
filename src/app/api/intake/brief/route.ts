// ============================================================
// POST /api/intake/brief — Parse a raw brief document with AI
//
// Accepts a PDF or DOCX file upload. The Intake agent reads
// the document with Claude and extracts structured fields that
// map to the campaign_briefs table. Returns the parsed fields
// for human review before saving.
//
// Flow:
//   1. Upload the brief doc to "brief-documents" storage bucket
//   2. Extract text from the document (PDF → text, DOCX → text)
//   3. Send the text to Claude for structured extraction
//   4. Return parsed fields + confidence flags for AM review
//   5. The AM reviews in the UI, corrects anything, then saves
//
// This does NOT auto-create a brief row. The human always
// reviews and confirms before the structured record is saved.
// ============================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { ParsedBriefFields } from '@/lib/types/intake';

const anthropic = new Anthropic();

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// System prompt for the brief-parsing Intake agent
const BRIEF_PARSE_SYSTEM_PROMPT = `You are the Intake Agent for Postgame, an NIL (Name, Image, Likeness) marketing agency. Your job is to read a raw brand brief document and extract structured data from it.

CONTEXT:
Postgame runs campaigns where brands sponsor college athletes to create social media content. Briefs come from brand clients and describe what they want: campaign goals, deliverables, creative direction, athlete requirements, timelines, and restrictions.

YOUR TASK:
Read the brief text below and extract every structured field you can. If a field is clearly stated, extract it. If a field is implied but not explicit, make your best inference and flag it with low confidence. If a field is not mentioned at all, leave it null.

CRITICAL RULES:
1. Be precise. "Must include product in first 3 seconds" is a mandatory. "Would be nice to show the product" is not.
2. Separate mandatories (hard requirements) from restrictions (things to avoid).
3. Extract ALL deadlines you can find — shoot date, edit deadline, launch date, any date.
4. For campaign_type, choose the best match from: standard, top_50, ambassador_program, gifting, experiential, recap_only.
5. Flag anything you're not confident about in confidence_flags. The AM will review these.
6. The raw_summary should be a plain-English 3-4 sentence summary that an AM can skim to verify you understood the brief.

OUTPUT: Return ONLY valid JSON. No extra text, no markdown code fences.`;

const BRIEF_PARSE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Campaign/brief title' },
    campaign_type: { type: 'string', enum: ['standard', 'top_50', 'ambassador_program', 'gifting', 'experiential', 'recap_only', null] },
    brand_name: { type: 'string', description: 'Brand name from the brief' },
    campaign_goal: { type: 'string', description: 'What the brand wants to achieve' },
    deliverables: { type: 'array', items: { type: 'string' }, description: 'Required deliverables' },
    vibe_descriptors: { type: 'array', items: { type: 'string' }, description: 'Tone/mood/vibe words' },
    mandatories: { type: 'array', items: { type: 'string' }, description: 'Hard must-include items' },
    restrictions: { type: 'array', items: { type: 'string' }, description: 'Do-not-mention items' },
    deadlines: { type: 'object', description: 'Key dates found, e.g. { "shoot_date": "2026-06-15", "launch": "2026-07-01" }' },
    athlete_notes: { type: 'string', description: 'Athlete preferences mentioned' },
    budget_notes: { type: 'string', description: 'Budget info found' },
    color_palette: { type: 'array', items: { type: 'string' }, description: 'Brand colors mentioned' },
    raw_summary: { type: 'string', description: 'Plain-English 3-4 sentence summary' },
    confidence_flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          reason: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
    },
  },
  required: ['name', 'raw_summary', 'confidence_flags'],
};

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const startTime = Date.now();

  // Parse the form data
  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // --- Step 1: Upload to brief-documents bucket ---
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${new Date().toISOString().split('T')[0]}/${timestamp}_${sanitizedName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await adminSupabase.storage
    .from('brief-documents')
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // --- Step 2: Extract text from the document ---
  // For PDFs, we send the raw file to Claude as a document
  // For text/docx, we extract the text content
  let documentContent: Anthropic.Messages.ContentBlockParam[];

  if (file.type === 'application/pdf') {
    // Send PDF directly to Claude as a base64 document
    const base64 = fileBuffer.toString('base64');
    documentContent = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      },
      {
        type: 'text',
        text: `Parse this brand brief document and extract structured fields as JSON.\n\nSchema:\n${JSON.stringify(BRIEF_PARSE_SCHEMA, null, 2)}`,
      },
    ];
  } else {
    // For non-PDF files, extract text and send as plain text
    const textContent = fileBuffer.toString('utf-8');
    documentContent = [
      {
        type: 'text',
        text: `Parse this brand brief and extract structured fields as JSON.\n\n--- BRIEF DOCUMENT ---\n${textContent}\n--- END DOCUMENT ---\n\nSchema:\n${JSON.stringify(BRIEF_PARSE_SCHEMA, null, 2)}`,
      },
    ];
  }

  // --- Step 3: Create agent_runs record ---
  const { data: agentRun, error: runError } = await adminSupabase
    .from('agent_runs')
    .insert({
      agent_name: 'intake',
      triggered_by: user.id,
      input_payload: {
        action: 'brief_parse',
        file_name: file.name,
        file_type: file.type,
        storage_path: storagePath,
      },
      model: 'claude-sonnet-4-20250514',
      status: 'running',
    })
    .select()
    .single();

  if (runError) {
    return NextResponse.json(
      { error: `Failed to create agent run: ${runError.message}` },
      { status: 500 }
    );
  }

  // --- Step 4: Call Claude to parse the brief ---
  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: BRIEF_PARSE_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: documentContent },
      ],
    });
  } catch (err) {
    await adminSupabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Claude API call failed',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);

    return NextResponse.json(
      { error: 'Failed to parse brief with AI. Please try again.' },
      { status: 500 }
    );
  }

  // --- Step 5: Parse Claude's response ---
  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    await adminSupabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: 'Claude returned no text content',
        duration_ms: Date.now() - startTime,
      })
      .eq('id', agentRun.id);

    return NextResponse.json(
      { error: 'AI returned no content' },
      { status: 500 }
    );
  }

  let parsedBrief: ParsedBriefFields;
  try {
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    parsedBrief = JSON.parse(jsonText);
  } catch {
    // Retry once
    try {
      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: BRIEF_PARSE_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: documentContent },
          { role: 'assistant', content: textBlock.text },
          { role: 'user', content: 'Your response was not valid JSON. Return ONLY valid JSON, no markdown.' },
        ],
      });

      const retryBlock = retryResponse.content.find((b) => b.type === 'text');
      if (retryBlock && retryBlock.type === 'text') {
        let retryJson = retryBlock.text.trim();
        if (retryJson.startsWith('```')) {
          retryJson = retryJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        parsedBrief = JSON.parse(retryJson);
        response = retryResponse;
      } else {
        throw new Error('Retry returned no text');
      }
    } catch {
      await adminSupabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: 'Failed to parse brief response as JSON after 2 attempts',
          output_payload: { raw_response: textBlock.text },
          duration_ms: Date.now() - startTime,
        })
        .eq('id', agentRun.id);

      return NextResponse.json(
        { error: 'AI returned malformed data twice. Please try again.' },
        { status: 500 }
      );
    }
  }

  // --- Step 6: Log success ---
  const inputTokens = response.usage?.input_tokens || 0;
  const outputTokens = response.usage?.output_tokens || 0;
  const costUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000;

  await adminSupabase
    .from('agent_runs')
    .update({
      status: 'complete',
      output_payload: parsedBrief,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
    })
    .eq('id', agentRun.id);

  // Return the parsed fields for human review
  // The UI will show these fields with edit controls.
  // The AM confirms and THEN a campaign_briefs row gets created.
  return NextResponse.json({
    success: true,
    parsed_fields: parsedBrief,
    source_document: {
      file_name: file.name,
      storage_path: storagePath,
    },
    agent_run_id: agentRun.id,
  });
}
