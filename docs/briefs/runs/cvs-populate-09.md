# CVS populate — brief 09

**Run date:** 2026-09-10 · **Branch:** `feat/cvs-populate-09` (off `main` after #269 merged as `6986058`)
**Scope:** the 32 CVS rows with 0 media, in three phases.

Phase 1 is applied. Phase 2 was read-only and is **reported, not acted on** — its answer changes what
"populate" even means for those campaigns. Phase 3 is read-only and **awaits your decision**; the
headline is that the thing the brief proposed to verify is **not** enforced.

---

## Phase 1 — rosters imported (applied)

**1,353 athletes across 7 campaigns.** Idempotent on `(campaign_id, name)`; a re-run reports 0 inserts
and 1,354 skipped. Media stays 0 on these rows, as the brief expected.

| Campaign | tab gid | parsed | inserted |
|---|---|---|---|
| Epic Sale Fall 2025 | 229649195 | 283 | 283 |
| Immunization | 1726677583 | 16 | 16 |
| Store Brands Gifting - Phase 1 | 1817003903 | 53 | 53 |
| CVS Well Market Gifting | 199932386 | 51 | 51 |
| CVS Affiliate | 0 | 602 | 601 |
| CVS Holiday Affiliate Phase 1 | 277927261 | 97 | 97 |
| CVS Event Apprarance & Content | (standalone sheet) | 252 | 252 |

**All 7 tabs were genuine rosters** — every one carried handles, schools and follower counts
(`w/data` ≈ `named` on each). None was a section-header sheet or a calculator, so nothing was
withheld. `CVS Affiliate`'s 602 parsed rows contained one in-tab duplicate name, skipped.

Two campaigns failed their first fetch with transient Google token/socket errors — not "not a
roster". The importer gained a backoff that retries `429`, `5xx` and `fetch error`, and both
succeeded on retry. Script: `scripts/cvs-populate-09-roster.ts`.

**Fall ExtraCare x Epic** — `pgrep -x ffmpeg` was clear, so its media ingest ran at
`--concurrency 2` per the guardrail. *(Result appended below when it completes.)*

---

## Phase 2 — content hunt: the content is mostly not files

**This is the finding that matters. Six of the seven campaigns' deliverables are social posts, not
Drive content — and where Drive content does exist, it is in an individual's personal My Drive.**

### What the trackers actually contain

Google's CSV export drops hyperlinks, so this was read from the grid (`includeGridData`) to get the
real URLs behind cells like "Madison's Content".

| Campaign | athletes | IG posts | TikTok posts | Drive folders | media in them |
|---|---|---|---|---|---|
| Summer/SPF | 436 | 710 | 0 | 20 | **237** |
| ExtraCare December | 266 | 524 | 0 | 2 | **23** |
| Halloween | 108 | 210 | 0 | 2 | **21** |
| Mother's Day 2025 | 68 | 127 | 0 | 9 | **133** |
| CVS Holiday Phase 2 | 72 | 141 | 61 | 0 | 0 |
| Store Brands - Phase 2 | 40 | 79 | 34 | 0 | 0 |
| CVS Holiday Phase 3 | 28 | 52 | 19 | 0 | 0 |
| **TOTAL** | **1,018** | **1,843** | **114** | **33** | **414** |

Post links are counted strictly — `instagram.com/p/`, `/reel/`, `/tv/` and `tiktok.com/…/video/`.
Profile links (the IG Handle column) are excluded from those figures; there are a further ~1,000 of
those, which are handles, not deliverables.

### So the answer splits three ways

1. **1,957 social posts across all 7 campaigns.** These are the deliverables — athlete posts, not
   Postgame-shot content. As the brief anticipated, **this is a posts table, not an ingest.**
   Nothing in the schema models them today: `media` is file-and-storage shaped (`file_url`,
   `storage_path`, `drive_file_id`, `phash`, `quality_score`), so forcing post URLs into it would
   misuse every one of those columns.
2. **414 media in 33 Drive folders, for 4 campaigns** (Summer/SPF, Mother's Day 2025, ExtraCare
   December, Halloween). This *is* ingestible with the existing tooling — see the caveat below.
3. **3 campaigns have no Drive content whatsoever** (Holiday Phase 2, Store Brands Phase 2, Holiday
   Phase 3). For them the posts table is the only path; there is nothing to ingest, ever.

### Where those 33 folders live — and why nobody found them before

They are **not in the CVS Drive tree**. I walked the whole tree
(`1FuuurHivZQT8yBOwmPBd8q_7M-zteNUt`, 7 levels): **259 media-bearing folders, 2,549 media files**,
and none of them belongs to a Phase 2 campaign. Every tree hit for a Phase 2 keyword turned out to
be an already-populated campaign — `CVS/2025/Holiday/CVS PURDUE HOLIDAY` is the published 2025
`Holiday` row, and the `SPF`/`Mothers Day` hits are the 2026 campaigns.

The 33 folders are owned by **`jake@pstgm.com`** and sit in his personal My Drive:

```
Madison Booker (CVS Mothers Day)  →  id=1Jc3DcTDQIiTmVZpe4Lc4KFxsH0LdSZ3O
    parents = null      driveId = (my drive)      shared = true      owner = jake@pstgm.com
```

`parents = null` means they are "shared with me" items with no reachable folder chain. That is
exactly why brief 07's folder check found only contracts, and why a tree walk cannot see them —
**they are reachable only through the hyperlink in the tracker cell.**

That is worth a decision in its own right: content for four delivered campaigns currently depends on
one person's personal Drive. If that account is reorganised or offboarded, the links break and the
media is gone. Moving them into the CVS tree is a separate piece of work, but it is the durable fix.

### Step 3 — outside the CVS tree

Covered by the above: the only Phase 2 content found outside the CVS tree is those 33 folders.
No other matching media folders exist under any accessible root.

### Decision taken — do NOT ingest these (Peyton, 2026-09-10)

The 33 folders move into the CVS Drive tree first; Peyton is handling that with Jake. Nothing was
ingested. The inventory below is recorded so the folders can be mapped to campaigns once moved.

### Folder inventory — 33 folders, 414 media, all owned by `jake@pstgm.com`

| Campaign | Folder name | Folder id | media |
|---|---|---|---|
| Summer/SPF | `Avery Johnson (CVS SPF)` | `1f8m013JuYKijSOKO8raIENKjJbQpKFh8` | 17 |
|  | `Behren Morton (CVS Sunscreen/SPF)` | `1Lm2FEBowbUGLx90tnNC0u5vm9ld4lq6C` | 7 |
|  | `Emily Psarras (CVS Summer)` | `1vTyStwl-kYuzCxVGCKzASl75W7gv9fte` | 46 |
|  | `Ty Simpson (CVS Summer/SPF)` | `1nBJ-g57H_N-CuTKZlZmcFFhz2cos33Oy` | 4 |
|  | `Hailey Gordon (Summer/SPF)` | `1iIke_6uHCR720b946ks15jiU0supYPPQ` | 18 |
|  | `Luke Altmyer (CVS Summer/SPF)` | `1PvYOw7HcgTThBaigy0Ns2Xve8nsxX2kZ` | 8 |
|  | `Madi Hays (CVS)` | `1gaGBHf0in6J4X3b1l39j3oxiKNAAEW-T` | 5 |
|  | `Kade Anderson (CVS Summer)` | `1kVvOwFYIfZY3PONwyq6n1cWkLMzOxwMP` | 9 |
|  | `Marek Houston (CVS Summer)` | `16V6SV7xRa3C9cC3SzXKMAVAkFz_YoqbA` | 11 |
|  | `Michael Mancini (CVS)` | `1bLWGROeTBTtXERkmTr_Kp46ZOA6eL6ah` | 11 |
|  | `Aidan Teel (CVS)` | `1ZtzJV05195op8u6LYRflRt5LJJpuLnWD` | 6 |
|  | `Jackson Sanders (CVS)` | `1FE_IeBDTvokZqKUe2Z2qOt0F1S4IJycp` | 8 |
|  | `Jamie Arnold (CVS)` | `1bDb54Uhe6Fk49XdCa-GGRsOwdmMcR9Yb` | 4 |
|  | `Trent Caraway (CVS)` | `14zSTt_oXjyg-IrP12SuKEI9BckVDYlmI` | 2 |
|  | `Kyson/Malachi Witherspoon (CVS)` | `14BMqEC1sE1BFP_8HGcpbf2IbomrlceEe` | 19 |
|  | `JD Thompson (CVS)` | `1j76UihLWM7M8eTS3VX54k6ZdpDwkVKsk` | 8 |
|  | `Riley Quick (CVS)` | `1tzWi8t665k35HvEsyNmvPgm9BPHgRfHd` | 10 |
|  | `Mason Neville (CVS)` | `1ySWfPhD2Y6Tl7ssA4psAu6Tkdcoi4fPm` | 17 |
|  | `Lucas Mahlstedt (CVS)` | `19JKS0b_x_CwYxdOzOdudB8cnM7229Tx4` | 18 |
|  | `Brenden Summerhill (CVS)` | `1mvuC6ohloshTG57XVW86o49-k-vOp1qY` | 9 |
| Mother's Day 2025 | `Madison Booker (CVS Mothers Day)` | `1Jc3DcTDQIiTmVZpe4Lc4KFxsH0LdSZ3O` | 18 |
|  | `Aneesah Morrow (CVS Mothers Day)` | `1m8V0esd88oZCifkVRdo7Wc7m7XsN1HJd` | 31 |
|  | `Kiki Rice (CVS Mothers Day)` | `19sthSrNlP5_jzn9IZ6F_39Bi4ZyYwenH` | 12 |
|  | `Walter Clayton Jr (CVS Mothers Day)` | `1LH4hR5hp8pmxTFqFRMtTVpuTg7nIQxse` | 9 |
|  | `Rori Harmon (CVS Mother's Day)` | `1gORoUilDRjdKx_6hkiF8TMs_TjS2pOdf` | 28 |
|  | `DJ Lagway (CVS Mothers Day)` | `13KK8YRfGtxmqC8YrrCYY_EXkdJCPRK65` | 6 |
|  | `Ta'Niya Latson (CVS Mothers Day)` | `1_Q6ctrfa70EZKOHmtSvejA8jkDkmr2Sx` | 11 |
|  | `Ryan Williams (CVS Mothers Day)` | `1DgX9ZIoBp7LU7X82LgqTxAm29kU-SozH` | 7 |
|  | `Caitlin Driscoll (CVS Mother's Day)` | `1qmjJfu0f9t1doEdwTMzDQBPl8yG0WCPA` | 11 |
| ExtraCare December | `Malik Benson (CVS)` | `1c5z1qu7jR1UDJZdea2V47NWom7lhZjOU` | 14 |
|  | `Dante Moore (CVS)` | `1ux7_R2pSYRsGiK3Ffn6-uujOCW6v_H2A` | 9 |
| Halloween | `Cameron Dickey (CVS Halloween)` | `18yp7zTAxlrhGyKvjyMrX0W75kNsGyJoY` | 9 |
|  | `Simon Wheeler (CVS - Halloween)` | `127Og_nDeDESvCHts4nsp5EhbISFAOiFd` | 12 |

Every folder is named `<Athlete> (CVS …)`, matching the convention `import-campaign-media.js`
already reads, so once they sit under the CVS tree the existing manifest generator
(`scripts/cvs-ingest-08-manifest.js`) maps them without new code. Two need a human eye when that
happens: `Kyson/Malachi Witherspoon (CVS)` is a **pair** folder (two athletes, one folder — the
importer supports that shape), and `Behren Morton (CVS Sunscreen/SPF)` uses "Sunscreen/SPF" where
the roster and every sibling folder say "Summer/SPF".

The 3 campaigns with no Drive content at all (Holiday Phase 2, Store Brands Phase 2, Holiday
Phase 3) cannot be populated by any ingest, before or after the move. They need the posts table.

---

## Phase 3 — visibility: the portal does NOT hide unpublished campaigns

### The check the brief asked for, and its answer

> *"Verify in the portal code that an unpublished row cannot appear in any brand-facing list or
> count, and report where it's enforced. If it is not enforced, that's the fix."*

**It is not enforced.** `src/components/portal/CampaignsBody.tsx` is the brand-facing campaign grid:

```ts
// CampaignsBody.tsx:27-31 — no published filter
const { data: recapsRaw } = await supabase
  .from("campaign_recaps")
  .select("id, name, slug, published, admin_is_active, created_at, hero_image_url, thumbnail_url")
  .eq("brand_id", brand.id)
  .order("created_at", { ascending: false });
```

Every row for the brand is fetched and **every row is rendered** (`recaps.map(...)`, line 70). A row
with no media is not skipped — it renders as a dimmed card reading **"Campaign content uploading
soon"** (lines 74-97). Unpublished rows are also counted deliberately, not incidentally:

```ts
const inFlightCount  = recaps.filter(r => !r.published &&  r.admin_is_active).length;  // :47
const archivedCount  = recaps.filter(r => !r.published && !r.admin_is_active).length;  // :48
```

and surfaced in the header as `N published · N in flight · N archived`. `PortalDashboardBody.tsx`
does the same (`:110`, `:111`, and a `!r.published` list at `:180`).

**Consequence:** all 17 genuinely-empty rows currently appear in the CVS portal as "content
uploading soon" cards — including `Injured Athlete`, `CVS BOPIS 2`, `CVS Round Table` and the three
survey shells. They are `published = false` already, and that is not sufficient.

So the brief's proposal — "these stay `published = false` and the portal must not list unpublished
campaigns" — **requires a code change**, and the second half is currently false. Options, none applied:

| | Change | Effect |
|---|---|---|
| A | Filter the grid to rows that have media | Hides all 17 empties. Also hides any published-but-empty campaign, and drops the "uploading soon" affordance for genuinely in-progress work. |
| B | Filter to `published = true` | Hides the 17. Also removes the "in flight" cards, which look deliberate — someone built that state on purpose. |
| C | Add an explicit `hidden`/`portal_visible` column | Precise, reversible, survives the admin sync. Costs a migration. |

**C is the honest fix** — the others repurpose `published` or media-presence as a visibility flag
when neither means that. But this is a product decision, so nothing has been changed.

### The guardrail is already handled at render

`CVS March Madness` does **not** reach the client as written. `CampaignsBody` runs every name
through `brandSafe()` (`src/lib/brand-safe.ts`), which rewrites:

| pattern | replacement |
|---|---|
| `March Madness` | Tournament |
| `Final Four` | National Semifinal |
| `Elite Eight` | Regional Final |
| `Sweet Sixteen` | Round of 16 |

So the card renders as "CVS Tournament". This is why the row must not be renamed — the display layer
already owns it. Note `brandSafe` does **not** strip a bare "NCAA"; only these four phrases.

### The 13 "duplicates" are real admin records, not sync artifacts

Every one joins to a distinct `admin_campaigns` row — its own `admin_id`, its own name, its own
`created_on`, all `status = "Not Active"`:

| Hub row | admin_id | admin name | created_on |
|---|---|---|---|
| CVS ExtraCare Campaign | 239 | CVS ExtraCare Campaign | 2023-10-18 |
| CVS BOPIS Campaign | 241 | CVS BOPIS Campaign | 2023-10-20 |
| CVS BOPIS 2 | 276 | CVS BOPIS 2 | 2023-12-01 |
| CVS ExtraCare Campaign 2 | 277 | CVS ExtraCare Campaign 2 | 2023-12-01 |
| CVS March Madness | 348 | CVS March Madness | 2024-02-27 |
| CVS EC+ Survey | 388 | CVS EC+ Survey | 2024-04-10 |
| CVS Ec Survey | 400 | CVS Ec Survey | 2024-04-19 |
| CVS Olympics Well Market | 440 | CVS Olympics - Well Market | 2024-06-14 |
| CVS Survey BOPIS | 441 | CVS Survey BOPIS | 2024-06-17 |
| CVS Round Table | 582 | CVS Round Table | 2024-12-11 |
| Leadership Video | 792 | Leadership Video | 2025-09-12 |
| November Leadership Panel Discussion | 820 | November Leadership Panel Discussion | 2025-10-31 |
| Injured Athlete | 860 | Injured Athlete | 2026-02-03 |

The apparent duplicates are sequential distinct campaigns — BOPIS ran three times over eight months,
ExtraCare twice, and the two surveys were created nine days apart with different names. **Nothing
here is a sync artifact**, which confirms the brief's instruction not to delete: the sync would
recreate every one.

### The four active shells

| Campaign | admin | created | athletes | media | tracker | folder |
|---|---|---|---|---|---|---|
| Athlete Product Gifting | 990 | 2026-07-29 | 0 | 0 | no | yes |
| IMZ | 996 | 2026-08-11 | 0 | 0 | no | yes |
| Strategic Markets | 885 | 2026-08-19 | 0 | 0 | no | yes |
| RX Strategic Markets | 1011 | 2026-09-01 | 0 | 0 | no | yes |

All four are recent, `admin_is_active = true`, with a provisioned Drive folder and nothing in it —
genuine in-flight work, not detritus. Under the current portal they show as "in flight", which is
arguably correct. They need no action beyond whatever visibility rule you pick.

---

## Guardrails observed

- **Idempotent** — rosters keyed on `(campaign_id, name)`, media on `drive_file_id`. Re-runs are no-ops.
- **`--concurrency 2`** used for the one ingest, after confirming `pgrep -x ffmpeg` was empty.
- **Nothing published** in this brief.
- **Nothing deleted, nothing renamed.**
- **Phase 2 read-only** — no ingest performed, as instructed.
- **Phase 3 read-only** — reported, nothing applied.

---

## Decisions needed

1. **Phase 2 ingest** — ingest the 414 media from the 33 tracker-linked folders for Summer/SPF,
   Mother's Day 2025, ExtraCare December and Halloween? And should those folders be copied into the
   CVS tree first, given they live in a personal My Drive?
2. **The posts table** — schema proposal drafted in §4 below. Separate brief; no code written.
3. **Portal visibility** — A, B or C above. C (an explicit column) is the one that does not overload
   an existing field's meaning.

---

## 4. Posts table — schema proposal (no code written)

Agreed as a separate brief. This is the design case, grounded in what the trackers actually carry.

### What the trackers give us

Every Phase 2 tab has the same shape: one row per athlete, then a repeating block per post type.
Taking the `Summer SPF` and `Mother's Day` tabs, the columns are:

| Group | Columns present |
|---|---|
| Identity | `FName`, `LName`, `IG Handle`, `InstagramLink`, `IG Followers`, `TT`/`TikTokUserName`, `TikTokLink`, `TikTok Followers`, `College`, `Sport`, `Gender`, `Reach Level` |
| Story | `IG Story Post`, `IG Story Impressions` |
| Feed | `IG Feed Post`, `Date Posted`, `IG Feed Reach (est)`, `IG Feed Impressions (est)`, `Likes`, `Comments`, `Total Engagements (likes + comments)`, `Engagement Rate` |
| Reel | `IG Reel Post`, `Date Posted`, `IG Reel Views`, `Reel Likes`, `Reel Comments` |
| TikTok | `TikTok`, `Date Posted` |
| Rollup | `Total Impressions (est)` |

So a post carries: **a platform, a post type, a URL, a posted date, and a small set of metrics that
differ by type** — impressions for stories, reach/impressions/likes/comments for feed, views for
reels. That variability is the main design constraint.

### Proposed shape

One row per post. Not per athlete, and not per post-type-column.

```
campaign_posts
  id                uuid  pk  default gen_random_uuid()
  campaign_id       uuid  not null  references campaign_recaps(id) on delete cascade
  athlete_id        uuid           references athletes(id) on delete set null
  platform          text  not null  check (platform in ('instagram','tiktok'))
  post_type         text  not null  check (post_type in ('story','feed','reel','video','carousel'))
  url               text  not null
  posted_at         date
  metrics           jsonb not null default '{}'::jsonb
  source            text  not null default 'tracker'   -- tracker | manual | api
  source_sheet_id   text
  source_gid        text
  source_row        int
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null default now()

  unique (campaign_id, url)
```

**Why these choices**

- **`unique (campaign_id, url)`** is the idempotency key, exactly as `drive_file_id` is for `media`.
  Re-importing a tracker must not duplicate posts. URL is stable; row position is not.
- **`athlete_id` nullable, `on delete set null`.** Some tracker rows have a post but no resolvable
  athlete, and the same lesson applies as in brief 08: record the post, leave the link null rather
  than guess. Deleting an athlete must not delete campaign results.
- **`metrics jsonb`, not columns.** A story has impressions, a reel has views, a feed post has
  reach + likes + comments. Twenty sparse nullable columns would be mostly null and would need a
  migration every time a tracker adds a column. Keys stay snake_case and typed on write:
  `{"impressions": 41000, "reach": 12500, "likes": 830, "comments": 24, "engagement_rate": 0.068,
  "views": 210000}`.
- **`source_*` columns** record which sheet, tab and row a post came from, so a re-import can be
  reconciled and a bad tracker edit can be traced. `media` lacks this and it has cost us —
  brief 07 existed because nothing recorded where a tracker link pointed.
- **`platform` + `post_type` split** rather than one `type` field, because the portal will want
  "all Instagram" and "all reels" as separate cuts.
- **No metric rollups stored on the campaign.** `Total Impressions (est)` in the tracker is a
  spreadsheet formula. Recomputing from rows is cheap and cannot drift; a stored copy will.

### Deliberately not included

- **No `media_id` link.** A post is a link to something on Instagram; it is not a file we hold.
  Conflating the two is what makes `media` the wrong home for this.
- **No engagement time series.** The trackers hold one snapshot. A `campaign_post_metrics` history
  table can come later if metrics start being refreshed from an API.

### What an importer would do

Read the tab, walk each athlete row, emit one post per populated post-type block, resolve
`athlete_id` by name against the campaign roster, upsert on `(campaign_id, url)`. That is the same
pattern as brief 08's roster import and reuses `fetchTrackerCsv` — except it needs the **grid**
(hyperlinks), not the CSV export, because the CSV drops the URLs. That single fact is the reason
this was not visible before.

### Scale

**1,957 posts** across these 7 campaigns (1,843 Instagram, 114 TikTok). The 18 already-published
CVS campaigns have not been surveyed; the true total across CVS is likely several thousand.

---

*Phase 1 applied. Phase 2 reported, not ingested (folders move first).
Phase 3 portal_visible implemented in a separate PR.*
