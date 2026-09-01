# RECAP BUILDER — HERO STEP · FROZEN SPEC (v11)
> Source of truth: `builder-03-hero-v11.html` (prototype, working build of every rule below).
> Rule for Claude Code: **port from the prototype file, do not re-derive.** Styles, gradient stops,
> and JS logic copy verbatim unless this doc says otherwise. Anything ambiguous → the prototype wins.

## Companion prototypes (the other approved pages)
- `builder-01-athletes.html` — Step 1: tracker + Drive folder scan + per-athlete content column
- `builder-02-overview.html` — Step 2: metric/platform toggles, zero auto-hide, live redesign preview,
  actuals + KPI targets, focus-follow
- `builder-03-hero-v11.html` — Step 3: this spec

## Wizard structure (7 steps, page-per-step — REVERSES the earlier one-page instruction)
Athletes · Overview · Hero · Performers · Content · Takeaways · Sections
(Metrics folded into Overview.)
On the public page, Takeaways renders **after the Roster**, near the end — a section-order
concern, not this rail's order.

---

## 1 · Image loading — HARD RULES (apply project-wide)
- **Never call the Supabase transformer with width only.** It scales width and keeps height →
  distorted images. Always `width` + `height` + `resize`.
  - Thumbs: `?width=520&height=520&resize=contain&quality=78&format=webp`
  - Hero:   `?width=1600&height=1600&resize=contain&quality=82&format=webp`
- **Always `format=webp` for any image under a designed overlay/scrim.** The athlete photos are
  iPhone HDR shots with gain maps; on HDR displays (Peyton's), Chrome renders them brighter than
  SDR black can composite against — scrims/fades/masks visually fail. WebP re-encode strips the
  gain map at the source. Do NOT use `filter:` or `dynamic-range-limit` CSS workarounds — they
  shift blacks / create compositing layers that seam (all tried and rejected; see §4).
- Only a **confirmed transformer 400** marks a photo unusable. Never silently drop saved selections.

## 2 · Picker (left column)
- Bento/masonry grid: CSS `columns: 4 150px; gap 10px`; tiles full photos at **original aspect
  ratio** (no crop). Ratio badge top-right per tile.
- Ratio measured **client-side on image load** (DB `aspect_ratio` is null). Labels:
  `<0.62 → 9:16 · ≤0.9 → 3:4 · 0.9–1.15 → 1:1 · ≤1.55 → 3:2 · else 16:9`.
- Photos only (hero is a still frame). Max 4 selections; orange badge = rotation order; click again
  to deselect. Athlete filter chips come from Step-1 Drive folder matching.
- Nothing selected → derived fallback order: `is_hero → sort_order → upload date` (stated on page).

## 3 · Hero layout by ratio
- **Landscape (r > 1.15): full-bleed.** Wash + text plate scrims for legibility; eased top +
  bottom fades to solid #07070A (the stats band that used to mask the bottom edge is GONE).
- **Square-ish (0.9 < r ≤ 1.15): side mode, big, no bleed-down.** Box width 68% of page,
  height 100% of hero.
- **Vertical (r ≤ 0.9): side mode, bleeds down into Overview.** Widths: 9:16 → 48%, 3:4 → 58%
  (× Scale). Box height = photo's **natural height at that width** (nothing cut at Zoom 1.0):
  `naturalPct = (boxWidthPx / r) / heroHeight`, capped at page bottom − 6px so the bottom fade
  always completes **on-page**. Short boxes vertically center in the hero.
- Bleed structure: `.rp-hero.side { overflow:visible; z-index:2 }`; the following section is
  `position:relative; z-index:3` so **section copy always renders above the faded photo** (big
  Scale can never cover the Overview header). No section divider (border-top) under a bleed hero.
- Mobile: verticals full-bleed (phone is 9:16), landscapes center-crop; no overflow.

## 4 · Edge blend — construction (the hard-line saga, resolved)
Element structure is load-bearing — keep the names:
```
#rpWrap   absolute box, overflow:hidden, background:#07070A  ← geometry lives here
  #rpInner  inset:0                                          ← fade carrier
    #rpImg    the photo (background-image). In side mode: left/top/bottom inset 2px
              so the image NEVER touches a fading edge — the boundary pixel is the
              box's own black by construction. No transform at rest (only when Zoom ≠ 1),
              no transitions, no filters.
    #rpBlend  luminance wash (side mode)
    #rpFadeL / #rpFadeT / #rpFadeB   full-box overlays, inset:-2px
```
- Fades are **plain black gradient overlays spanning the entire box** with the transparent tail
  inside the gradient stops — never sized-to-zone elements (their edges seam), never CSS masks,
  never `mask-composite` (unsupported / seams on Peyton's Chrome).
- Box width set in **whole pixels** (fractional % edges glint).
- Left fade: solid head `max(11, k*.26)%`, then stops `.97@k*.4 · .86@k*.55 · .62@k*.7 ·
  .34@k*.84 · .12@k*.94 · 0@min(100,k*1.1)`; k = 36 + a·44.
- Top fade v = 16 + a·12 · bottom vb = 28 + a·12 (verticals) / 20 + a·10 (squares) /
  full-bleed: v2 = 10 + a·8, vb2 = 16 + a·10 — all eased multi-stop, exact stops in prototype.
- **Slider floor:** `a = 0.45 + (slider/100)·0.55`. Minimum blend = tighter fade, never a hard edge.
- Wash (`#rpBlend`): horizontal to k·0.95 + vertical top v·1.6 — eases bright content out.

## 5 · Framing controls (right column, UNDER the page preview)
Per-selected-photo (each slot keeps its own): **Across** (bg-pos x) · **Up·down** (bg-pos y) ·
**Scale** 80–140% (box footprint, capped 24–88% page width) · **Zoom** 100–160% (crop inside box) ·
**Edge blend** (see floor above). Sliders edit the active slot; carousel dots switch slots.
Touching a slider highlights the hero region (focus-follow).

## 6 · Hero copy block
- One left edge for everything: brand logo, kicker, campaign name.
- Brand logo from `brand_logos` (never typography): desktop h 96px, mb 18px; mobile h 54, mb 12.
  **Compensate each SVG's internal whitespace** (Brooks: margin-left −30px desktop / −17 mobile) —
  real build should measure per-logo, not hardcode.
- Kicker mono 12.5px, mb 10. Name Bebas 140px (mobile 60). Copy block bottom 56px (mobile 36).
- **No stats band, no glass strip, no metrics in the hero** (redundant with The Numbers).
  **No "Featuring …" credit.** Carousel dots bottom-right only.

## 7 · Overview section in the preview (and the page prose standard)
- Header: kicker + Bebas 68px (mobile 38), full brightness.
- Body prose: **#FAF8F5 white, Arimo, 19px/1.8 desktop, 16px/1.75 mobile**, desktop max-width 76%
  (bleed lane on the right), mobile 100%. Binds live to the Overview step's rich text.
- Next section starts 30px below the hero (mobile 20) — tight rhythm, no dead band.

## 8 · Shared builder behaviors (all 7 steps — already built in Steps 1–2 prototypes)
- **Zero rule:** any metric/row/box/donut-slice worth 0 auto-hides and locks (shared `isZero`).
- **Focus-follow:** every editable field declares a preview target; focus = orange outline + scroll.
- **Live preview panel:** true-width page (1280 / 390) scaled to fit; Desktop/Mobile toggle;
  ⤢ Expand fullscreen (Esc closes); live in all modes. 600px column, framing card beneath.
- Autosave status center-bottom; Save / Next in the footer bar; step rail with orange nodes.
- Step 1 additions: Drive campaign-folder row (Scan folders → subfolder names matched to athletes
  via ILIKE/TRIM), per-athlete Content column, "New from template" tracker creation (needs template
  Drive ID from Peyton). Drive is staging only — files copy to Supabase Storage on selection.
- Step 2: builder owns `settings.description`; live editor's copy field goes read-only.
- Hero lede default: "Campaign Recap · {year from campaign date}".

## 9 · Remaining pages to prototype before the merged build
Takeaways · Performers (fix contradictory MANUAL default) · Content (102-tile grid, athlete filter,
reuse AssetModal) · Sections & Publish. Then merge all pages into one multi-step HTML → write the
CC master brief pointing at the prototypes.
