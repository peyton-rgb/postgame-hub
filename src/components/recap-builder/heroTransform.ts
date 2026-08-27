// The one place the hero's framing maths lives.
//
// The photo is a BACKDROP behind the whole hero-and-overview block, not a
// framed pane. It is sized by height and allowed to overspill in both
// directions (height:118%, width:auto, max-width:none) so an edge mask has
// something to eat, which is what lets it dissolve on all four sides at any
// size or position.
//
// So framing moves the backdrop rather than cropping inside a box:
//
//   x  100 rests it against the right edge; lower values slide it left.
//   y  pans it vertically about the middle.
//   z  zooms about `transform-origin: right center`, so the right edge — the
//      one anchored to the frame — stays put while the photo grows.
//
// The page's hero and the builder's preview both call this, so a change here
// cannot leave the preview showing one framing and the published page another.
import type { FocalPoint } from "@/lib/recap-v2/config";

export function backdropTransform(f: FocalPoint): string {
  // The -50% is the vertical centring for `top: 50%`, and it has to stay
  // inside the same translate as the pan — hence calc rather than two
  // transforms, which would fight each other.
  return `translate(${(100 - f.x) * -0.42}%, calc(-50% + ${(f.y - 50) * 0.42}%)) scale(${f.scale})`;
}
