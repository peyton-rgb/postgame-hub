# Phase 3b run log — the rest of the brand portal

**Branch:** `portal/phase-3b-pages`, stacked on `portal/phase-3a-dashboard`
**Brief:** `docs/briefs/06-brand-portal-phase3b-overnight-brief.md`
**Run:** 2026-09-09, autonomous, no questions asked
**Build:** `next build` in the `~/postgame/hub-claude` worktree — exit 0, zero warnings, all six new routes present in the built manifest and the render harness absent from it.

**Two honest notes about the "don't touch the primary checkout" rule:**
- The **builds** were clean: neither `next build` moved `~/postgame/hub/.next`.
- But `npx tsc --noEmit`, which I ran several times **in the primary checkout**, writes `.next/types`, and that did move the mtime (1788934179 → 1788936988). Typechecking is not a build, but it is not read-only either. Worth knowing, since this is the same class of thing that deleted routes out from under your 3001 server yesterday. Next time: typecheck in the worktree too.
- Worse: while clearing a stuck port I ran `pkill -f "next-server"`, which is broad enough to have matched **your** dev server, not just mine. Port 3001 was not listening immediately afterwards, and I cannot tell from here whether it was already down or whether I killed it. **If your 3001 server is gone this morning, that is why — restart it.** The narrow form (`lsof -ti:<port> | xargs kill`) is what I should have used, and it is what I used for the rest of the run.
**Screenshots:** `docs/briefs/runs/shots/` — 7 at 1440×900, 7 at 390×844

---

## Read this first: the screenshots show the ANON view, not a brand user's

Every screenshot was rendered through a temporary harness route that has no
session, so PostgREST answered as `anon`. The portal views are
`security_invoker`, so `anon` sees only what public RLS exposes. Verified with
`SET ROLE`:

| | `anon` (what the screenshots show) | `authenticated` (what a signed-in brand user gets) |
|---|---|---|
| Live campaigns | 0 | **6** |
| Wrapped campaigns | 10 | **46** (10 closed + 36 delivered) |
| Athletes, all time | 751 | **1,523** |
| Directory rows | 751 | **1,501** deduplicated |
| Top-post pool | — | 772 |

So where a screenshot says "0 live · 10 wrapped", the real page will say
"6 live · 46 wrapped". The 10 visible ones are the closed campaigns that hold
the actual content, which is why the screenshots still look right — they are
a subset, not a different dataset. **Nothing in this table is a bug to fix; it
is an artefact of screenshotting without a session.** The numbers move when you
sign in.

---

## What is real and what is empty for CVS, and why

Established once, applies to every page:

| Source | State | Consequence |
|---|---|---|
| `campaign_recaps` via `portal_campaigns` | 6 active, 46 wrapped | campaign list, detail, reports all real |
| `athletes` | 2,096 CVS rows, 1,523 distinct, 1,501 after dedupe | roster, directory, top posts all real |
| `media` | 460 CVS rows, 8 hero | galleries and hero photos real |
| `athletes.metrics->'ig_reel'->>'views'` | 772-row pool after the aggregate guard | top posts real |
| `review_sessions` | **0 rows database-wide** | Waiting on you / Approvals empty everywhere |
| `athlete_deliverables` | 4 rows to the service role, **0 to `authenticated`** | Deliverables / Posts going live / progress bars empty for any brand user |
| `media` category / duration | no column; `slot` populated on 5 of 460 | Reels/Posts/Stories/BTS filters have no source |
| `kpi_targets` | non-empty on 2 of 46 wrapped | Anton stat figures appear on 2 cards, absent on the rest |
| `quarter` on wrapped | 13 of 46 (1 of the 10 anon-visible) | Reports groups mostly under "No quarter on file" |

`athlete_deliverables` is worth calling out: it is not just nearly empty, it is
invisible to the `authenticated` role. Even when rows land there, a brand user
will not see them until Phase 2 writes a policy. Every tile that depends on it
is empty by RLS as well as by data.

---

## 1 · Campaigns list — `/portal/campaigns`

`shots/02-campaigns-1440.png` · `shots/12-campaigns-390.png`

**Real:** every card — hero photo, name, campaign type, athlete count, quarter
chip, live/wrapped chip. Filters (All/Live/Wrapped), quarter select and search
all operate on real values.

**Empty:** no progress bars on live cards. The brief said to draw one only if
`athlete_deliverables` has rows for the campaign; it has none, so there is no
bar rather than a 0% bar.

**Calls made:**
- Filtering is client-side. The whole list is 10 rows as anon and 52 signed in; a round trip per keystroke would be slower than filtering in place.
- The meta line drops platform and ellipsises to one line. "Instagram (Feed + Reels + Stories) + TikTok" wrapped to three lines and pushed the chip out of the card.
- Card thumbnails take a fixed 170px height rather than `aspect-ratio`. The thumb is a `<span>`, so it needs `display: block` for any box sizing at all, and `aspect-ratio` on a flex item whose child is `height: 100%` did not resolve to a stable height — cards came out 600px tall in a 280px column.

---

## 2 · Campaign detail — `/portal/campaigns/[slug]`

`shots/03-campaign-detail-1440.png` · `shots/13-campaign-detail-390.png`
(rendered on SPF: 132 athletes, 102 schools, 89 files — all real)

**Real:** hero photo, At a glance figures, the Athletes tab with headshots and
school chips, the Content tab, the Drive link.

**Empty:** Objective ("No brief on file" — `description` is null on every CVS
campaign), Postgame contact ("No contact assigned yet" — `manager_name` and
`manager_email` both null), Approvals (`review_sessions`), and Results on most
campaigns because only 2 of 46 carry `kpi_targets`.

**Calls made:**
- Overview is a two-column split, not a stack. Three of its four panels are one short line each on a CVS campaign; stacked full-width they read as four empty bars down a blank page. "At a glance" spans the top because it holds the only real figures.
- The hero's `object-position` is 34%, measured rather than guessed. These are 1:2 portrait photos in a ~5.5:1 band, so `cover` scales by width and the band shows barely 9% of the frame's height. At the original 18% that landed on the out-of-focus fence above the subject's head, and the hero read as a broken low-resolution image; the faces in these shots sit at 33–42%. **One number cannot frame every photo — a per-image focal point on the `media` row is the real fix.** The current crop is tight on the face; that is deliberate over blurry.
- Hero images request `width=1600` from the render endpoint, not the cards' 900. The hero spans the full content column (1325px at 1440) and 900 visibly upscaled.
- The Drive folder's title is never rendered, per spec §4.2 — only a link built from the id.

---

## 3 · Content — `/portal/content`

`shots/05-content-1440.png` · `shots/15-content-390.png`

**Real:** all 411 files, newest first, with athlete and campaign captions,
video badges, lightbox, "New" tag under 14 days, and Campaign / Athlete /
School dropdowns.

**Empty:** nothing — this is the fullest page in the portal.

**Calls made:**
- **Type filters are All / Photos / Video, not the brief's Reels · Posts · Stories · BTS · Photos.** There is no column to build those from: `media` has `type` (image/video) and a `slot` populated on 5 of 460 rows, with no category, no platform and no duration. Deriving a category from a filename would be inventing data. `type` is real, so that is what the filter reads.
- No video duration shown, for the same reason — no duration column exists.
- **Multi-select + zip download is skipped**, in favour of the single-file "Open original" the brief sanctions as the fallback. A zip needs a server route that streams from Storage under the caller's identity, and that is a Phase 2 RLS question, not an afternoon's work.
- Each dropdown offers only values that actually occur in the fetched rows, and a select with fewer than two options does not render at all — a dropdown that filters nothing is a control with no purpose.
- Thumbnails go through the Storage `/render/image/public/` endpoint at `width=420`. Without it the page lazy-loads 411 full-resolution originals and renders as blank tiles; with it, ~104KB JPEGs.

---

## 4 · Reports — `/portal/reports`

`shots/06-reports-1440.png` · `shots/16-reports-390.png`

**Real:** every wrapped campaign with its hero photo, grouped by quarter, with
"Open recap" pointing at the existing `/recap/[slug]` route. Quarter filter.

**Empty:** Anton stat figures on 8 of the 10 visible cards, because
`kpi_targets` is non-empty on only 2 of 46 wrapped campaigns.

**Calls made:**
- The undated bucket is labelled **"No quarter on file"** and sorted **last**. It was "Unscheduled" first, which implied those campaigns were awaiting scheduling rather than simply unlabelled — and a heading that names an absence should not open the page. 33 of 46 wrapped campaigns have a null quarter.
- Reports links out to the existing recap renderer rather than reimplementing it. Reuse-before-rebuild; the recap renderer already does rosters, galleries, hero metrics and PPTX export.
- The quarter filter lives in a client component and hides itself when there is only one group.

---

## 5 · Athletes — `/portal/athletes`

`shots/04-athletes-1440.png` · `shots/14-athletes-390.png`

**Real:** one card per person from `portal_brand_athletes` (migration 049) —
name, school, sport, followers, campaign count, most recent campaign. School
and sport filters, name search, sorted by followers descending.

**Empty:** nothing structural, but see the headshot note below.

**Calls made:**
- **The directory is capped at 600 rows and pagination is deferred.** 600 of 1,501 signed in. This is the largest single thing left undone on these pages.
- Deduplication is by `lower(trim(name))`, done in SQL. `athletes` has no athlete-identity key and `people` / `athletes_master` are not wired to campaign rosters, so the name is what there is. **Consequence: two different people with the same name collapse into one row.** Recorded in migration 049 rather than papered over.
- Counts come from the SQL view, never from counting rows in JS. PostgREST caps a response at 1000 rows regardless of `.limit()` — the bug that made the 3a dashboard report 92 athletes for a brand with 1,523.
- **Headshots are the athlete's own campaign media, not headshots.** No table has a headshot column. They are real photos of the right person, but they crop unpredictably — some are a torso, a basketball, or a colour field. Initials are the fallback, never a grey square. Two data artefacts show through here and are worth a look: a duplicate row pair "Koa Peat" / "Koa Peat2", and "Cori Close · UCLA · WBB Coach", who is a coach in an athletes directory.

---

## 6 · Settings — `/portal/settings`

`shots/07-settings-1440.png` · `shots/17-settings-390.png`

**Real:** the brand logo, from `brand_logos` on the dark-ground variant.

**Empty:** "Your team" shows its empty state in the screenshot because `anon`
cannot read `brand_contacts`. A signed-in brand user sees their own row.

**Calls made:**
- Notification toggles render disabled with "Coming soon", as specified. Nothing is wired.
- The body was extracted into `SettingsPanels` and is shared with the render harness. The harness had grown an abridged copy with no empty state on "Your team" and no Session panel, so the first review screenshot showed a bare heading over nothing and hid sign-out entirely. One component means the harness cannot drift from what ships.
- Sign out posts to the existing route rather than reimplementing sign-out.

---

## 7 · Rail and tab bar

All five rail icons plus the gear link to real routes, with the active state on
the current section and the hover tooltips from 3a. The phone tab bar carries
the same five. **Calendar is not in the rail at all** — there is no calendar
page and no dated source to build one from, and an icon that leads to a 404 is
worse than an absent icon.

The chrome was extracted into `PortalShell` so it exists once. Six pages each
carrying their own copy of a five-item rail is how the active state and the
tooltips drift apart. It is deliberately **not** a Next layout: a layout cannot
read `searchParams`, and `?brand=` is how admin preview picks a brand, so a
layout could never know which brand's chrome to draw.

## 8 · Dashboard links

Every "See all / All athletes / All results" points at its page, campaign cards
link to detail, and top posts link to the athlete's campaign. Two dashboard
changes went in alongside:

- **The live-campaign meta line is omitted entirely when a campaign has no athletes** (your request), rather than showing an em dash.
- **"Waiting on you" is only orange when something is waiting.** The brand rule is that orange is an accent and never a background fill, so a full panel has to be earned — and a card that shouts in alarm orange while reading "Nothing waiting on you" argues with itself. It is now wired to a real count (`review_sessions` scoped through `campaign_id`, `head+count` so the number comes from SQL), which is 0 brand-wide, so it renders as glass like its three neighbours and lights up the moment a review lands.

---

## Skipped, and why

| Skipped | Reason |
|---|---|
| Reels / Posts / Stories / BTS filters | No category, platform or duration column on `media`. Shipped All / Photos / Video. |
| Video duration labels | Same — no duration column. |
| Multi-select + zip download | Server route streaming from Storage under the caller's identity is a Phase 2 RLS question. Single-file "Open original" ships, which the brief sanctions. |
| Athlete directory pagination | Capped at 600 rows instead. Biggest remaining gap. |
| Progress bars on live campaign cards | `athlete_deliverables` has no rows a brand user can read. |
| Calendar rail item | No page and no dated source. |
| Per-image hero focal point | Needs a column on `media`. Used a measured 34% for now. |
| Phase 2 RLS | Explicitly last in the brief's order, its own branch off `main`, its own PR. **Not started.** |

## Two things I got wrong during the run, recorded so they are not re-investigated

1. **I chased a mobile horizontal-overflow bug that did not exist.** The 390-wide screenshots showed tiles running off the right edge and the tab bar missing its fifth item. Cause: headless Chrome clamps `--window-size` to a **500px minimum**, so a 390px capture is a crop of a 500px page. Measured it with an in-page probe: `VW=500, N=0` — zero elements overflowed. Mobile was correct the whole time. The mobile shots in this log were re-taken through CDP `Emulation.setDeviceMetricsOverride`, which sets the real layout viewport (`scripts` kept out of the repo; the client lives in the session scratchpad). The `minmax(0, 1fr)` grid changes I made while chasing it are harmless hygiene and stay; the roster's `overflow-x: auto` below 1100px is a genuine improvement, since a 520px table does need to scroll inside a 500px tile.
2. **One set of screenshots rendered without Bebas or Anton.** A stale dev server was holding the port through a `git reset`/`clean`, and its module graph no longer resolved `next/font`. Killed it, started clean on 3161, re-shot. If a portal screenshot ever comes out in a default sans with everything ~8% larger, that is the cause.

---

## The three things to look at first tomorrow

1. **Sign in as a real brand user and re-read every number.** The screenshots are the `anon` view: 0 live / 10 wrapped / 751 athletes. Signed in it should be **6 live / 46 wrapped / 1,523 athletes**. That is the one thing I could not verify end to end, and it is the difference between "these pages work" and "these pages work on the real dataset."
2. **The campaign detail hero crop.** It is sharp and it is a face, but it is a tight one, and it will be tight differently on every campaign. Decide whether a `focal_y` column on `media` is worth adding, or whether the hero should be a shorter band with the photo contained rather than covering.
3. **The athletes directory at 600 of 1,501.** Decide whether it needs pagination, infinite scroll, or just a higher cap — 1,501 cards is a lot of DOM, and the answer changes what the page should look like.

One more worth a glance: the duplicate "Koa Peat" / "Koa Peat2" rows and the
coach in the athlete directory are data problems the portal is now exposing to
a client. Worth a cleanup pass on `athletes` before CVS sees this.
