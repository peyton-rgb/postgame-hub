// ============================================================
// POST /api/agents/editor — Run the Editor Agent on a rough cut
//
// Accepts:
//   { review_session_id: "uuid", creator_brief_id?: "uuid" }
//
// Calls the Editor agent which:
//   1. Fetches the review session (video_url, asset_name)
//   2. Optionally loads the creator brief for context
//   3. Sends context to Claude for structured edit review
//   4. Returns overall_score, pacing/shot/audio/color notes,
//      brand_compliance, recommended_cuts, and final_verdict
//   5. Logs the run to agent_runs
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { runEditorAgent } from '@/lib/agents/editor-agent';

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  // Validate required field
  if (!body.review_session_id) {
    return NextResponse.json(
      { error: 'review_session_id is required' },
      { status: 400 }
    );
  }

  try {
    const analysis = await runEditorAgent({
      review_session_id: body.review_session_id,
      creator_brief_id: body.creator_brief_id,
    });

    return NextResponse.json({
      success: true,
      review_session_id: body.review_session_id,
      analysis,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        review_session_id: body.review_session_id,
        error: err instanceof Error ? err.message : 'Editor agent failed',
      },
      { status: 500 }
    );
  }
}
