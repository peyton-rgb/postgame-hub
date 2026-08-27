// Supabase image transforms.
//
// THERE ARE NO THUMBNAILS for photographs. On Ghost Amp all 73 photo rows have
// thumbnail_url byte-identical to file_url, and across all published campaigns
// 2,174 of 4,179 rows are the same. `thumbnail_url` is only a real, smaller
// still for VIDEO rows — 919 videos, of which 788 carry a distinct thumbnail
// and 131 carry none, and not one video anywhere points at itself.
//
// So anything showing a grid of photographs has to transform, or it pulls
// originals: Ghost Amp's 72 measured photos total 422MB, median 4.3MB, largest
// 31.5MB. Measured, because file_size_bytes is null on every one of its rows.
//
// The transform costs one URL rewrite and is dramatic — 22.0MB becomes 121KB
// at width=320, and 420KB at width=1200.
//
// It has one hard limit, and it is lower than the 25MB usually quoted. Measured
// across Ghost Amp's 73 photos: the largest that transforms is 22.0MB, the
// smallest that fails is 24.2MB, so the ceiling sits between them. Over it the
// transformer refuses the SOURCE file with 400 InvalidRequest "The source image
// file is too large to process". That is a property of the input, not the
// output, so no width or quality setting rescues it — the 31.5MB DSC06113.jpg
// 400s identically at width=320 and width=1200. Such an asset cannot be
// previewed at all, which is why the picker says so at selection time rather
// than letting the slide vanish at render.

/** Grid thumbnails in the builder's picker. */
export const PICKER_WIDTH = 320;
export const PICKER_QUALITY = 70;
/** Hero preview in the builder, and hero stills on the page. */
export const HERO_PREVIEW_WIDTH = 1200;

// resize=contain is kept deliberately. It is what the recap page has always
// sent, and dropping it would silently switch the transformer to its `cover`
// default — re-cropping every still on every published recap. The picker sends
// it too so a grid thumbnail frames the shot the same way the page will.
export function transformed(
  url: string | null | undefined,
  width: number,
  quality = 80,
): string {
  if (!url) return "";
  if (!url.includes("/object/public/")) return url;
  return `${url.replace("/object/public/", "/render/image/public/")}?width=${width}&quality=${quality}&resize=contain`;
}

/** The picker's grid URL: small and cheap. */
export function pickerThumb(url: string | null | undefined): string {
  return transformed(url, PICKER_WIDTH, PICKER_QUALITY);
}
