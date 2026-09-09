# Reports, rebuilt — run log

Branch `portal/reports-v2` off `main` at 622efc9 (#264 merged).

## The layout image was not in Drive

`reports-layout.png` is not in "Brand Portal Briefs" or anywhere else in the
Drive account — searched by full text and listed the folder and the account's
recent files. The brief said "I'll upload it", so it had not landed yet.

**Built from the written specification instead**, which fixes every element,
its data and its behaviour; what it does not fix is the exact arrangement.
Where the text was silent I followed the portal's own system (tile grid,
Anton figures, orange as the single accent) and the choices are listed below
so they can be checked against the image when it arrives.

## Data

One migration, 059, replacing 058's all-time-only view.

**`portal_brand_report_periods`** — one row per period. **Periods are
aggregated independently, not summed**, because `athletes` is a distinct
PERSON count: adding per-campaign counts double-counts anyone on two
campaigns (2,096 CVS rows are 1,501 people), and adding per-quarter counts
double-counts anyone who worked across quarters. "2026" is not the sum of its
quarters. The dedupe rule is `lower(btrim(name))` — the same rule as
`portal_brand_stats`, so this page and the dashboard KPI cannot disagree.

Periods: `all`, `y<YYYY>` per year present, `last4` (the current quarter and
the three before it), `last4_prior` (the four before those — the same span a
year earlier, which is what makes it the year-over-year comparison for a
rolling window). `last4_prior` is never selectable; it exists only as a
comparison.

Verified for CVS: all = 46 campaigns / 1,501 athletes / 1,835 posts /
65,578,076 reel views · last4 = 16 / 628 / 697 / 33,058,840 · last4_prior =
14 / 650 / 671 / 170,235 · y2026 = 13 / 372 / 368 / 32,504,619 · y2025 = 11 /
751 / 860 / 724,456.

**`portal_brand_report_quarters`** — per-quarter posts and reel views for the
chart. Both are summable so no distinct count appears here. 11 quarters of
real data, Q3 2023 through Q2 2026.

**`portal_report_campaign_quarters`** — each wrapped campaign placed on a
quarter by the same rule the app uses: a real stored `settings.quarter` wins,
else the quarter of `admin_created_on`. 12 of CVS's 13 non-null stored
quarters are the empty string, so the date carries almost all of it.

## Judgement calls

**A campaign with no quarter is in `all` and in no year.** CVS has exactly one
— all=46 against 13+11+15+6=45 across the years. It cannot be placed on a
timeline and inventing one would move figures a brand may reconcile against
their own reporting. It still appears in the table under All time, with a
blank quarter.

**Comparisons switch from percentages to multiples at 10x.** CVS's 2026 reel
views against 2025's are +4,388%, which nobody reads as "45 times". At or
above 10x it reads `45x`; below that, a percentage. A prior period of zero
yields NO comparison rather than an infinite one, which is why Reel views and
Impressions carry no comparison line on 2026 while Campaigns, Athletes, Posts
and Followers do.

**Two scales on the chart, and the legend says so.** Posts run in the
hundreds and reel views in the millions on the same data; one shared scale
draws every posts bar as a hairline — honest and unreadable.

**A series with nothing in it draws no bar, and prints no value.** Q4 2025 has
63 posts and no reel views. The bars already omitted the empty series; the
hover readout was still printing "0 reel views", which asserts a measurement
nobody took. Caught by probing the readout rather than by looking at it.

**Hover values go in a readout above the chart, not a floating tooltip.** A
tooltip that follows the pointer covers the bars it describes, and on a touch
screen it never appears at all. The readout is also where the keyboard path
lands: each quarter is focusable and `onFocus` fills the same line.

**"Where the views came from" names four surfaces and does not add them into
one number.** Reels and TikTok report VIEWS; Feed and Stories report
IMPRESSIONS. All-time for CVS: Reels 65,578,076 (732 athletes visible to the
harness) · Feed 3.4M · Stories 1.9M · TikTok 47K. Each bar carries its own
metric name and contributor count, the share is labelled "of reported reach
across the four", and a note states the difference outright. Adding views to
impressions would have produced a single clean number that meant nothing.

**Best quarter needs more than one quarter to be best among**, so it is hidden
when a period has only one. Ranked on reel views, which is what the chart's
orange series and the headline both lead on, and it states its share of the
period so "best" is quantified rather than asserted.

**Top athletes respect the period.** `portal_top_posts` is brand-wide and
all-time, so the query takes 200 rows and filters to the period's campaigns
before taking ten — the top ten of one year are not the top ten of all time.
Headshots come from one media query for the ten, not ten queries; an athlete
with no media keeps initials rather than a stock face.

**The period lives in the URL** (`?period=y2026`), so a filtered view is
shareable and the back button steps through periods. The pills are links, not
buttons.

**The CSV carries raw numbers and names its period.** "8M" is useless in a
spreadsheet, and two exports from different periods should not overwrite each
other in a downloads folder.

## Verification

- `next build` clean; rendered as CVS at 1440×900 and 390 for All time, 2026
  and Last 4 quarters, plus the table and Top athletes below the fold.
- Hover values probed in a browser rather than eyeballed: Q4 2025 returns
  "63 posts" with no views line, Q2 2026 returns "265 posts / 19M reel views".
- Bar heights checked against the two-scale rule: [57, 93, 167, 240, 240] for
  three quarters, i.e. each series topping out at its own maximum.
- No horizontal overflow at 390; the only element wider than the viewport is
  the table, inside its own scroll container.
- Phone KPI grid fixed to two-up: `minmax(190px, 1fr)` resolved to a single
  column in a 350px content width, which put six tiles down six screens
  before the chart.

**Harness limitation, not a bug:** the keyboard path could not be exercised
headlessly — `document.hasFocus()` is false in the render harness, so the
browser suppresses focus events and `.focus()` sets `activeElement` without
firing `onFocus`. The handler is in the source and the same state is set by
the pointer path, which was verified.

Numbers on the attached renders are the `anon` view (10 wrapped campaigns,
751 athletes) because the harness has no session; a signed-in CVS contact
sees 46 and 1,501, which is what the SQL above was verified against.

---

# Round two — three corrections

## Gridlines

The bars were relative only: you could see Q2 was tallest and not what it was
worth. Three gridlines now, at 1/3, 2/3 and the maximum, **labelled on both
scales** — posts down the left, reel views down the right, each at the same
three fractions of its own maximum — plus an axis note stating both maxima.

**Fractions of the maximum, not round numbers.** A "nice" axis top (300, 20M)
has to exceed the tallest bar, and then the tallest bar no longer reaches the
top of the plot — which is the one thing the eye reads reliably in a bar
chart. So the top gridline IS the maximum, and the labels are whatever that
divides into: 265 / 177 / 88 for posts, 19M / 13M / 6.4M for reel views.

On a phone only the left scale is drawn — two gutters plus the bars left the
plot 250px and the right-hand numbers were the first thing to become
unreadable. The reel-views maximum stays in the axis note underneath.

Verified in a browser: left labels `["265","177","88"]`, right labels
`["19M","13M","6.4M"]`, and the bars sit above the lines rather than being
striped by them.

## The table defaults to campaigns with posts

**Of CVS's 46 wrapped campaigns, 17 have posts.** The other 29 are events,
surveys and one-offs — Valentine's Day, PNW Content, Leadership Video, CVS
Round Table, CVS Ec Survey, Immunization, Injured Athlete — which produced no
athlete content, so every metric column is empty for them. 27 have no athletes
at all, and **every campaign with posts also has athletes**, so filtering on
posts removes all of the zero-athlete rows and two more that have a roster but
never posted.

Default is the 17; "Show all 46" reveals the rest and flips to "Only the 17
with posts". They stay reachable because "wrapped" is a real state and a brand
may be looking for one of them.

**A data finding while counting them: "26 Spring Epic Beauty" exists twice**
in the wrapped set — one row with 417 posts and 418 athletes, one completely
empty. It is the only duplicated name among the 46 (45 distinct names), and it
is the reason an earlier count of "campaigns with posts" disagreed with the
rendered table. **Follow-up for the admin:** the empty twin is a candidate for
deletion, and while it exists it will appear in "Show all" as a second
identical name.

## "Combined followers" is gone; "Total audience reached" replaces it

The observation was right. `followers` summed `ig_followers` over athlete
ROWS, one per campaign appearance: **17,371,557 across 1,928 rows, but only
1,441 distinct people** — 310 of them on more than one campaign, one on eight.
De-duplicated it is **14,614,989**, so the old figure overstated by 2.76M, or
16%.

Migration 060 de-duplicates it — one value per person, their MAX across
appearances, then summed — and the tile is labelled "Total audience reached"
with the sub-label "each athlete once".

**Max, not latest:** `athletes` rows carry no reliable per-row capture date.
Not min, because a count that grew is the one a brand's own reporting shows.

**And the caveat is stated on the page, not just here.** Counting each athlete
once is not the same as counting people: two athletes at one school share an
audience, and this sum counts that audience twice. A footnote under the KPI row
says exactly that — "It cannot know how many followers two athletes share, so
it is an upper bound on reach" — because a figure called "audience reached"
invites being read as unique people, which no data here supports.

The row-wise column was dropped from the view rather than kept beside the new
one: two similar figures in one view is how the wrong one gets picked. The
table's per-campaign Followers column is unaffected and remains row-wise —
within a single campaign there is exactly **one** duplicated athlete across
all of CVS, so the two are consistent to within one row.

`DROP VIEW` then `CREATE`, not `CREATE OR REPLACE`: replacing a view cannot
remove or rename a column (42P16).
