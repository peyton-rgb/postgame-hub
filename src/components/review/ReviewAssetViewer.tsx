// ============================================================
// Review asset viewer — the one place a review asset is rendered
//
// Used by BOTH review surfaces: the staff workspace (/dashboard/reviews) and
// the brand-facing token page (/review/[token]). They differ in auth, comment
// filtering and available actions, and those differences stay on the pages.
// Only the asset rendering is shared — rendered twice, it would drift, and the
// brand would eventually see something different from what staff approved.
//
// media_type is snapshotted onto the session at creation. NULL means video:
// every session predating the column was one, so the inspo flow is unchanged.
// ============================================================

export type ReviewMediaType = string | null | undefined;

export function isImageAsset(mediaType: ReviewMediaType): boolean {
  return mediaType === 'image';
}

export default function ReviewAssetViewer({
  assetUrl,
  mediaType,
  assetName,
}: {
  assetUrl: string | null | undefined;
  mediaType: ReviewMediaType;
  assetName?: string | null;
}) {
  if (!assetUrl) return null;

  // Video (and null, which means video) — unchanged from what both pages
  // rendered before, including the 16:9 frame.
  if (!isImageAsset(mediaType)) {
    return (
      <div className="bg-black">
        <video src={assetUrl} controls className="w-full aspect-video" />
      </div>
    );
  }

  // Photo. Feed and story deliverables are 4:5 and 9:16, so the image sizes to
  // its own ratio inside a bounded box rather than being forced into 16:9,
  // which would letterbox a portrait badly. Contained, never cropped.
  return (
    <div className="relative bg-black flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={assetUrl}
        alt={assetName || 'Asset under review'}
        className="max-h-[60vh] w-auto max-w-full object-contain"
      />
      {/* Flat-edged content on a dark surface gets a soft black gradient
          blending its edges into the background. Deliberately gentle and
          confined to the outer strips — it must never be strong enough to
          darken a face. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/40 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent"
      />
    </div>
  );
}
