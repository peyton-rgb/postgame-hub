// ============================================================
// /api/posting-packages/[id]/photos — reorder and remove carousel photos
//
// Staff only. The photos of a Feed post live in posting_package_files, in
// `position` order — that order IS the order the athlete posts them in, so
// moving a photo here changes the post.
//
//   PATCH  { order: [photoId, …] }  — the new order, every photo exactly once
//   DELETE { photoId }              — remove one photo and its stored file
//
// Adding a photo is the attach route (POST …/attach with slot: 'photo').
//
// Reordering writes twice: once to negative placeholder positions, then to
// the real ones. The (package_id, position) unique index would otherwise
// reject the halfway state where two photos briefly want the same slot.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/supabase-server';
import { getHubStaff } from '@/lib/staff-auth';
import { removeUpload } from '@/lib/drive-import';
import { PHOTO_COLUMNS, type PostingPhoto } from '@/lib/posting-packages';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireStaff() {
  const staff = await getHubStaff();
  if (staff.ok) return null;
  return NextResponse.json(
    { error: staff.reason === 'anon' ? 'Not authenticated' : 'Staff only' },
    { status: staff.reason === 'anon' ? 401 : 403 }
  );
}

/** Every photo of one package, in carousel order. */
async function loadPhotos(
  supabase: ReturnType<typeof createServerSupabase>,
  packageId: string
): Promise<PostingPhoto[]> {
  const { data } = await supabase
    .from('posting_package_files')
    .select(PHOTO_COLUMNS)
    .eq('package_id', packageId)
    .order('position', { ascending: true });
  return (data as unknown as PostingPhoto[] | null) ?? [];
}

// ---- PATCH: reorder -------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireStaff();
  if (denied) return denied;

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid package id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const order = Array.isArray(body?.order) ? body.order : null;
  if (!order || !order.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
    return NextResponse.json({ error: 'order must be a list of photo ids' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const photos = await loadPhotos(supabase, params.id);
  if (!photos.length) {
    return NextResponse.json({ error: 'That post has no photos' }, { status: 404 });
  }

  // The new order must be a permutation of what's there — no additions, no
  // omissions, no duplicates. Otherwise a stale tab could drop a photo.
  const have = new Set(photos.map((p) => p.id));
  const want = new Set<string>(order);
  if (
    want.size !== order.length ||
    want.size !== have.size ||
    Array.from(want).some((id) => !have.has(id))
  ) {
    return NextResponse.json(
      { error: 'That order does not match the photos on this post. Reload and try again.' },
      { status: 409 }
    );
  }

  // Pass 1: park everything on negative positions the index can't collide on.
  for (let i = 0; i < order.length; i++) {
    const { error } = await supabase
      .from('posting_package_files')
      .update({ position: -(i + 1) })
      .eq('id', order[i])
      .eq('package_id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // Pass 2: the real positions, 1…n.
  for (let i = 0; i < order.length; i++) {
    const { error } = await supabase
      .from('posting_package_files')
      .update({ position: i + 1 })
      .eq('id', order[i])
      .eq('package_id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ photos: await loadPhotos(supabase, params.id) });
}

// ---- DELETE: remove one ---------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await requireStaff();
  if (denied) return denied;

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Invalid package id' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const photoId = typeof body?.photoId === 'string' ? body.photoId : '';
  if (!UUID_RE.test(photoId)) {
    return NextResponse.json({ error: 'photoId is missing or malformed' }, { status: 400 });
  }

  const supabase = createServerSupabase();
  // Scoped to this package, so an id from another post can't be deleted here.
  const { data: photo, error: loadError } = await supabase
    .from('posting_package_files')
    .select(PHOTO_COLUMNS)
    .eq('id', photoId)
    .eq('package_id', params.id)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  const { error: deleteError } = await supabase
    .from('posting_package_files')
    .delete()
    .eq('id', photoId)
    .eq('package_id', params.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // The row is gone either way; a stranded object is logged, not fatal.
  const storagePath = (photo as unknown as PostingPhoto).storage_path;
  if (storagePath) {
    await removeUpload(createServiceSupabase(), storagePath).catch((e) =>
      console.error('[posting photos] upload not removed:', storagePath, e)
    );
  }

  // Close the gap the removed photo left, so positions stay 1…n.
  const rest = await loadPhotos(supabase, params.id);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].position === i + 1) continue;
    await supabase
      .from('posting_package_files')
      .update({ position: i + 1 })
      .eq('id', rest[i].id);
  }

  return NextResponse.json({ photos: await loadPhotos(supabase, params.id) });
}
