// ============================================================
// Image Format Converter
//
// Converts unsupported image formats (HEIC, TIFF, etc.) to JPG
// so they display correctly in web browsers. Uses `sharp` — a
// fast Node.js image processing library that's already installed
// in the project.
//
// Two main uses:
//   1. convertImageIfNeeded(buffer, filename)
//      → Call during import to auto-convert before uploading.
//        Returns { buffer, filename, converted } so you know
//        whether it changed anything.
//
//   2. convertMediaRow(supabase, mediaRow)
//      → Pass a row from the `media` table. Downloads the file
//        from Supabase Storage, converts it, re-uploads the JPG,
//        and updates the row's file_url + thumbnail_url.
// ============================================================

import sharp from 'sharp';
import { SupabaseClient } from '@supabase/supabase-js';

// File extensions that browsers can't display as <img> src.
// We convert these to .jpg on the fly.
const UNSUPPORTED_EXTENSIONS = ['.heic', '.heif', '.tif', '.tiff', '.bmp', '.avif'];

/**
 * Check if a filename has an extension that browsers can't render.
 */
export function needsConversion(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return UNSUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Convert an image buffer to JPG if the format is unsupported.
 *
 * Think of this like a translator: if someone hands you a document
 * in a language the browser doesn't speak (HEIC, TIFF), this
 * translates it to one it does (JPG).
 *
 * @returns The (possibly converted) buffer, new filename, and
 *          whether conversion happened.
 */
export async function convertImageIfNeeded(
  buffer: Buffer,
  filename: string
): Promise<{ buffer: Buffer; filename: string; converted: boolean }> {
  if (!needsConversion(filename)) {
    return { buffer, filename, converted: false };
  }

  // sharp can read HEIC, TIFF, BMP, AVIF and output JPG.
  // Quality 90 is a good balance of file size vs visual quality.
  const jpgBuffer = await sharp(buffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  // Replace the old extension with .jpg
  const newFilename = filename.replace(/\.[^.]+$/, '.jpg');

  return { buffer: jpgBuffer, filename: newFilename, converted: true };
}

/**
 * Convert a single media row's file from an unsupported format
 * to JPG inside Supabase Storage, then update the DB row.
 *
 * Steps:
 *   1. Download the original file from storage
 *   2. Convert to JPG with sharp
 *   3. Upload the JPG next to the original
 *   4. Update file_url (and thumbnail_url if it matched) in the DB
 *
 * @param supabase - A Supabase client with service-role access
 * @param row - A media table row with at least { id, file_url, thumbnail_url }
 * @returns { success, newUrl, error? }
 */
export async function convertMediaRow(
  supabase: SupabaseClient,
  row: { id: string; file_url: string; thumbnail_url: string | null }
): Promise<{ success: boolean; newUrl?: string; error?: string }> {
  const { id, file_url, thumbnail_url } = row;

  if (!needsConversion(file_url)) {
    return { success: true, newUrl: file_url }; // nothing to do
  }

  try {
    // ---- 1. Figure out the storage bucket and path ----
    // file_url looks like:
    //   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const url = new URL(file_url);
    const pathAfterPublic = url.pathname.replace('/storage/v1/object/public/', '');
    const slashIdx = pathAfterPublic.indexOf('/');
    const bucket = pathAfterPublic.slice(0, slashIdx);
    const storagePath = pathAfterPublic.slice(slashIdx + 1);

    // ---- 2. Download the original file ----
    const { data: fileData, error: dlError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (dlError || !fileData) {
      return { success: false, error: `Download failed: ${dlError?.message || 'no data'}` };
    }

    const originalBuffer = Buffer.from(await fileData.arrayBuffer());

    // ---- 3. Convert to JPG ----
    const { buffer: jpgBuffer, filename: newFilename } = await convertImageIfNeeded(
      originalBuffer,
      storagePath.split('/').pop() || 'image.heic'
    );

    // ---- 4. Upload the JPG alongside the original ----
    // New path: same directory, new filename ending in .jpg
    const newStoragePath = storagePath.replace(/[^/]+$/, newFilename);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(newStoragePath, jpgBuffer, {
        contentType: 'image/jpeg',
        upsert: true, // overwrite if it already exists
      });

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` };
    }

    // Build the new public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(newStoragePath);
    const newUrl = publicUrlData.publicUrl;

    // ---- 5. Update the media row ----
    // If thumbnail_url pointed to the same file, update it too.
    const updates: Record<string, string> = { file_url: newUrl };
    if (thumbnail_url === file_url) {
      updates.thumbnail_url = newUrl;
    }

    const { error: dbError } = await supabase
      .from('media')
      .update(updates)
      .eq('id', id);

    if (dbError) {
      return { success: false, error: `DB update failed: ${dbError.message}` };
    }

    return { success: true, newUrl };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
