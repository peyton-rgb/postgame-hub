// ============================================================
// POST /api/posting-packages/[id]/attach — copy a Drive file onto a post
// Body: { slot: 'video' | 'cover' | 'photo', driveFileId, fileName }
//
// Staff only. Copies the Drive file into Supabase Storage (campaign-media)
// at posting/<posting_campaign_id>/<package_id>/<slot>-<ts>-<fileName>, then
// writes video_url (video) or cover_url (cover / feed photo).
//
// Why copy instead of linking Drive: athletes aren't signed into Postgame's
// Drive, and /deliver/[token] needs a URL it can play inline and download.
//
// Safety:
//   • The slot must be one this deliverable has (reel: video, cover; feed:
//     photo), and the Drive file's type must fit it — checked from Drive's
//     metadata BEFORE any bytes move.
//   • If saving the URL fails, the new upload is removed.
//   • Replacing a file removes the old upload — but only one this route
//     made (a posting/ path in campaign-media). Anything else a URL points
//     at is left alone.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/supabase-server';
import { getHubStaff } from '@/lib/staff-auth';
import { downloadAndUpload, getDriveClient, removeUpload, sanitizeFileName } from '@/lib/drive-import';
import { STAFF_PACKAGE_COLUMNS, slotColumn, slotsFor, type Slot } from '@/lib/posting-packages';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// The bucket allows 500 MB; the copy runs inside one 60s function, so stop
// well short of that rather than time out halfway.
const MAX_BYTES = 300 * 1024 * 1024;

const SLOTS: Slot[] = ['video', 'cover', 'photo'];
const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;
const OWN_UPLOAD = /\/storage\/v1\/object\/public\/campaign-media\/(posting\/.+)$/;

function ownStoragePath(url: string | null): string | null {
  if (!url) return null;
  try {
    const m = OWN_UPLOAD.exec(new URL(url).pathname);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await getHubStaff();
  if (!staff.ok) {
    return NextResponse.json(
      { error: staff.reason === 'anon' ? 'Not authenticated' : 'Staff only' },
      { status: staff.reason === 'anon' ? 401 : 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const slot = body?.slot as Slot;
  const driveFileId = body?.driveFileId;
  const fileName = typeof body?.fileName === 'string' ? body.fileName.trim() : '';
  if (!SLOTS.includes(slot)) {
    return NextResponse.json({ error: "slot must be 'video', 'cover' or 'photo'" }, { status: 400 });
  }
  if (typeof driveFileId !== 'string' || !DRIVE_ID.test(driveFileId)) {
    return NextResponse.json({ error: 'driveFileId is missing or malformed' }, { status: 400 });
  }
  if (!fileName) {
    return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
  }

  // Staff session (RLS staff-only) for the row reads and writes.
  const supabase = createServerSupabase();
  const { data: pkg, error: loadError } = await supabase
    .from('posting_packages')
    .select('id, posting_campaign_id, deliverable_key, video_url, cover_url')
    .eq('id', params.id)
    .maybeSingle();
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

  if (!slotsFor(pkg.deliverable_key).includes(slot)) {
    return NextResponse.json(
      { error: `A ${pkg.deliverable_key ?? 'this'} post has no ${slot} slot` },
      { status: 400 }
    );
  }

  // Check the file before moving any bytes.
  let mimeType = '';
  try {
    const meta = await getDriveClient().files.get({
      fileId: driveFileId,
      supportsAllDrives: true,
      fields: 'mimeType, size',
    });
    mimeType = meta.data.mimeType ?? '';
    const size = Number(meta.data.size ?? 0);
    if (size > MAX_BYTES) {
      return NextResponse.json(
        { error: `That file is ${Math.round(size / 1048576)} MB — over the ${MAX_BYTES / 1048576} MB limit for a copy. Export a smaller version.` },
        { status: 413 }
      );
    }
  } catch (err: any) {
    console.error('[posting attach] Drive metadata failed:', err?.message || err);
    return NextResponse.json(
      { error: "Couldn't open that Drive file. Check it's shared with the Postgame Google account." },
      { status: 502 }
    );
  }
  const wantVideo = slot === 'video';
  if (wantVideo ? !mimeType.startsWith('video/') : !mimeType.startsWith('image/')) {
    return NextResponse.json(
      { error: wantVideo ? 'The video slot needs a video file.' : `The ${slot} slot needs an image file.` },
      { status: 400 }
    );
  }

  const column = slotColumn(slot);
  const oldUrl = (pkg as Record<string, string | null>)[column];
  const storagePath = `posting/${pkg.posting_campaign_id ?? 'none'}/${pkg.id}/${slot}-${Date.now()}-${sanitizeFileName(fileName)}`;

  const service = createServiceSupabase();
  let publicUrl: string;
  try {
    ({ publicUrl } = await downloadAndUpload(service, { fileId: driveFileId, fileName, storagePath }));
  } catch (err: any) {
    console.error('[posting attach] copy failed:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Copying from Drive failed.' }, { status: 500 });
  }

  const { data: updated, error: saveError } = await supabase
    .from('posting_packages')
    .update({ [column]: publicUrl, updated_at: new Date().toISOString() })
    .eq('id', pkg.id)
    .select(STAFF_PACKAGE_COLUMNS)
    .single();
  if (saveError || !updated) {
    await removeUpload(service, storagePath);
    return NextResponse.json({ error: saveError?.message || 'Saving the file failed.' }, { status: 500 });
  }

  // Replaced: remove the old copy, if it was one of ours.
  const oldPath = ownStoragePath(oldUrl);
  if (oldPath && oldPath !== storagePath) {
    await removeUpload(service, oldPath).catch((e) =>
      console.error('[posting attach] old upload not removed:', oldPath, e)
    );
  }

  return NextResponse.json({ url: publicUrl, package: updated });
}
