// ============================================================
// POST /api/upload — Upload reference images to Supabase Storage.
//
// Accepts multipart/form-data with one or more `file` fields.
// Optional `brief_id` form field is used as the folder prefix; if
// omitted, files land under `misc/`.
//
// Returns: { urls: string[] } — public CDN URLs for each uploaded file.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createServiceSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'reference-images';
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB per file
const ALLOWED_MIME = /^image\//;

function safeName(name: string): string {
  // Strip path separators and anything that isn't a sane URL char.
  const base = name.replace(/^.*[\\/]/, '').toLowerCase();
  return base.replace(/[^a-z0-9._-]/g, '-').slice(0, 80) || 'file';
}

export async function POST(request: NextRequest) {
  // Auth via the user's cookie session — service-role used only for the
  // actual upload so we don't leak it to clients.
  const supabase = await createServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const briefId = (form.get('brief_id') as string | null)?.trim() || 'misc';
  const folder = briefId.replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';

  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  const storage = createServiceSupabase().storage.from(BUCKET);
  const urls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_MIME.test(file.type)) {
      return NextResponse.json(
        { error: `File "${file.name}" is not an image (got ${file.type})` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 15 MB limit` },
        { status: 400 }
      );
    }

    const path = `${folder}/${Date.now()}_${safeName(file.name)}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await storage.upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data } = storage.getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return NextResponse.json({ urls });
}
