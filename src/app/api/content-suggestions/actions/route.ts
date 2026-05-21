// ============================================================
// Content Suggestion Actions — /api/content-suggestions/actions
//
// Handles the approve/deny/variant workflow for AI-generated
// content suggestions.
//
// POST body:
//   { action: 'approve', suggestion: {...}, scheduledFor: '...', channel: '...' }
//     → Inserts into content_queue with status 'approved' + scheduled_for
//
//   { action: 'deny', suggestion: {...}, reason?: '...' }
//     → Stores the denial feedback (optional note)
//
//   { action: 'generate-variants', suggestion: {...} }
//     → Calls Distributor Agent to produce 3 caption variants
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { generateCaptions } from '@/lib/agents/distributor-agent';

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { action, suggestion, scheduledFor, reason } = body;

  if (!action || !suggestion) {
    return NextResponse.json(
      { error: 'action and suggestion are required' },
      { status: 400 },
    );
  }

  // ---- APPROVE ----
  // Pushes the suggestion into content_queue so it shows up
  // on the publishing calendar. Status is 'scheduled' if a
  // date/time was picked, or 'approved' if they want to
  // schedule later.
  if (action === 'approve') {
    const status = scheduledFor ? 'scheduled' : 'approved';

    const record = {
      channel: suggestion.platform || 'instagram',
      caption: suggestion.caption || null,
      hashtags: suggestion.hashtags || [],
      athlete_name: suggestion.relatedAthlete || null,
      notes: [
        `AI Suggestion: ${suggestion.title}`,
        suggestion.assetNotes ? `Asset needed: ${suggestion.assetNotes}` : null,
        suggestion.reasoning ? `Reasoning: ${suggestion.reasoning}` : null,
        `Content type: ${suggestion.contentType}`,
      ].filter(Boolean).join('\n'),
      scheduled_for: scheduledFor || null,
      status,
      created_by: user.id,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('content_queue')
      .insert(record)
      .select()
      .single();

    if (error) {
      console.error('Failed to approve suggestion:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: scheduledFor
        ? `Suggestion approved and scheduled for ${new Date(scheduledFor).toLocaleDateString()}`
        : 'Suggestion approved — schedule it from the Publishing Calendar',
      queueItem: data,
    });
  }

  // ---- DENY ----
  // Stores denial feedback. This gets saved to a
  // suggestion_feedback table if it exists, otherwise
  // we just return success (the note is for future AI context).
  if (action === 'deny') {
    // Try to store feedback — table may not exist yet, that's OK
    try {
      await supabase
        .from('suggestion_feedback')
        .insert({
          suggestion_id: suggestion.id,
          suggestion_title: suggestion.title,
          suggestion_platform: suggestion.platform,
          suggestion_content_type: suggestion.contentType,
          feedback_type: 'denied',
          reason: reason || null,
          created_by: user.id,
        });
    } catch {
      // Table might not exist — that's fine, feedback is optional
      console.log('suggestion_feedback table not found — skipping feedback storage');
    }

    return NextResponse.json({
      success: true,
      message: 'Suggestion denied' + (reason ? ` — ${reason}` : ''),
    });
  }

  // ---- GENERATE VARIANTS ----
  // Calls the existing Distributor Agent to produce 3 caption
  // variants (short/medium/long) for the suggestion's platform.
  if (action === 'generate-variants') {
    try {
      // Build the context the Distributor Agent expects
      const variants = await generateCaptions({
        channel: suggestion.platform || 'instagram',
        athleteName: suggestion.relatedAthlete || 'an athlete',
        brandName: suggestion.relatedBrand || '',
        assetDescription: [
          suggestion.title,
          suggestion.description,
          suggestion.assetNotes,
        ].filter(Boolean).join('. '),
        campaignName: suggestion.relatedBrand ? `${suggestion.relatedBrand} campaign` : undefined,
      });

      return NextResponse.json({
        success: true,
        variants,
      });
    } catch (err) {
      console.error('Failed to generate variants:', err);
      return NextResponse.json(
        { error: 'Failed to generate caption variants' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
