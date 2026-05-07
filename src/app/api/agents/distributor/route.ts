// ============================================================
// POST /api/agents/distributor — Run the Distributor Agent
//
// Accepts:
//   {
//     athlete_name: "string",        (required)
//     asset_type: "string",          (required — reel, photo, carousel, video)
//     content_description: "string", (required)
//     final_asset_id?: "uuid",
//     campaign_id?: "uuid"
//   }
//
// Calls the Distributor agent which:
//   1. Optionally fetches campaign brief + final asset context
//   2. Checks existing posting packages to avoid conflicts
//   3. Sends context to Claude for distribution planning
//   4. Returns recommended_platforms, posting_schedule,
//      caption_guidelines, cross_promotion_tips,
//      compliance_reminders, and summary
//   5. Logs the run to agent_runs
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { runDistributorAgent } from '@/lib/agents/distributor-agent';

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

  // Validate required fields
  if (!body.athlete_name || !body.asset_type || !body.content_description) {
    return NextResponse.json(
      { error: 'athlete_name, asset_type, and content_description are required' },
      { status: 400 }
    );
  }

  try {
    const plan = await runDistributorAgent({
      athlete_name: body.athlete_name,
      asset_type: body.asset_type,
      content_description: body.content_description,
      final_asset_id: body.final_asset_id,
      campaign_id: body.campaign_id,
    });

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Distributor agent failed',
      },
      { status: 500 }
    );
  }
}
