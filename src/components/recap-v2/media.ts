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

// ── The parameter sets: there are TWO, and that is the point ────────────────
//
// Supabase caches a transform per EXACT parameter set and generates each one
// from the original — 5-31MB on Ghost Amp — the first time it is asked for.
// Cold is ~750ms per image against ~130ms warm, so a set nobody has warmed
// makes a whole campaign look broken on first view.
//
// There used to be five sets: builder 320 and 1280, page 720, 900 and 1600.
// Five separate cache entries per photo, and warming the builder warmed none
// of what a client actually sees. Now there are two, shared by the builder and
// the page, so warming a campaign once covers both:
//
//   PICKER   320  the builder's selection grid, and nothing else. ~24KB.
//   DISPLAY  1600 every image the recap renders — hero backdrop, gallery
//                 tiles, performer cards — and the builder's hero preview,
//                 which is showing the page's own hero back to you.
//
// DISPLAY is 1600 rather than the builder's old 1280 deliberately. The hero
// backdrop is sized by height and overspills: on a 1440 viewport it renders
// past 2100px wide, so it is already being upscaled from 1600. Dropping to
// 1280 would have taken that from 1.3x to 1.7x on the largest, most prominent
// image on the page. Sharing the set was the requirement; the value only had
// to be one both surfaces could live with. One constant to change if the
// weight matters more than the sharpness.
//
// Some elements are now over-served — a gallery tile renders around 330px and
// gets a 1600 source. That is the trade: a bigger download for an image that
// is already warm, instead of a smaller one that is not.

/** The builder's selection grid. Small and cheap; the page never uses it. */
export const PICKER_WIDTH = 320;
export const PICKER_QUALITY = 70;

/** Everything the recap renders, and the builder's preview of it. */
export const DISPLAY_WIDTH = 1600;
export const DISPLAY_QUALITY = 78;

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

/** The builder's grid URL. */
export function pickerThumb(url: string | null | undefined): string {
  return transformed(url, PICKER_WIDTH, PICKER_QUALITY);
}

/**
 * Every rendered image, on the page and in the builder's preview.
 *
 * There is no width argument on purpose. A caller that could pass its own
 * would quietly mint a sixth cache entry, which is how there came to be five.
 */
export function displayImage(url: string | null | undefined): string {
  return transformed(url, DISPLAY_WIDTH, DISPLAY_QUALITY);
}
