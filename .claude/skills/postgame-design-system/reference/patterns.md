# Postgame layout patterns

**These are deliverable patterns.** Sizes, fonts and the 100/90/68/50 ladder here
are the deliverable spec — Anton figures and Mono labels are correct in this file
and must not be migrated. For tool surfaces (the staff Hub and the athlete app)
read the tool columns in SKILL.md: Bebas in place of Anton, Arimo Bold `.16em` in
place of Mono, the raised ladder, and a themed ground in place of hardcoded black.

The recurring layout blocks, with desktop geometry as built and how each
reflows down. Read this when building or reviewing a page layout. For colors,
type, surfaces, and rules, see `SKILL.md`.

Breakpoints: desktop >1000 · tablet ≤1000 · mobile ≤750.

---

## A · Two-column body
**Desktop:** inside the 1248 content width, two columns of 596 with a 56 gutter.
Arimo 16, leading 1.76, off-white 68%.
**Tablet:** one column, full content width. Reading order is column 1 then
column 2, top to bottom.
**Mobile:** one column, body stays 16 / leading 1.7.
Two 596 columns can't coexist below ~1250 without dropping under a comfortable
measure. Never attempt an intermediate two-narrow-column state.

## B · Stat bar
**Desktop:** one raised glass card, 1248 wide, padding 48×44, holding 4 stats
spaced `justify-between`. Each = Anton figure (68, or 56 for long values like
"2,000+") over a Mono label (10, 50%).
**Tablet:** 2 × 2 inside the same card, padding 40×36.
**Mobile:** 2 × 2, figures 40, gap ~24. **Never single column** — the figures
are short, and 1-wide wastes the screen and buries the fourth stat.

## C · Numbered process
**Desktop:** 4 steps across 1248 — each 294 wide, 24 gutter. Orange step number
(`01`–`04`, ~42 tall) above a hairline rule, then a Bebas H3, then an Arimo
description.
**Tablet:** 2 × 2, lockup intact per cell.
**Mobile:** single column, 4 stacked rows, hairline rule full content width
above each step. The orange figure + thin rule is the pattern's identity —
keep it at every width.

## D · Pull quote
**Desktop:** full 1248 container, quote in Arimo Bold 46 across ~1080, orange
left rule, small Mono sub-line beneath.
**Tablet:** 34, orange rule stays, inset reduces to the 40 page padding.
**Mobile:** 26, keep the orange rule (it's a 3–4px bar, not a hover effect),
tighten its gap to the text to ~12. Sub-line 10–11 Mono.

## E · Content mosaic
**Desktop:** 8 × 2 grid = 16 tiles, each ~4:5 portrait, 8px gaps, edge-blend
fades on the left and right ~150 so the grid melts into the black rather than
ending on a hard column.
**Tablet:** 4 × 4, tiles scale to fill, keep 8px gaps and the L/R fades.
**Mobile:** 2 × 8. Tiles stay ~4:5. **Never 1-across** — that's an endless
strip of 16.

## F · Card grid
**Desktop:** 4 cards across 1248 — each 294, 24 gutter. Image/portrait on top,
H3, short label or paragraph. (Team variant uses 2 large 360 cards.)
**Tablet:** 2 across.
**Mobile:** 1 across for image-led cards so the photo has presence. Copy-heavy
tier cards may also go 1-across as tall panels. Card padding 24–26 → 20.

## G · Split image band
**Desktop:** two images side by side, each ~612 × 300 (2:1), 24 gutter, each
with a caption scrim across the bottom ~140 and a small Mono caption.
**Tablet:** two images scaled to half width each, scrims and captions intact.
**Mobile:** stack one above the other, full content width, ~2:1 crop kept,
scrim + caption on each. Never side-by-side at mobile — each would be ~175
wide and the caption unreadable.

## H · Full-bleed campaign band
**Desktop:** full-bleed band, 1440 × 1024, media plus overlaid title/copy.
**Tablet / mobile:** scales; copy stacks. Keep the edge-blend treatment.

## I · Carousel
**Desktop:** horizontal scroller. Cards carry an athlete photo ~300 × 360 with
a base fade, brand logo ~88 × 32, athlete name, school-sport, brand. Auto-drift
~22px/s, hover lift, arrows present.
**Tablet:** same scroller, cards ~280, arrows retained, swipe enabled.
**Mobile:** swipe only, ~1.2 cards visible (card ≈78% viewport), right-edge
fade kept, **arrows removed**. Auto-drift may stay but must pause on touch.

## J · Marquee (client logos)
**Desktop:** full-bleed logo track bleeding off both edges, logos ~164 × 84
stepping every 200, looping seamlessly, edge fades both sides ~220.
Logos bind to `brands.logo_primary_url`.
**Tablet / mobile:** unchanged in behaviour — full-bleed, both-side fades,
continuous loop. Logos scale to ~120 × 62. A marquee is one of the few patterns
that works identically at every width; it doesn't reflow, it just keeps moving.

## K · Edge-blend
Not a component — a treatment, and hard rule 4 in `SKILL.md`. Any flat-edged
image or media on the black ground gets a soft black edge gradient. Fades
typically 110–220. Soft, never enough to darken a face — put the fade on the
empty side of the crop.
**All breakpoints:** keep it, scaled proportionally. On small screens cap any
single fade at ~30% of the media's dimension on that axis.

---

## Long pages

Copy is never trimmed to fit — word counts are floors. Long pages simply get
taller on mobile. What changes is navigation, not length:

- Sticky jump links / mini table of contents to each major H2
- Sticky section nav where there are 4+ sections
- Accordions are acceptable per section, but **collapsed ≠ removed** — the copy
  must stay in the DOM (search engines read it) and there must be exactly one
  H1 regardless of how sections collapse
- A "back to top" affordance on anything over ~4000px
