---
name: postgame-design-system
description: Use whenever working on the Postgame Hub or any Postgame-branded output — frontend components, page layouts, public and brand-facing pages, or brand-facing copy (creator briefs, campaign recaps, opt-in and delivery pages, athlete captions, pitch pages, case studies, decks), plus marketing materials and generated graphics or video. Covers Postgame's four-font type system (Bebas Neue display, Anton heavy, Arimo body, JetBrains Mono labels), the three-color palette (#07070A black, #D73F09 orange, #FAF8F5 off-white), the Liquid Glass Dark surface recipe, the logo-file-not-typography rule, the NCAA trademark blocklist, layout patterns and their mobile reflow, brand voice, and tech-stack conventions (Next.js App Router, Tailwind, Supabase, shadcn/ui, Vercel). Apply to any frontend code, copywriting, image or video generation, or design decision touching a Postgame product or deliverable.
---

# Postgame Design System

Postgame is an NIL sports-marketing agency: it connects brands with college
athletes and runs the full campaign — sales, brief, shoot, approval, posting,
recap. The product is the Postgame Hub (Next.js + Supabase) plus brand-facing
deliverables.

For the full pattern geometry and mobile reflow rules, read
`reference/patterns.md`. Everything below applies to all Postgame work.

---

## Hard rules — never violate

These are not preferences. Break one and the output is wrong no matter how
good it looks.

1. **The Postgame mark is a file, never typography.** On any product, mockup,
   merchandise, graphic, or generated image, use the actual logo file (§Assets).
   Never set the word "POSTGAME" in a typeface and treat it as the logo.
   Writing "Postgame" as a company name inside body copy is fine — the rule
   governs the visual mark on products.

2. **Client logos come from the database, never from imagination.** Pull from
   the `brands` table. Never AI-generate, redraw from a screenshot, or
   approximate a client logo in SVG.

3. **No NCAA trademark terms in brand-facing copy.** Banned: "March Madness,"
   "Final Four," "Elite Eight," "Sweet Sixteen." Postgame is not licensed. Use
   "the tournament," "the Big Dance," "round of 64 / 32 / 16 / 8," or describe
   the round generically. Internal notes are exempt; anything a brand, athlete,
   or the public sees is not.

4. **Flat edges get an edge-blend.** Any image, video tile, or media panel with
   a hard rectangular edge on the black ground gets a soft black gradient at
   that edge so it dissolves into the background. Subtle — it must never darken
   a face. Put the fade on the empty side of the crop.

5. **Orange is a destination, not a surface.** `#D73F09` marks where the eye
   lands: CTAs, rules, eyebrows, active states, step numbers, links. Never a
   page background, never a large fill, never body text.

6. **Never fabricate people, quotes, or metrics.** Athlete names, brand
   contacts, testimonials, client quotes, case-study results and performance
   numbers come from the database or from Peyton — or they are left as visibly
   labelled placeholders. Apply the same standard as logos: a missing logo gets
   an empty slot, so a missing athlete gets an empty slot too.
   - Placeholder people use obviously-placeholder names — `Athlete Name`,
     `School · Sport`, `Brand contact` — never realistic invented ones like
     "Jordan Reese · Ole Miss · Football." A realistic fake is worse than a
     blank, because it survives review and reaches a client.
   - Never invent a testimonial. Not even attributed vaguely
     ("a marketing director at a previous campaign"). If no real quote is
     available, leave the pull quote empty and labelled.
   - Projected or illustrative numbers must be labelled as projections on the
     surface itself, not only in a caption, and must never be presented in the
     same styling as verified results.
   - This applies to every deliverable that leaves the building: pitch pages,
     recaps, case studies, decks, one-pagers, briefs.

---

## Color

Three colors. There is no fourth. Depth comes from opacity and blur, not hue.

| Token | Hex | Role |
|---|---|---|
| `--pg-black` | `#07070A` | The ground |
| `--pg-orange` | `#D73F09` | Accent only (rule 5) |
| `--pg-off-white` | `#FAF8F5` | Display, text, light elements |

**Opacity ladder** — off-white is never used at a random opacity:

| 100% | Display, headlines, stat figures, active nav |
| 90% | Lead paragraphs |
| 68% | Body copy — the default |
| 50% | Labels, captions, meta, inactive nav |

---

## Typography

**Four jobs, four fonts.** If type doesn't fit one of these roles, the role is
wrong — not the font list.

| Role | Font | For |
|---|---|---|
| Display | Bebas Neue | Hero lines, H1/H2, athlete names, card titles. Uppercase, tight. |
| Heavy | Anton | Campaign titles and stat figures **only**. Used sparingly. |
| Body | Arimo Regular / Bold | Everything read at length. Metrically identical to Arial; `Arial` is the correct fallback. |
| Label | JetBrains Mono Medium | Eyebrows, stat labels, captions, nav, buttons, tags. Uppercase, letterspaced. |

Anton ships in one weight only. It cannot do anything needing a light or
regular cut — which is why pull quotes are Arimo Bold, not Anton.

| Role | Desktop | Tablet | Mobile |
|---|---|---|---|
| Hero H1 (Bebas) | 76–92 | 56 | 40 |
| Section H2 (Bebas) | 48–58 | 40 | 30–32 |
| H3 (Bebas) | 20–26 | 20 | 20 |
| Campaign title (Anton) | 68 | 48 | 34 |
| Stat figure (Anton) | 68 (56 if long) | 48 | 40 |
| Pull quote (Arimo Bold) | 46 | 34 | 26 |
| Lead para (Arimo) | 21 | 19 | 18 |
| Body (Arimo) | 16 | 16 | 16 |
| Eyebrow (Mono) | 13 | 12 | 11 |
| Label (Mono) | 10 | 10 | 10 |

Line-height: hero 0.90 · H2 0.98 · stat 0.92 · lead 1.5 · body 1.76 (1.7
mobile). **Body never drops below 16px.** Display shrinks hard; body does not.

---

## Surfaces — Liquid Glass Dark

Translucent layered panels on a rich dark ground. Depth from transparency and
blur, never heavy borders or drop shadows.

| Tier | Fill | Border | Radius | Blur | For |
|---|---|---|---|---|---|
| Raised | `rgba(250,248,245,0.07)` | 1px `rgba(250,248,245,0.14)` | 16–20 | 26 | Stat bars, nav pills, modals |
| Card | `rgba(250,248,245,0.04)` | 1px `rgba(250,248,245,0.10)` | 16 | 26 | Grid cards, tiles, list rows |

Card padding 24–26 desktop → 20 mobile.

**Buttons.** Primary: orange fill, radius 12, Mono label in white, uppercase.
Secondary: glass pill, `rgba(255,255,255,0.06)` fill, 1px
`rgba(255,255,255,0.14)` border, radius 12. Nav pills: radius 999.

---

## Data states — verified, projected, placeholder

Rule 6 made structural. Any component showing a fact — figure, name, quote,
logo — carries a state, and the state governs how it renders.

| State | Means | Renders as |
|---|---|---|
| `verified` | From the database or confirmed by Peyton | Full styling, 100% ink, no chip |
| `projected` | Estimate or extrapolation from comparable campaigns | Figures at 90% ink, "Projected" chip, optional basis note |
| `placeholder` | No data yet | Em dash `—` behind an "Awaiting verified data" chip |

- **Default is `placeholder`, not `verified`.** A component handed no data
  renders empty, never plausible. The safe state must be the automatic one.
- **Never style a projection as a result.** Opacity drop *and* chip together —
  dropping either breaks the distinction.
- **The chip sits on the surface, not in a caption.** Captions get cropped out
  of screenshots and lost when a section is lifted into a deck.
- Empty quote → labelled slot ("no verified quote on file"), never an invented
  testimonial. Empty athlete → `Athlete Name` / `School · Sport`. Empty logo →
  labelled slot bound to the `brands` column.

Generalizes beyond these components: any surface that could show a fact it
doesn't have should show its absence legibly. A blank gets caught in review; a
plausible fake reaches the client.

---

## Layout

Marketing/public: canvas 1440 · margins 96 · **content 1248** · section padding
~120 · grid gutters 20–24.

Breakpoints: desktop >1000 · tablet ≤1000 (padding 40) · mobile ≤750 (padding 20).

Hub app surfaces use the same tokens with a fluid container, and **mobile nav
is a bottom tab bar** — never a hamburger, never a top nav.

Copy length is a floor, not a target. If a layout can't hold the copy, change
the layout.

**Touch rule:** on touch devices the hover state becomes the resting state and
the click becomes a tap. Never hide content behind hover on mobile.

---

## Voice

Confident, athlete-forward, no fluff. Postgame talks to brands and athletes
like peers, not like an agency pitching them.

- Short sentences. Active voice.
- Sports-aware, never corny. No "game-changer," "leveling up," "slam dunk."
- Lead with the number or the outcome, then explain.
- Name athletes when a real person is meant — not "creators" or "talent."
- Never oversell. The work is the argument.

**Write:** "54 athletes. Six schools. Live in nine days."
**Don't:** "We're thrilled to announce an exciting partnership that will
revolutionize how brands connect with the next generation."

---

## Assets

Postgame brand row: `brands.id = 7a0e28e9-d62f-427d-a207-cd22596fcf50`
Supabase project ID `xqaybwhpgxillpbbqtks` (always reference by ID — several
projects exist and their names mislead).

| Column | What it is |
|---|---|
| `logo_primary_url` | Wordmark, default |
| `logo_dark_url` | Wordmark, dark ink — for light grounds |
| `logo_light_url` | Wordmark, light ink — for dark grounds |
| `logo_icon_svg_url` | Icon (orange circle + white plus), SVG master |
| `logo_icon_url` | Icon, 1024px transparent PNG fallback |

**Wordmark vs. icon.** Wordmarks are ~5:1 lockups — page headers, footers,
deck covers, recap and pitch branding, anywhere with horizontal room. The icon
is square — favicons, app icons, social avatars, video watermarks, small
badges on product. Prefer the SVG; fall back to the PNG for PPTX export,
social previews, and Pillow/FFmpeg generators.

**Icon provenance.** Rebuilt 2026-07-27 from the original 276px JPEG, which had
a baked-in white square and couldn't scale or sit on dark. Geometry was
*measured* off the real file — circle r138 on a 276 canvas, plus 172×172, arms
50 thick — and the orange corrected from the JPEG's `#D63F08` to `#D73F09`.
This is the one sanctioned exception to hard rule 2, sanctioned because the
measurements came from the authentic file. Never re-derive the icon from a
screenshot, render, or AI generation. If the original 2023 vector surfaces,
prefer it.

**Fetching note.** These public URLs render in a browser but can't always be
fetched server-side from a sandbox. For compositing, download locally first.

---

## Tech conventions

Next.js 14 App Router · TypeScript · Tailwind · Supabase (Postgres + Storage +
RLS) · Vercel. Deployed from `peyton-rgb/postgame-hub`.

Reach for shadcn/ui primitives first and restyle with the tokens above, rather
than rebuilding buttons/dialogs/inputs from scratch.

---

## Self-check — what off-brand looks like

Run this against any output before showing it. Any hit means it's wrong:

- More than three colors, or orange as a background
- "POSTGAME" set as type on a product or mockup
- A client logo drawn rather than fetched
- **A realistic-sounding athlete name that isn't in the database**
- **A testimonial or client quote that wasn't actually said**
- **A metric presented as a result when it's a projection**
- The wide wordmark crammed into a square slot — that's the icon's job
- The icon with a solid square behind it — it's transparent; a square means the
  wrong file (the old JPEG)
- Body copy below 16px, or body at full opacity (should be 68%)
- Heavy borders or drop shadows instead of translucency and blur
- A hard image edge on the black ground with no fade
- A font outside the four above
- A hover-only interaction on mobile
- Any of the four NCAA terms in brand-facing copy
- Copy that sounds like a press release

## When in doubt

Ask Peyton before guessing — especially before introducing a new color,
deviating from Liquid Glass, or writing copy that references college
postseason.
