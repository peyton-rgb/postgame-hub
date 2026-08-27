// Supabase image transforms for the v2 recap.
//
// The transform endpoint is what makes a 3-column masonry of 4,434 media rows
// survivable — without it the browser pulls originals, and the largest single
// file in the library is 357MB.
//
// It has a hard limit, though: the transformer answers 400 InvalidRequest
// "The source image file is too large to process" above roughly 25MB. 70 rows
// exceed 20MB and 54 exceed 25MB, so a handful of tiles WILL fail. Falling
// back to the untransformed URL is NOT the answer — that file is the 35MB one.
// RecapImage reports the failure instead and its callers drop the image; see
// RecapImage.tsx. Shrinking the offending originals is a separate job.

export function transformed(url: string | null | undefined, width: number): string {
  if (!url) return "";
  if (!url.includes("/object/public/")) return url;
  return `${url.replace("/object/public/", "/render/image/public/")}?width=${width}&quality=80&resize=contain`;
}
