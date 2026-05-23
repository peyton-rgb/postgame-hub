// ============================================================
// Campaign Hero Editor API — /api/campaigns/[id]/hero
//
// GET  → returns all media for a campaign, with hero fields
// PUT  → bulk-update hero selections (is_hero, hero_order,
//         focal_x, focal_y, hero_scale) for a campaign's media
//
// Note: "campaigns" here refers to the public campaign pages
// on the live website (/clients/[slug]/[campaign]), NOT the
// internal recaps/metrics system.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';

type RouteContext = { params: Promise<{ id: string }> };

// GET: Fetch all media for the campaign so the editor can show thumbnails
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id: campaignId } = await ctx.params;
  const supabase = createServiceSupabase();

  const { data, error } = await supabase
    .from('media')
    .select('id, type, file_url, thumbnail_url, focal_x, focal_y, hero_scale, is_hero, hero_order, resolution')
    .eq('campaign_id', campaignId)
    .order('hero_order', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ media: data || [] });
}

// PUT: Save hero selections — expects { items: [{ id, is_hero, hero_order, focal_x, focal_y, hero_scale }] }
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { id: campaignId } = await ctx.params;
  const supabase = createServiceSupabase();
  const body = await req.json();
  const items: Array<{
    id: string;
    is_hero: boolean;
    hero_order: number;
    focal_x: number;
    focal_y: number;
    hero_scale: number;
  }> = body.items;

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'items array required' }, { status: 400 });
  }

  // First, reset all media for this campaign to is_hero=false
  const { error: resetErr } = await supabase
    .from('media')
    .update({ is_hero: false, hero_order: 0 })
    .eq('campaign_id', campaignId);

  if (resetErr) {
    return NextResponse.json({ error: resetErr.message }, { status: 500 });
  }

  // Then update each selected hero item
  const errors: string[] = [];
  for (const item of items) {
    const { error: upErr } = await supabase
      .from('media')
      .update({
        is_hero: item.is_hero,
        hero_order: item.hero_order,
        focal_x: item.focal_x,
        focal_y: item.focal_y,
        hero_scale: item.hero_scale,
      })
      .eq('id', item.id)
      .eq('campaign_id', campaignId);

    if (upErr) errors.push(`${item.id}: ${upErr.message}`);
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
