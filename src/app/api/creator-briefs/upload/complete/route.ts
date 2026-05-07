// ============================================================
// POST /api/creator-briefs/upload/complete
//
// PUBLIC endpoint — no auth required.
// Step 2 of the two-step upload flow.
//
// Called AFTER the browser has uploaded a file directly to
// Supabase Storage using the signed URL from Step 1.
//
// This route:
//   1. Verifies the file exists in Storage
//   2. Creates an inspo_items database record
//   3. Fires Claude Vision tagging in the background
//
// Body (JSON): {
//   slug: string,          — the creative brief slug
//   storagePath: string,   — path returned from step 1
//   fileName: string,      — original file name
//   mimeType: string,      — e.g. "video/mp4"
//   fileSize: number,      — bytes
//   athleteName?: string   — override from folder name
// }
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const getAdminSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(request: NextRequest) {
  const adminSupabase = getAdminSupabase();

  const body = await request.json();
  const { slug, storagePath, fileName, mimeType, fileSize, athleteName } = body;

  if (!slug || !storagePath || !fileName || !mimeType) {
    return NextResponse.json(
      { error: 'slug, storagePath, fileName, and mimeType are required' },
      { status: 400 }
    );
  }

  // --- Validate slug again (prevents someone from registering
  //     random files against a brief they don't have access to) ---
  const { data: brief, error: briefError } = await adminSupabase
    .from('creator_briefs')
    .select('id, brand_id, athlete_name')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (briefError || !brief) {
    return NextResponse.json(
      { error: 'Brief not found or not published' },
      { status: 404 }
    );
  }

  // --- Build the public URL for the uploaded file ---
  const { data: publicUrlData } = adminSupabase.storage
    .from('raw-footage')
    .getPublicUrl(storagePath);

  const fileUrl = publicUrlData.publicUrl;

  const isVideo = mimeType.startsWith('video/');
  const isImage = mimeType.startsWith('image/');
  const contentType = isVideo ? 'raw_footage' : 'photography';
  const thumbnailUrl = isImage ? fileUrl : null;

  // --- Create inspo_items row ---
  const { data: inspoItem, error: insertError } = await adminSupabase
    .from('inspo_items')
    .insert({
      content_type: contentType,
      source: 'produced_catalog',
      file_url: fileUrl,
      thumbnail_url: thumbnailUrl,
      mime_type: mimeType,
      file_size_bytes: fileSize || null,
      format: 'unknown',  // aspect ratio — detected later during tagging
      brand_id: brief.brand_id || null,
      athlete_name: athleteName || brief.athlete_name || null,
      tagging_status: 'pending',
      notes: `Uploaded by videographer via creative brief: ${slug}`,
      pro_tags: {},
      social_tags: {},
      context_tags: {},
      search_phrases: [],
      brief_fit: [],
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: `Database insert failed: ${insertError.message}` },
      { status: 500 }
    );
  }

  // --- Auto-trigger Claude Vision tagging (fire-and-forget) ---
  // Only tag images — video tagging requires frame extraction
  // which we handle separately in the intake dashboard.
  if (isImage) {
    try {
      const { tagInspoItem } = await import('@/lib/agents/intake-agent');
      tagInspoItem(inspoItem.id, 'system').catch((err: Error) => {
        console.error(`Auto-tagging failed for ${inspoItem.id}:`, err);
      });
    } catch (tagErr) {
      console.error('Failed to start auto-tagging:', tagErr);
    }
  }

  return NextResponse.json({
    success: true,
    file: fileName,
    inspo_item_id: inspoItem.id,
  });
}
