// ============================================================
// POST /api/creator-briefs/upload
//
// PUBLIC endpoint — no auth required.
// Lets freelance videographers upload footage directly from
// the creative brief page. The slug acts as the access key.
//
// Body: multipart/form-data with:
//   - files: one or more image/video files
//   - slug: the creative brief slug (required — proves access)
//
// For each file:
//   1. Validates the slug maps to a published brief
//   2. Uploads to "raw-footage" Supabase Storage bucket
//   3. Creates an inspo_items row linked to the brief's brand
//   4. Fires Claude Vision tagging in the background (non-blocking)
//
// Returns: { uploaded: [...], errors: [...], total, successful, failed }
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// We use the service role key because:
//  - There's no logged-in user (this is a public endpoint)
//  - We need to write to Storage + inspo_items
//  - The slug acts as our "access token" — only someone
//    with the brief link can upload
const getAdminSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function POST(request: NextRequest) {
  const adminSupabase = getAdminSupabase();

  // --- Parse multipart form data ---
  const formData = await request.formData();
  const slug = formData.get('slug') as string | null;
  const files = formData.getAll('files') as File[];
  // Optional: override athlete name per upload batch (e.g. from folder name)
  const athleteNameOverride = formData.get('athlete_name') as string | null;

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 });
  }

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  // Cap at 50 files per request to prevent abuse
  if (files.length > 50) {
    return NextResponse.json(
      { error: 'Maximum 50 files per upload' },
      { status: 400 }
    );
  }

  // --- Validate the slug exists and brief is published ---
  // This is the security gate: if you don't have the slug, you can't upload
  const { data: brief, error: briefError } = await adminSupabase
    .from('creator_briefs')
    .select('id, brand_id, concept_id, brief_id, athlete_name, slug')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (briefError || !brief) {
    return NextResponse.json(
      { error: 'Brief not found or not published' },
      { status: 404 }
    );
  }

  // --- Process each file ---
  const results = [];
  const errors = [];

  for (const file of files) {
    try {
      const mimeType = file.type;
      const isVideo = mimeType.startsWith('video/');
      const isImage = mimeType.startsWith('image/');

      if (!isVideo && !isImage) {
        errors.push({ file: file.name, error: `Unsupported file type: ${mimeType}` });
        continue;
      }

      // Map to the correct content_type enum value:
      //   video → raw_footage
      //   image → photography
      const contentType = isVideo ? 'raw_footage' : 'photography';

      // --- Upload to Supabase Storage ---
      // Path: freelancer/{slug}/{date}/{timestamp}_{filename}
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const datePath = new Date().toISOString().split('T')[0];
      const storagePath = `freelancer/${slug}/${datePath}/${timestamp}_${sanitizedName}`;

      const fileBuffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await adminSupabase.storage
        .from('raw-footage')
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        errors.push({ file: file.name, error: `Upload failed: ${uploadError.message}` });
        continue;
      }

      // Build the public URL
      const { data: publicUrlData } = adminSupabase.storage
        .from('raw-footage')
        .getPublicUrl(storagePath);

      const fileUrl = publicUrlData.publicUrl;
      const thumbnailUrl = isImage ? fileUrl : null;

      // --- Create inspo_items row ---
      // Links back to the brief's brand & athlete so everything
      // is connected in the pipeline automatically
      const { data: inspoItem, error: insertError } = await adminSupabase
        .from('inspo_items')
        .insert({
          content_type: contentType,
          source: 'produced_catalog',
          file_url: fileUrl,
          thumbnail_url: thumbnailUrl,
          mime_type: mimeType,
          file_size_bytes: file.size,
          format: file.name.split('.').pop()?.toLowerCase() || null,
          brand_id: brief.brand_id || null,
          athlete_name: athleteNameOverride || brief.athlete_name || null,
          tagging_status: 'pending',
          notes: `Uploaded by videographer via creative brief: ${slug}`,
          // Initialize empty tag objects
          pro_tags: {},
          social_tags: {},
          context_tags: {},
          search_phrases: [],
          brief_fit: [],
        })
        .select()
        .single();

      if (insertError) {
        errors.push({ file: file.name, error: `Database insert failed: ${insertError.message}` });
        continue;
      }

      results.push({
        file: file.name,
        inspo_item: inspoItem,
      });

      // --- Auto-trigger Claude Vision tagging (fire-and-forget) ---
      // We call our own tag API in the background so the videographer
      // doesn't have to wait for AI processing. The "no auth" aspect
      // is handled by calling the internal endpoint with the service key.
      // Instead, we tag directly using the agent function.
      try {
        const { tagInspoItem } = await import('@/lib/agents/intake-agent');
        // Fire and forget — don't await, don't block the upload response
        tagInspoItem(inspoItem.id, 'system').catch((err: Error) => {
          console.error(`Auto-tagging failed for ${inspoItem.id}:`, err);
        });
      } catch (tagErr) {
        // Tagging failure shouldn't break the upload
        console.error('Failed to start auto-tagging:', tagErr);
      }
    } catch (err) {
      errors.push({
        file: file.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json(
    {
      uploaded: results,
      errors,
      total: files.length,
      successful: results.length,
      failed: errors.length,
    },
    { status: results.length > 0 ? 201 : 500 }
  );
}
