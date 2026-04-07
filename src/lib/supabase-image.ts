const STORAGE_OBJECT_PUBLIC = "/storage/v1/object/public/";

/**
 * Resizes public Supabase Storage images via the Image Transformation API.
 * Non-storage URLs (e.g. Drive thumbnails, blob:) are returned unchanged.
 */
export function supabaseImageUrl(
  url: string | null | undefined,
  width: number
): string | null | undefined {
  if (url == null || url === "") return url;
  if (!url.includes(STORAGE_OBJECT_PUBLIC)) return url;
  const rendered = url.replace("/object/public/", "/render/image/public/");
  const params = `width=${width}&quality=80&resize=contain`;
  return rendered.includes("?") ? `${rendered}&${params}` : `${rendered}?${params}`;
}
