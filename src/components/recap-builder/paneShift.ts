// The one place the Across mapping lives.
//
// The page's hero and the builder's preview both call this, so a change to the
// multiplier cannot leave the preview showing one framing and the published
// page another.
//
// x = 100 rests the pane flush against the frame's right edge; lower values
// pull it left. It moves the PANE, never the image: a portrait photo fills the
// pane's width, so there is no horizontal overflow to pan and object-position
// X stays at 50%.
export function paneShift(x: number): string {
  return `translateX(${(x - 100) * 0.34}%)`;
}
