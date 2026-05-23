// ============================================================
// POST /api/media/convert-images
//
// Finds all media rows whose file_url ends in an unsupported
// format (.heic, .tiff, etc.), converts each one to .jpg using
// sharp, re-uploads to the same Supabase Storage bucket, and
// updates the database row.
//
// Query params:
//   ?campaign=<slug>  — only convert images for one campaign
//   ?dry_run=1        — just list what would be converted
//
// Protected by a secret key in the Authorization header so
// it can't be called by random visitors.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { needsConversion, convertMediaRow } from '@/lib/services/image-convert';

export const maxDuration = 300; // Allow up to 5 min for large batches

export async function POST(request: NextRequest) {
  // ---- Auth: require a secret key ----
  const authHeader = request.headers.get('authorization') || '';
  const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const campaignSlug = searchParams.get('campaign');
  const dryRun = searchParams.get('dry_run') === '1';

  const supabase = createServiceSupabase();

  // ---- Find media rows with unsupported formats ----
  let query = supabase
    .from('media')
    .select('id, file_url, thumbnail_url, campaign_id')
    .eq('type', 'image');

  // If a campaign slug was provided, filter to just that campaign
  if (campaignSlug) {
    const { data: recap } = await supabase
      .from('campaign_recaps')
      .select('id')
      .eq('slug', campaignSlug)
      .maybeSingle();

    if (!recap) {
      return NextResponse.json({ error: `Campaign "${campaignSlug}" not found` }, { status: 404 });
    }
    query = query.eq('campaign_id', recap.id);
  }

  const { data: allMedia, error: fetchErr } = await query;
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  // Filter to only rows that need conversion
  const toConvert = (allMedia || []).filter((m: any) => needsConversion(m.file_url));

  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      found: toConvert.length,
      files: toConvert.map((m: any) => ({
        id: m.id,
        file_url: m.file_url,
      })),
    });
  }

  // ---- Convert each one ----
  const results: { id: string; success: boolean; newUrl?: string; error?: string }[] = [];

  for (const row of toConvert) {
    const result = await convertMediaRow(supabase, row as any);
    results.push({ id: row.id, ...result });
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({
    total: toConvert.length,
    succeeded,
    failed,
    results,
  });
}
