// ============================================================
// Inspo Library API — GET /api/inspo
//
// Powers the dashboard inspo browser UI and agent queries for
// finding relevant tagged assets. Supports full-text search,
// JSONB tag filtering, content type / sport / vibe filters,
// pagination, and multiple sort modes.
// ============================================================

import { createServerSupabase } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // ---- Parse query params ----
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || null;
  const contentType = searchParams.get('content_type');
  const taggingStatus = searchParams.get('tagging_status') || 'tagged';
  const sport = searchParams.get('sport');
  const brandId = searchParams.get('brand_id');
  const campaignId = searchParams.get('campaign_id');
  const vibe = searchParams.get('vibe')?.trim() || null;
  const tag = searchParams.get('tag')?.trim() || null;
  const sort = searchParams.get('sort') || 'newest';
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  try {
    // ---- Build the data query ----
    let query = supabase.from('inspo_items').select('*');

    // Tagging status filter (default: only show tagged items)
    query = query.eq('tagging_status', taggingStatus);

    // Content type enum filter
    if (contentType) {
      query = query.eq('content_type', contentType);
    }

    // Brand / campaign filters
    if (brandId) query = query.eq('brand_id', brandId);
    if (campaignId) query = query.eq('campaign_id', campaignId);

    // Sport filter — checks context_tags JSONB array
    if (sport) {
      query = query.contains('context_tags', { sport: [sport] });
    }

    // Vibe filter — matches against search_phrases text array
    if (vibe) {
      query = query.contains('search_phrases', [vibe]);
    }

    // General tag search — searches across all three JSONB tag columns
    if (tag) {
      const safeTag = tag.replace(/%/g, '');
      query = query.or(
        `pro_tags::text.ilike.%${safeTag}%,social_tags::text.ilike.%${safeTag}%,context_tags::text.ilike.%${safeTag}%`,
      );
    }

    // Free text search across multiple text columns
    if (q) {
      const safeQ = q.replace(/%/g, '');
      query = query.or(
        `visual_description.ilike.%${safeQ}%,search_phrases::text.ilike.%${safeQ}%,athlete_name.ilike.%${safeQ}%,sport.ilike.%${safeQ}%,notes.ilike.%${safeQ}%`,
      );
    }

    // Sorting
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'hero_first':
        query = query
          .order('is_hero', { ascending: false })
          .order('created_at', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching inspo items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ---- Count query with the same filters ----
    let countQuery = supabase
      .from('inspo_items')
      .select('id', { count: 'exact', head: true });

    countQuery = countQuery.eq('tagging_status', taggingStatus);
    if (contentType) countQuery = countQuery.eq('content_type', contentType);
    if (brandId) countQuery = countQuery.eq('brand_id', brandId);
    if (campaignId) countQuery = countQuery.eq('campaign_id', campaignId);
    if (sport) countQuery = countQuery.contains('context_tags', { sport: [sport] });
    if (vibe) countQuery = countQuery.contains('search_phrases', [vibe]);
    if (tag) {
      const safeTag = tag.replace(/%/g, '');
      countQuery = countQuery.or(
        `pro_tags::text.ilike.%${safeTag}%,social_tags::text.ilike.%${safeTag}%,context_tags::text.ilike.%${safeTag}%`,
      );
    }
    if (q) {
      const safeQ = q.replace(/%/g, '');
      countQuery = countQuery.or(
        `visual_description.ilike.%${safeQ}%,search_phrases::text.ilike.%${safeQ}%,athlete_name.ilike.%${safeQ}%,sport.ilike.%${safeQ}%,notes.ilike.%${safeQ}%`,
      );
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error fetching inspo count:', countError);
      // Non-fatal — return items without total
    }

    return NextResponse.json({
      items: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error('Unexpected error in /api/inspo:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
