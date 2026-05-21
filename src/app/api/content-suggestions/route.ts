// ============================================================
// Content Suggestions API — /api/content-suggestions
//
// Endpoints:
//   GET  — returns platform strategies (static) + content gaps
//   POST — generates on-demand suggestions or weekly calendar
//
// Query params (GET):
//   ?type=strategy   — returns static platform strategy data
//   ?type=gaps       — AI-analyzed content gaps
//
// POST body:
//   { action: 'suggest', platform: 'instagram'|'all', count: 5 }
//   { action: 'calendar', platform: 'instagram', startDate?: '2026-05-26' }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

// Tell Vercel to allow up to 60 seconds for this route
// (AI generation takes longer than the default 10s limit)
export const maxDuration = 60;
import { createServerSupabase } from '@/lib/supabase-server';
import {
  PLATFORM_STRATEGY,
  generateOnDemandSuggestions,
  generateWeeklyCalendar,
  analyzeContentGaps,
} from '@/lib/agents/content-strategist';

// --- Gather Hub context from Supabase ---

async function gatherHubContext(supabase: ReturnType<typeof createServerSupabase>) {
  // Fetch recent briefs
  const { data: briefs } = await supabase
    .from('briefs')
    .select('id, brand_name, athlete_name, campaign_type, status, sport')
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch upcoming scheduled content
  const { data: scheduled } = await supabase
    .from('content_queue')
    .select('channel, athlete_name, caption, scheduled_for')
    .eq('status', 'scheduled')
    .order('scheduled_for', { ascending: true })
    .limit(20);

  // Extract unique brands and athletes
  const activeBrands = [...new Set((briefs || []).map(b => b.brand_name).filter(Boolean))];
  const activeAthletes = [...new Set((briefs || []).map(b => b.athlete_name).filter(Boolean))];

  // High-profile = brands and athletes that appear in multiple briefs
  const brandCounts: Record<string, number> = {};
  const athleteCounts: Record<string, number> = {};
  (briefs || []).forEach(b => {
    if (b.brand_name) brandCounts[b.brand_name] = (brandCounts[b.brand_name] || 0) + 1;
    if (b.athlete_name) athleteCounts[b.athlete_name] = (athleteCounts[b.athlete_name] || 0) + 1;
  });

  const highProfileBrands = Object.entries(brandCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const highProfileAthletes = Object.entries(athleteCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  return {
    recentBriefs: briefs || [],
    upcomingContent: scheduled || [],
    recentAssets: [],
    activeBrands,
    activeAthletes,
    highProfileAthletes,
    highProfileBrands,
  };
}

// --- GET handler ---

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get('type') || 'strategy';

  if (type === 'strategy') {
    // Return static platform strategy data — no AI call needed
    return NextResponse.json({
      platforms: PLATFORM_STRATEGY,
    });
  }

  if (type === 'gaps') {
    const hubContext = await gatherHubContext(supabase);
    const gaps = await analyzeContentGaps(hubContext);
    return NextResponse.json({ gaps });
  }

  return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
}

// --- POST handler ---

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, platform, count, startDate } = body;

  const hubContext = await gatherHubContext(supabase);

  if (action === 'suggest') {
    const suggestions = await generateOnDemandSuggestions(
      platform || 'all',
      hubContext,
      count || 5,
    );
    return NextResponse.json({ suggestions });
  }

  if (action === 'calendar') {
    if (!platform || platform === 'all') {
      return NextResponse.json(
        { error: 'Calendar requires a specific platform' },
        { status: 400 },
      );
    }
    const calendar = await generateWeeklyCalendar(platform, hubContext, startDate);
    return NextResponse.json({ calendar });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
