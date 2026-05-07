// ============================================================
// POST /api/agents/analytics — Run the Analytics Agent
//
// Accepts:
//   {
//     campaign_id: "uuid",                 (required)
//     analysis_type?: "performance_review"  (optional — defaults
//                   | "campaign_recap"       to performance_review)
//                   | "comparison"
//   }
//
// Calls the Analytics agent which:
//   1. Fetches campaign context from brand_campaigns
//   2. Pulls all asset_metrics for the campaign
//   3. Loads posting_packages for distribution context
//   4. Calculates aggregate stats (views, engagement, etc.)
//   5. Sends data to Claude for deep analysis
//   6. Returns structured JSON (grade, insights, recommendations)
//   7. Logs the run to agent_runs
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { runAnalyticsAgent } from '@/lib/agents/analytics-agent';

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
  if (!body.campaign_id) {
    return NextResponse.json(
      { error: 'campaign_id is required' },
      { status: 400 }
    );
  }

  // Validate analysis_type if provided
  const validTypes = ['performance_review', 'campaign_recap', 'comparison'];
  if (body.analysis_type && !validTypes.includes(body.analysis_type)) {
    return NextResponse.json(
      { error: `analysis_type must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const analysis = await runAnalyticsAgent({
      campaign_id: body.campaign_id,
      analysis_type: body.analysis_type,
    });

    return NextResponse.json({
      success: true,
      campaign_id: body.campaign_id,
      analysis_type: body.analysis_type || 'performance_review',
      analysis,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        campaign_id: body.campaign_id,
        error: err instanceof Error ? err.message : 'Analytics agent failed',
      },
      { status: 500 }
    );
  }
}
