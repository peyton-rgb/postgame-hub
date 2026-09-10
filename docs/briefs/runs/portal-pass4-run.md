# Portal pass 4 — run log

Branch `portal/pass-4` off `main` at bd4053c (#266 merged).

Harness caveat as always: it renders as `anon` (0 live campaigns / 10 wrapped /
751 athletes) against 6 / 46 / 1,501 for a signed-in contact, so figures in the
attached shots are the anon view.

## Global

### 1 · The portal is branded for the brand

The brand's own dark-surface lockup sits left of the page title with "Brand
portal" beneath it, separated by a hairline so the two are read as two things
rather than one lockup. The Postgame mark stays in the rail — the two marks
never compete for the same corner.

**Nothing new is queried.** `attachPortalLogo()` already resolves a
dark-surface lockup from `brand_logos` for every session page, so the shell
only renders what `resolveSessionPortal()` had already fetched.

**A bug I wrote and then caught in the render:** the first cut used
`brand.portalLogo` directly and produced `src="[object Object]"` — that field
is the resolved logo ROW, not a URL. Probing the rendered `<img>` is what
surfaced it (`naturalWidth: 0`, src `/portal/[object%20Object]`); the file
itself was fine, 200 and 186KB.

**Not `pickBrandLogo()`, deliberately.** That shared helper's fallback chain
reaches `logo_dark_url` before `logo_light_url`, and per CLAUDE.md those names
describe the INK, not the background — `logo_dark_url` is dark ink for a LIGHT
background, which on this near-black ground renders as an invisible smudge.
The portal uses its own accessor that prefers the resolved dark-surface row and
then light-ink columns only. Brands with `brand_logos` rows are unaffected;
this only changes which legacy column a brand without them falls back to, and
`pickBrandLogo` is left alone for the light-background surfaces that use it
(invite email).

No logo on file sets the brand's NAME in Bebas. A name is a fact; a
placeholder square is not. And a client logo is never redrawn or generated —
it is the file from `brand_logos` or it is type.

### 2 · Labelled rail

200px with icon + label for the five destinations, Postgame mark at the top,
Settings and the account at the foot. Collapses to the 72px icon rail under
1100px, where the tooltips come back — they are what a collapsed rail falls
back to, and with a label beside the icon a tooltip repeating it is noise. The
phone tab bar below 640px is unchanged.

The account disc carries **initials**, not an empty circle: a blank disc reads
as a missing avatar, initials read as a person we have no photo of — the same
rule the roster, the athletes directory and Top athletes already follow. The
label is the signed-in person from `chrome.personLabel`, which exists on both
the brand-session and admin-preview branches.

### 4 · Search

"Search campaigns, athletes", and the field widened 260 → 320px. The placeholder
is 210px at 14px Arimo, so the old width truncated it before anyone typed
anything.

### 3 · Real thumbnails, generated once

`scripts/generate-portal-thumbnails.js`, run for CVS. **410 of 411 media rows
now have a generated 600px thumbnail in the bucket.**

| | rows | stored |
|---|---|---|
| generated from the original | 307 | 68.3 MB |
| generated from a video poster | 103 | 15.5 MB |
| unreadable, left alone | 1 | — |

**The 40-tile Content page, measured three times:**

| | total | transform calls |
|---|---|---|
| before pass 3 | 78.21 MB | 3 |
| pass 3 (every tile through the transform) | 9.69 MB | 40 |
| now (stored thumbnails) | **9.69 MB** | **1** |

Same bytes, and the transform is off the critical path: a tile no longer
depends on a separate service being up and unthrottled to render.

**Three things went wrong, and each changed the job.**

**1 · The transform rate-limits.** A first run at concurrency 6 lost 108 of 307
rows to `429`s. Added exponential backoff with jitter and dropped the default
concurrency to 3 with a breath between requests — the endpoint is shared with
the live site's own image loads. A 429 means "later", not "no".

**2 · The transform refuses very large originals.** 16 rows returned `400` no
matter how patiently retried. They are 27–33 MB and **45–50 megapixels** —
past Supabase's transform input limit. Those are now resized locally with
`sharp` instead (already a dependency), with `limitInputPixels` raised because
these ARE the huge ones and the default guard is about untrusted input, not
our own bucket.

  **This was a live bug, not just a job problem.** Since pass 3 the portal
  routes every tile through the transform — so those 16 tiles have been
  rendering as broken images in production. My pass-3 measurement sampled 40
  tiles and happened to contain none of them.

**3 · "Distinct" is not "small", and skipping on it was wrong.** The first cut
treated any `thumbnail_url` differing from `file_url` as done. Measuring CVS's
104 such rows: they average **3,957 KB** and the largest is **22.12 MB** —
full-size images, mostly video poster frames, living at another path. Reading
them directly took the same 40-tile page to **25.23 MB**, worse than the
transform call it replaced.

  So the "done" test became "the thumbnail is one this job made"
  (`/portal-thumbs/`), and video rows are now resized **from their poster**
  rather than skipped — an image transform cannot open an `.mp4`, but the
  poster is an image, and those 103 posters were the heaviest tiles on the
  page. 162.3 MB of posters became 15.5 MB.

**The one failure** is an extensionless file whose poster is also extensionless
and is not a decodable image (`CVS_postgame_video_-_Callie_Freeman`) — the same
family as the two unidentifiable rows logged in pass 1. Neither the transform
nor sharp can read it. The job writes only on success, so that row keeps what
it had and the app's fallback carries it.

**Reading order in the app is now:** stored thumbnail (if web-safe and not
just the original) → transform of the original → the original. A stored
thumbnail still needs a fallback because an object can go missing; the
transform path stays for rows no job has reached — other brands, and anything
imported since.

## Dashboard

### 5 · The KPIs became three small tiles — my call, and why

They were figures floating in the header, level with the greeting, which read
as chrome rather than content. They are now the page's first row: **Live
campaigns · Wrapped · Athletes**.

Removing them was the alternative and I did not take it: "Athletes, all
campaigns" is the only place on the dashboard the brand's own size appears —
the roster tile counts one campaign. **Wrapped is new to the row**, which is
what makes three tiles rather than two, and it let the Campaigns strip drop its
"0 live · 10 wrapped" subtitle, which had been saying the same thing again.

### 6 · Roster subtitle

"132 athletes · 102 schools" only. The quarter and the platform were also on
that line — the whole string was "Q2 2026 · Instagram (Feed + Reels + Stories)
+ TikTok · 132 athletes · 102 schools", which wrapped to two lines at 1440 and
three on a phone. Both facts are on the campaign's own page, one click away.

### 7 · Top posts

"933K views" on one line. The number and its unit belong together, and the
stacked pair cost a second row in each of six cards.

### 8 · "View campaign →" on the hero tile

The tile was a dead end: a photograph, a name and three figures, with no way
into the campaign they describe.

### The rail widening broke the grid, and fixing it removed a duplicate

The 200px rail took 128px out of the content column, and at the old 3/6/3
split that landed entirely on the two narrow tiles. **Top posts fell to
294px**, where every athlete name wrapped and six rows needed 725px of content
in a 566px box — four of six visible.

The fix was to drop the roster's **"Top reel" column**, which duplicated the
Top posts tile sitting directly beside it: the same campaign's reels, ranked,
twice on one screen. That freed a column, so the split is now 3/5/4 — Top
posts back to 392px with all six rows, the hero back to three columns, and the
roster's table under its own minimum width with three columns instead of four.

Names and metas in Top posts are now single-line and ellipsised: it is a
ranked list read down its left edge, a wrapped name costs every row below it a
line, and the full name is on the post the row links to.

Row height re-measured rather than assumed at each step: 640 → 712 → 730, the
last because dropping a column made the school column wrap and rows grew from
64px to 71px. Final: 8 roster rows and all 6 top posts clear of the fade,
Campaigns at y=989. Campaigns now begins just below the fold rather than just
above it — that is what the three KPI tiles cost, and it is the right trade:
tiles are read at a glance, the campaigns row deliberately.

## Campaigns, detail, content, recaps, reports

### 9 · Live campaigns are a list, not cards

A live campaign has no recap, no hero and usually no roster, so a card was a
large rectangle carrying two facts. Rows carry the same two — name, quarter ·
type, "In progress" — and stack.

### 10 · Photoless wrapped cards, and the events toggle

A wrapped campaign with no photo gets a **flat** dark panel at **half** the
height of a photo card, name in Bebas. Not a gradient: a gradient reads as an
image that failed to load. Half height stops a row of photoless campaigns
claiming the space of a row with pictures.

**Events are hidden by default.** 27 of CVS's 46 wrapped campaigns have no
athletes — Valentine's Day, PNW Content, Leadership Video, CVS Round Table,
the surveys — because they are events and one-offs, not content campaigns.
"Show events (N)" brings them back. Same reasoning as the Reports table's
default, and the same escape hatch.

### 11 · The hero carries the whole header

Full-bleed photo with a left-to-right scrim: name and quarter · type on the
solid end, the three At-a-glance figures on the clear end. The separate At a
glance panel is gone, and so is the small subtitle above the hero — it was
printing quarter · type 40px above where the hero now prints it.

**The geometry has not changed and is worth restating.** A 1325×220 band shows
about 12.5% of a portrait hero's height, so no crop point can contain a face —
which is why pass 3 split the hero in two. Going full-bleed brings that back,
and the render shows it: SPF's hero is hair and skin texture rather than a
face. The scrim is what makes it acceptable — the copy sits on the near-solid
left and the photograph is texture behind the figures — but it IS a trade, and
**populating `media.focal_y` (2 of 63 hero rows today) remains the fix.**

### 12 · School filter is a dropdown

SPF has 102 schools. The pill row showed the first eight and silently dropped
94 — a filter that lied about its own options. A select holds all of them in
one line.

### 13 · Content filter row

Search first and widest; the dropdowns compact after it. Search answers "where
is the shot of X", which is what someone opens the page to ask; the dropdowns
narrow a set you are already looking at.

### 14 · Every tile says what it is

Only videos carried a marker, so a photo was identified by the *absence* of
one — legible only if you already know the rule. Video keeps the orange play
badge, because it is the tile that behaves differently when clicked; a photo
gets the same shape in glass.

### 15 · Photoless recap cards match the photo cards

Same 150px band, dark, name in Bebas. A short card beside tall ones reads as
one that failed to load, and those recaps are as delivered as the rest.

### 16 · Space before "Show all"

20px of clear air. It sat hard against the count, and a button touching the
text it modifies reads as part of the same phrase.

### 17 · The reports grid closes

`align-items: stretch` on the split. The side column's panels were sized to
their own content, so the row closed on whichever side was taller and left a
band of empty page under the other. Measured after: chart bottom 1089, side
bottom 1101 — the 12px is the gap between the two stacked panels.

### 18 · Gridlines — already shipped

Three lines labelled on both scales landed in #266. Verified still present:
left `265 / 177 / 88`, right `19M / 13M / 6.4M`.

### A near-miss worth recording

Rewriting `mediaThumb()` deleted `searchText()`, which lived in the same block
— and **`next build` did not catch it**, because this repo sets
`typescript.ignoreBuildErrors: true` in next.config. A green build is not
evidence of type correctness here; `tsc --noEmit`, filtered to the files in
hand, is. Caught by running exactly that. The Content page would have thrown
`searchText is not defined` at runtime.

## Mobile (19)

Measured at 390 on the three named pages before changing anything, and again
after. **No horizontal overflow on any of them**, the bottom tab bar is
present with its five items pinned at the viewport foot, and the rail is
hidden. The only element wider than the viewport anywhere is the dashboard's
roster table, correctly clipped inside its own scroll container.

**One thing was broken and is fixed.** The campaign hero's three At-a-glance
figures were a CHILD of a fixed-height, `overflow: hidden` hero, so on a phone —
where they have to sit below the photo, since three Anton numbers and a 30px
name cannot share 350px — they were clipped out of existence. The figures are
now a sibling of the hero inside a positioned wrapper: desktop absolutely
positions them into the hero's right side, the phone renders them in flow
underneath. Hero capped at 200px there.

## Thumbnails: two more findings after the first run

**The job's scope did not match the app's.** The first cut filtered
`campaign_recaps` with `.neq('lifecycle_status', 'draft')` by hand while the
Content page reads `portal_campaigns` — and the two disagreed: the job saw 411
media rows where the page showed 522. The job now reads the same view the app
does, so the scopes are identical by construction rather than by two
hand-matched filters kept in sync. **101 rows the first run never saw have now
been generated.**

**Final state for CVS: 505 of 528 rows have a generated thumbnail.** Of the
rest, 17 have no usable source (no storage URL at all) and **6 cannot be
decoded by anything**: five are Sony RAW `.arw` files and one is the
extensionless video poster. A `.arw` will never render in a browser, so those
tiles could not be fixed by any thumbnail strategy.

**So undecodable tiles now have a designed state.** They were showing the
browser's broken-image glyph — 8 of the first 40 tiles. The image is hidden on
final error and the tile rests as its own dark surface, still carrying its
caption and type marker, with the shimmer stopped because nothing is coming.

**Follow-up, with evidence: the sources are extremely tall.** 31 of the first
40 content tiles have a source taller than 3:1, up to **600×6224** — a 1:10
image. A 4:5 tile shows about 8% of that, which is why those tiles read as
crops of a chin or a hoodie. The thumbnail job preserves aspect ratio, so this
is inherited from the originals, not introduced. The fix is a 4:5 attention
crop at generation time (`sharp` supports it) — worth doing, and deliberately
not folded into this pass, which would have meant regenerating all 505 again.

## A note on the figures in the attached renders

The anon view now shows **17 wrapped campaigns and 1,585 athletes** where
earlier passes showed 10 and 751. That is not a code change: six campaigns were
touched at 11:03 today, so more of CVS's work became publicly visible while
this pass was running. Checked rather than assumed.
