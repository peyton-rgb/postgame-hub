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
import convert from 'heic-convert';
import { SupabaseClient } from '@supabase/supabase-js';

// File extensions that browsers can't display as <img> src.
// We convert these to .jpg on the fly.
const UNSUPPORTED_EXTENSIONS = ['.heic', '.heif', '.tif', '.tiff', '.bmp', '.avif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];

/**
 * Check if a filename has an extension that browsers can't render.
 */
export function needsConversion(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return UNSUPPORTED_EXTENSIONS.includes(ext);
}

function isHeic(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return HEIC_EXTENSIONS.includes(ext);
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

  // sharp's libvips on Vercel doesn't ship libheif, so HEIC/HEIF decode fails
  // at runtime ("No decoding plugin installed for this compression format").
  // Route HEIC through heic-convert (pure JS / WASM); keep sharp for everything
  // else (TIFF/BMP/AVIF), which it handles fine.
  let jpgBuffer: Buffer;
  if (isHeic(filename)) {
    const out = await convert({ buffer, format: 'JPEG', quality: 0.9 });
    jpgBuffer = Buffer.from(out);
  } else {
    jpgBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
  }

  // Replace the old extension with .jpg
  const newFilename = filename.replace(/\.[^.]+$/, '.jpg');

  return { buffer: jpgBuffer, filename: newFilename, converted: true };
}

/**
 * Prepare ANY image for sending to Claude's vision API.
 *
 * Claude rejects any single image larger than 5 MB, and it internally
 * downscales anything bigger than ~1568px on the long edge anyway — so
 * sending a full 27 MB phone photo is both rejected AND wasteful. This
 * shrinks the image to a sane size, then steps the JPEG quality down
 * until it is comfortably under the limit.
 *
 * Think of it like emailing a photo: you don't attach the 30 MB
 * original, you let it resize to "medium" first.
 *
 * @param buffer   Raw image bytes (any format)
 * @param filename Used only to detect HEIC/HEIF (iPhone photos)
 * @returns base64 JPEG string + its media type, ready to drop straight
 *          into a Claude image block.
 */
export async function prepareImageForClaude(
  buffer: Buffer,
  filename: string
): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  // 1. HEIC/HEIF can't be decoded by sharp on Vercel, so translate first.
  let working = buffer;
  if (isHeic(filename)) {
    const out = await convert({ buffer, format: 'JPEG', quality: 0.9 });
    working = Buffer.from(out);
  }

  // 2. Resize down to a max 1568px long edge, then encode as JPEG.
  //    If it's still too big, lower the quality and re-encode until it fits.
  const MAX_BYTES = 5 * 1024 * 1024;                 // Claude's hard per-image cap
  const TARGET_BYTES = Math.floor(MAX_BYTES * 0.9);  // aim a little under, for safety
  let quality = 80;

  const encode = (q: number) =>
    sharp(working)
      .rotate() // honor EXIF orientation so portrait photos aren't sideways
      .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: q })
      .toBuffer();

  let out = await encode(quality);
  while (out.length > TARGET_BYTES && quality > 40) {
    quality -= 15;
    out = await encode(quality);
  }

  return { base64: out.toString('base64'), mediaType: 'image/jpeg' };
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
