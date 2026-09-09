# Portal pass 3 — run log

Branch `portal/pass-3` off `main` at 8ef5b7f (#263 merged). Every judgement
call, in the order the work was done.

## How this was verified

Same harness as passes 1–2: a throwaway `/portal/zz-preview-DELETE-ME` route
in the worktree, never committed, rendered by a CDP client at real 1440×900
and 390 viewports (headless Chrome clamps `--window-size` to 500px, so
`Emulation.setDeviceMetricsOverride` is what makes 390 mean 390).

**The harness renders as `anon`**, which sees a different CVS to a signed-in
brand contact: 0 live campaigns / 10 wrapped / 751 athletes, against 6 / 46 /
1,501 for `authenticated`. Two states therefore cannot occur in a render and
are checked with an explicit harness-only override, noted where used: live
campaign cards, and the in-progress live campaign.

---

## Bugs

### 1 · Search "does nothing" — already shipped, and verified

**No code defect found.** Search shipped in #262 and works. Verified three
ways before touching anything:

- `input.pgd-search` is hit-testable — `document.elementFromPoint` at the
  field's centre returns the input itself, on both the dashboard and the
  campaigns page, with `pointer-events: auto`, not disabled, not readonly.
- Typing through the real CDP input pipeline fills the field, and a synthetic
  Enter navigates: the URL went from the harness page to `/portal/search`.
- `/portal/search?q=jordan` on production returns **307 → /portal/login**,
  i.e. the route exists and is gated. A route that did not exist returns 404,
  which `/portal/nonexistent-xyz` does.

The report predates #262: through Phase 3b the box was a decorative `<span>`
that ignored every keystroke, which is exactly "typing + Enter does nothing".

**Judgement call:** rather than "fix" a working feature, the change is an
affordance. A lone unadorned pill gives no sign it is a control, and the only
way to discover Enter did something was to guess — so the field now carries a
submit button. Enter still works; it is no longer the only way in.

### 2 · Roster sticky header — the diagnosis was not z-order

Reported as z-order/background. Both were already correct, and measuring said
so: the `th` computed to `position: sticky`, `z-index: 1`, background
`rgb(17,17,20)` — fully opaque — and `elementFromPoint` at the header's centre
returned the `th`, not a row.

**The cause was `border-collapse: collapse`.** With collapsed borders the
header's own `border-bottom` is collapsed away, so the sticky cell carried no
visible boundary and the row scrolling beneath it ran straight into the header
text. Cropped and compared the header band under both modes at 2× to confirm:
under `collapse` there is no hairline under "School / Followers / Top reel";
under `separate` there is. `border-spacing: 0` keeps the layout identical, and
nothing in this table needs merged borders — `th` and `td` each set only their
own bottom edge.

A second, real defect surfaced while measuring: a row could sit half under the
header — Jordan Seaton's row began 22px inside a 34px header band — leaving a
row sliced through the middle of its type. Fixed with `scroll-snap-type: y
proximity` plus `scroll-margin-top: 34px` on the rows, so "aligned to the
start" means "aligned under the header". `proximity`, not `mandatory`, so a
deliberate small scroll is still possible.

### 3 · Campaign hero "eyes-only" — geometry, not a crop point

**A whole face was impossible at any crop point, and the arithmetic is the
answer.** Measured every CVS hero by reading the JPEG headers directly:

| campaign | source | orientation | band shows |
|---|---|---|---|
| SPF | 2400×3200 | portrait | **12.5%** of the image height |
| W/CWS | 4000×6000 | portrait | 11.1% |
| The Tournament | 3772×4715 | portrait | 13.3% |
| Minute Clinic | 3944×3944 | square | 16.6% |
| Holiday | 8192×5464 | landscape | 24.9% |

In a 1325×220 full-bleed band, `object-fit: cover` scales SPF's portrait to
1325×1767 and shows 220 of those 1767px. A head in a close-up occupies far
more than 12.5% of the frame, so every possible `object-position` was a slice
of a face. Shifting the crop point could only change *which* slice.

**Judgement call: the hero became a split** — the name on a dark ground, the
photo taking the right 46%. That drops the scale to 0.25, so the same 220px
shows **27%** of the image and a whole face fits, which the render confirms.
The 220px height from pass 2 is kept. It also gives item 4 its "hero as a dark
gradient with the name" for free, so both states are one component.

On the phone the split comes off and the photo goes full-bleed behind the
name: a 390×180 box scales SPF by 0.16 and shows 32% of the frame — more than
the desktop split. The geometry that forced the split does not exist there.

**Correction to an earlier run log.** A pass-2 note called `media.focal_y` a
missing column and logged adding it as the follow-up. It exists. It is
populated on **2 of 63** hero rows (320 of 4,533 media rows overall), so the
follow-up is *populating* it, not adding it. It is now read where present and
applied through a `--hero-focal` custom property; 26% is the default, which
suits a portrait, where faces sit in the upper third. A value outside 0–1 is
ignored rather than clamped: out of range means the column was written with a
different convention, and guessing which would move every crop.

### 4 · The in-progress live campaign

Hero as the dark gradient with the name, one line — "This campaign is in
progress — athletes and content will appear as they're confirmed." — and the
contact card. Nothing else renders: At a glance would be three absent figures
and Objective an empty brief.

Tabs are now only the ones with something behind them. Overview always shows;
Athletes needs a roster, Content needs media, Results needs figures,
takeaways or top content. With one tab left there is no tab row at all.

**The Approvals tab is gone, and not because it is empty.** It cannot be
sourced: `review_sessions.campaign_id` is a foreign key to `brand_campaigns`,
not `campaign_recaps` (CLAUDE.md's name twins), so no review session can ever
match a campaign on this page — not "has no rows yet", but structurally
incapable, even once the table fills. A tab that can never show anything is
worse than no tab. **Follow-up:** per-campaign approvals need that foreign key
resolved first.

### 5 · Tab history

`window.history.pushState` and a `popstate` listener, not `router.push`. The
tab lives entirely in a client component; a router push would round-trip the
server component — a fresh query for 132 athletes and 89 media rows — to
change which `div` is displayed. `?tab=` still works on a cold load and the
URL is still shareable, which is what the round trip would have bought.

Verified in a browser: clicking Athletes → Content → Results pushes each, and
three back presses walk `content` → `athletes` → Overview, with the URL and
the active tab agreeing at every step.

---

## Visual

### 6 · The dashboard hero tile's block moved to the top-left

The block is the tile's heading — campaign name, figures, provenance — and a
heading belongs where the eye starts. At the bottom it also had to fight the
photograph: these are portraits, so the face sits high and the busiest part of
the frame is low. Paired with moving the photo's focal point from 15% to 42%,
because a face framed at 15% now sits behind the name.

### 7 · "Posts this month" hidden, on Reach's rule

It read `athlete_deliverables.posted_at`, which is null on every row in that
table. So "0" was not a measurement — it was the absence of one wearing a
figure's clothes, and a brand reading *0 posts this month* beside a live
campaign concludes their athletes have stopped posting. Hidden until
`posted_at` carries dates, which is the only thing that would make it true.
Same rule as Reach · 14 days, which has been absent since 3a.

### 8 · Sports title-cased

`athletes.sport` holds both shapes, often for the same sport: 369 rows say
"TRACK & FIELD" and 123 say "Track & Field"; 209 say "FOOTBALL" and 64 say
"Football". Shouting at a brand in one row and not the next is the tell that
nobody formatted the column.

`titleCaseSport()` shares the school caser's engine and its conditional rule —
a value that already contains a lowercase letter is returned untouched, so
"WBB Coach" and "Football / Baseball" are left exactly as typed. Applied in
the loaders, not at render sites, so the Athletes page's sport filter dedupes
too: "FOOTBALL" and "Football" used to be two separate options in that
dropdown and are now one.

### 10 · Live campaign cards carry quarter · type

A live card says what kind of campaign it is; a wrapped one still says how big
the roster was. That is the fact that matters at each stage — nothing has been
delivered on a live campaign, so a roster count is the least interesting thing
about it, and a wrapped campaign's type is already in its recap.

### 11 · Content thumbnails — the measurement changed the rule

Asked for: the render endpoint at width 600 where `thumbnail_url` is empty,
with the original as an onerror fallback. Measured on the Content page's first
40 tiles, fetching every URL for real:

| rule | requests through the transform | total |
|---|---|---|
| before (thumbnail_url direct, transform only for non-web-safe) | 3 | **78.21 MB** |
| as asked (transform only where thumbnail_url is empty) | 9 | 75.70 MB (−3%) |
| **every tile through the transform at 600** | 40 | **9.69 MB (−88%)** |

**Judgement call: I widened the rule to every tile**, because the measurement
says the asked-for version fixes 6 rows and leaves 78 MB on the page.
`thumbnail_url` is not a thumbnail on this data — of those 40 rows it is
**byte-identical to `file_url` on 21** and empty on 6, so on 27 of 40 "serving
the thumbnail" means serving the original: mean 2.0 MB, largest 7.4 MB, into a
240px tile. The 13 rows where it genuinely differs are video poster frames,
and they are cheaper through the transform too. All 40 transform calls
returned 200; wall clock for the set was 2.8s.

Non-web-safe rows get no fallback: the fallback would be the very file that
paints as nothing (7 `.HEIC` rows, which is what made Bella Bonnett's tile a
black box in pass 1).

### 12 · Recap cards: photo, name, button

The figures that sat between the name and the button are gone — they are what
made these cards tall and ragged, and Reports is now a whole page of numbers.
The generic `.pgd-card` also stretches to its row's tallest sibling and pushes
its footer down with `margin-top: auto`, which is right for a footer of
figures and wrong for a single button: it left a band of dead tile under every
name. Recap cards size to their own content.

### 13 · The athlete card's figures got a real column

They were right-aligned but free-floating, so each card put its number
wherever its own text happened to end and a grid of them read as ragged. Now a
fixed 92px column with a hairline separating it from the name and meta, so the
figures line up down the grid.

### 14 · "Read-only for now" removed from Settings

It described the build, not the page. A brand reading it learns their settings
are broken rather than that these are the details Postgame holds for them, and
every panel already says who maintains it.

---

## Features

### 15 · Reports is a metrics dashboard

Five headline totals, a quarter chart, a sortable table, top ten athletes, CSV
export. Verified against CVS as `authenticated`: **46 campaigns, 1,501
athletes, 1,835 posts, 65,578,076 reel views, 7,207,142 impressions.**

**A new view, `portal_brand_report_totals` (migration 058), and it had to be
SQL.** `athletes` is a distinct-PERSON count across campaigns, and adding up
per-campaign athlete counts double-counts everyone on more than one campaign —
2,096 CVS athlete rows are 1,501 people. The dedupe rule is
`lower(btrim(name))`, deliberately **the same rule as `portal_brand_stats`**:
the Reports page and the dashboard KPI sit two clicks apart, and two different
athlete counts for one brand is exactly the bug that produced "1,501 vs
1,523". The 1,501 here matches the KPI exactly.

Per-campaign rows come from `portal_campaign_post_metrics` — already the
source the Results tab uses — so a campaign's row in this table and its own
Results tab cannot disagree.

**Judgement calls:**

- **Impressions = feed + story, added.** Each guarded independently, so a
  brand with feed data and no story data still gets a true figure. The label
  carries "feed + stories" so the sum is not mistaken for one platform.
- **Two scales on the chart, stated in the heading.** Posts run in the
  hundreds and reel views in the millions on the same data; one shared scale
  renders every posts bar as a hairline — honest and unreadable. Each bar
  carries its own value as text, so no length has to be decoded.
- **A series with nothing in it draws no bar.** Q4 2025 has 63 posts and no
  reel views, and a bar reading "0 reel views" asserts a measurement that was
  never taken.
- **Bar values sit outside the bars.** With the label inside, a bar needed a
  116px minimum and 63 posts looked like a quarter of 265 rather than a fifth.
  Measured after the change: 243px vs 1022px, i.e. 24% for 24%.
- **The chart is CSS, not a charting library.** Two series over three quarters
  is a list of widths; a library would be 80KB to draw what a div does, and
  the design system's colours are not any library's defaults.
- **Nulls sort last in both directions.** An absent measurement is not a small
  one, so it does not rise to the top of a descending sort.
- **A column nobody has is not rendered**, and a cell is blank rather than 0
  where that campaign has no figure. A zero in a metrics table is a claim.
- **The CSV carries raw numbers, not the display strings.** "8M" is useless in
  a spreadsheet. Fields are RFC 4180 quoted.

### 16 · Content keyword search — there are no tags to search

Asked for "any tag/caption text on the media row". **`media` has no caption or
tag column.** Its columns are ids, type, urls, storage/source ids, sizes,
focal points, hero flags and `slot` — and `slot` is populated on 5 of CVS's
460 rows with no vocabulary behind it.

So the searchable free text on a media row is athlete, school, campaign and
the **filename**, which is real text people recognise
("2026_CVS_Darius_Acuff_Jr.18.jpg"). The filename is decoded, stripped of its
path and its upload-timestamp prefix, and separators become spaces, so "darius
acuff" matches. Built once per row in the loader as a lowercase haystack
rather than rebuilt per keystroke across four fields.

Terms become removable chips and AND together with the dropdown filters.
Chips rather than one free-text box because they compose: "cvs" + "bag"
narrows, and either can be dropped without retyping the other. Verified in a
browser: "taylor" → 7 of 411 (athlete name), "snapinsta" → 24 of 411
(filename only, which is what proves the filename is in scope), chip removal
restores 40.

**Follow-up:** real tags need a column. If tagging matters, `media.slot` is
the candidate to formalise — it exists, it is unused, and it has no controlled
vocabulary yet.

### 17 · Recaps replaces Athletes in the rail

Rail is **Home · Campaigns · Content · Recaps · Reports**. The recap-card
library moved from `/portal/reports` to `/portal/recaps`; `/portal/reports` is
now the numbers. Two different things had been sharing one name: a shelf of
delivered recaps to open, and the totals across them.

`/portal/athletes` still works and is still linked — from a campaign's
Athletes tab, the roster tile, the Reports top ten, and search — it is just
not a rail item. The directory is a reference list of 1,501 people; five rail
items that each answer a question beat six where one is a phone book.

The Recaps icon is a document, not a tick: a tick reads as a completed task,
and these are delivered artefacts.

### 18 · "All athletes ›" goes to the campaign's Athletes tab

The tile shows 12 of one campaign's athletes, so "All athletes" meant "the
rest of these" — and it was landing people in a filterless list of everyone
the brand has ever worked with. Now
`/portal/campaigns/<slug>?tab=athletes`, falling back to the directory only
when the campaign has no slug.

### 19 · 20 · New-tab links

Audited every outbound link on the session portal: Top posts (dashboard), Top
content (Results), Open recap (Recaps library and the Reports table) all carry
`target="_blank" rel="noopener noreferrer"`. A post is Instagram and a recap is
a different app surface; in both cases the portal should still be there when
the tab is closed. The two other `/recap/` links in the tree are the old token
portal, left alone.

### 21 · The content lightbox needed next/previous and Esc

It opened on click and closed on the backdrop or the Close button. **Neither
paging nor Esc existed**, so it was verified as broken and then built:

- The lightbox now holds an **index**, not the item — next and previous need
  to know where they are in the list, and an item alone cannot say.
- Esc closes, ArrowLeft/ArrowRight step, bound only while it is open so the
  grid's own keyboard behaviour is untouched otherwise.
- Paging **stops at the ends rather than wrapping**: wrapping from the last
  item back to the first reads as a bug when you are paging to see what is
  there. The controls are disabled rather than hidden, so they do not move
  under the pointer.

Verified in a browser: opened at tile 3 ("3 of 40"), ArrowRight → 4, two
ArrowLefts → 2, Escape closed it.

### Phone regression caught while rendering

The Reports table's `min-width: 720px` propagated up through the panel and the
page and laid the whole main column out at **760px**. At 390 that pushed the
header, the search field and every panel off the right edge — clipped by
`.pgd`'s `overflow-x: hidden`, so the page looked cropped rather than
scrollable, and the cause was nowhere near the header it broke. Fixed with
`max-width: 100%` on the scroll container plus `min-width: 0` on `.pgd-page`
and `.pgd-panel`; after the fix the only element wider than the viewport is
the table, and its scroll parent clips it, which is the intent.
