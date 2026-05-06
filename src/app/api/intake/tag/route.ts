// ============================================================
// POST /api/intake/tag — Run Claude Vision tagging on inspo items
//
// Two modes:
//   - Single: { inspo_item_id: "uuid" }
//   - Batch:  { inspo_item_ids: ["uuid1", "uuid2", ...] }
//
// Calls the Intake agent which:
//   1. Fetches the image from Supabase Storage
//   2. Sends it to Claude Vision for 13-category tagging
//   3. Saves the tags back to the inspo_items row
//   4. Logs the run to agent_runs
// ============================================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { tagInspoItem, tagBatch } from '@/lib/agents/intake-agent';

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  // --- Single item tagging ---
  if (body.inspo_item_id) {
    try {
      const result = await tagInspoItem(body.inspo_item_id, user.id);
      return NextResponse.json({
        success: true,
        inspo_item_id: body.inspo_item_id,
        tags: result,
      });
    } catch (err) {
      return NextResponse.json({
        success: false,
        inspo_item_id: body.inspo_item_id,
        error: err instanceof Error ? err.message : 'Tagging failed',
      }, { status: 500 });
    }
  }

  // --- Batch tagging ---
  if (body.inspo_item_ids && Array.isArray(body.inspo_item_ids)) {
    if (body.inspo_item_ids.length > 20) {
      return NextResponse.json(
        { error: 'Batch size limited to 20 items at a time' },
        { status: 400 }
      );
    }

    const results = await tagBatch(body.inspo_item_ids, user.id);
    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      results,
      total: body.inspo_item_ids.length,
      successful: successCount,
      failed: body.inspo_item_ids.length - successCount,
    });
  }

  return NextResponse.json(
    { error: 'Provide inspo_item_id (single) or inspo_item_ids (batch)' },
    { status: 400 }
  );
}
