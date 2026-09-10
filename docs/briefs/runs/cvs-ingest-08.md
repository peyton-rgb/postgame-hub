# CVS ingest + publish (brief 08) — Phase 1 pre-flight

**Run date:** 2026-09-10 · **Status:** 🟢 **Phase 1 + Phase 2 complete — 8 published, 1 ingest outstanding**
**Scope:** 11 CVS rows · **Prereq:** brief 07 Phase B — PR #267 merged as `ed6bfa6`

Phase 1 results are in §9, Phase 2 in §10, and the **standing hero rule** in §11.
Sections 1–8 are the pre-flight as it stood before any write.
Drive was read-only throughout — all writes were to `athletes`, `media` and `campaign_recaps`.

---

## Summary

Three of the brief's premises do not hold, and two of them stop Phase 1 as written:

| | Premise | Reality |
|---|---|---|
| 1 | "Reuse brief 04's scripts" | **Brief 04 has no ingest scripts.** It was a recap *text/metadata* backfill applied with `execute_sql`. Its own method doc says it did no media ingest and created no `media_campaigns` links — the media already existed. |
| 2 | "Ingest media from `drive_content_folder_id` (recursive)… leave unmatched media unlinked" | The only ingest tool, `scripts/import-campaign-media.js`, is **manifest- and roster-driven**, not folder-driven. It never produces unlinked media. |
| 3 | Phase 2 publish mechanics | ✅ **Holds.** Verified in a rolled-back transaction — see §5. |

One premise was wrong in the brief's *favour* and I nearly flagged it in error: the very large
tracker rosters (659, 215, 99…) are **correct and conventional**, not junk. See §3.

---

## 1. Verified state of the 11 rows

All 11 exist, all have `media = 0`, all are `status = draft` / `published = false`, none has a hero.
`athletes BEFORE` matches the brief exactly.

| Campaign | lifecycle | athletes | tracker | content folder structure |
|---|---|---|---|---|
| Bloomington CFP Event | delivered | 0 | yes | `Photos/` + 2 loose videos |
| CVS - Spotted at CVS | delivered | 79 | yes | 3 per-athlete subfolders |
| CVS Epic Beauty | delivered | 50 | yes | 4 per-athlete subfolders |
| CVS June | delivered | 0 | yes | 3 per-athlete subfolders |
| Epic Beauty + Unaltered Beauty | delivered | 0 | yes | 6 first-name subfolders + 9 loose media |
| Extra Extra Big Deals January | delivered | 0 | yes | 4 per-athlete subfolders |
| Valentine's Day | delivered | 0 | yes | 2 per-athlete subfolders |
| PNW Content | delivered | 0 | yes (standalone sheet) | 3 **store** subfolders (Spokane/Eugene/Seattle) |
| Community Captains | **active** | 0 | yes | flat — 6 loose media, no subfolders |
| Fall ExtraCare x Epic | **active** | 0 | yes | 17 subfolders (14 athlete, 2 pair, 1 team) |
| RX Strategic Markets | **active** | 0 | **none** | **empty — 0 files, 0 subfolders** |

> **RX Strategic Markets resolves itself.** The brief says "ingest only if the Content folder has
> media, else skip". The folder is empty and there is no tracker. **Skip — no decision needed.**
> That leaves 10 rows in play.

---

## 2. Blocker A — the ingest tool does not do what step 1 and 3 describe

`scripts/import-campaign-media.js` is the only ingest in the repo. Its actual contract:

1. Reads a **manifest CSV** (default `~/Documents/Claude/Projects/POSTGAME HUB/content_import_manifest.csv`)
   whose rows are `athlete` → `drive_content_folder_url`.
2. Loads the campaign's **existing roster** and matches manifest rows to it **by athlete name**.
3. Aborts if nothing matches: *"No manifest rows matched the roster for this campaign. Nothing to do."*
4. Every media row it writes is attached to an athlete (or to the several athletes sharing a team
   folder). **It has no code path that writes media with `athlete_id = null`.**

So it cannot be pointed at `drive_content_folder_id`, and it cannot "leave unmatched media
unlinked". `media.athlete_id` *is* nullable, so unlinked media is representable in the schema —
just not producible by this script.

**It also inverts the brief's step order.** Step 1 is ingest and step 2 is roster, but the ingest
matches against the roster, so the roster must exist first. Order has to be 2 → 1 → 3.

**The adaptation that keeps the brief's "do not write a parallel ingest" rule:** generate a
per-campaign manifest from the Drive subfolder names and feed it to the existing script. The
subfolder convention (`Athlete Name (CVS …)`) makes this mechanical. I tested the matching:

| Campaign | subfolders matched to roster |
|---|---|
| CVS - Spotted at CVS | **3 / 3** |
| CVS Epic Beauty | **4 / 4** |
| Extra Extra Big Deals January | **4 / 4** |
| Valentine's Day | **2 / 2** |
| CVS June | 2 / 3 — folder `Amiah Simmons`, tracker `Amiah Simons` (one letter) |
| Fall ExtraCare x Epic | 14 / 17 — the 3 misses are 2 pair-folders and `Penn State Volleyball` (a team, which the script supports natively) |
| Epic Beauty + Unaltered Beauty | **0 / 6** — folders are first-name-only: `kiki Final`, `Olivia Final`, `Madison Final`… |

Four campaigns match cleanly. Three need a small amount of name handling, all of it evidence-based
rather than guesswork.

---

## 3. Correction — the large rosters are right, not junk

Reading the tracker tabs produces rosters far larger than the number of athletes with content
(659 for Epic Beauty + Unaltered, whose folder has 6 subfolders). That looks alarming, but it is
exactly how every existing CVS campaign is shaped — `athletes` holds the **full tracker roster**,
and media covers only the subset who delivered:

| Campaign | athletes | media | tracker rows |
|---|---|---|---|
| ExtraCare December | 266 | 0 | 266 |
| SPF | 132 | 89 | 132 |
| Mother's Day | 117 | 62 | 117 |
| Holiday | 63 | 43 | 63 |
| Chicago Activation | 56 | 32 | 57 |
| The Tournament | 31 | 64 | 31 |
| Minute Clinic | 12 | 23 | 12 |
| CVS - Spotted at CVS | 79 | 0 | **79** |
| CVS Epic Beauty | 50 | 0 | **50** |

Athletes ≈ tracker rows, essentially always. **Importing the whole tab is the convention** and
step 2 needs no change. The two campaigns that already have rosters (79, 50) match their tracker
tabs exactly, which also confirms brief 07 pointed them at the right tabs.

**One exception — Bloomington CFP Event.** Its `CFP Event` tab is an event-planning sheet
(`Indiana | Date Options | Location Options`), not a roster. The parser yields 5 rows named
`Indiana Josh Hoover`, `Indiana Omar Cooper`… with no handle, school or followers — column bleed
from a layout the parser was not built for. Importing these would create 5 junk athletes.

---

## 4. Blocker B — three campaigns have no athlete↔folder mapping at all

| Campaign | Folder shape | Media | Why the manifest path fails |
|---|---|---|---|
| PNW Content | `Spokane Store` / `Eugene Store` / `Seattle Store` | **531** | Partitioned by retail location, not athlete. The 63-name roster cannot be attributed to stores without guessing. |
| Community Captains | flat, 6 loose files | 6 | An event reel. No per-athlete structure. |
| Bloomington CFP Event | `Photos/` + 2 loose videos | 72 | Event coverage. Roster is malformed anyway (§3). |

The brief's own rule — *"leave unmatched media unlinked rather than guessing"* — is the right
answer for all three, but it is precisely the thing the existing script cannot do.

---

## 5. Phase 2 is safe — verified, and brief 04's warning no longer applies

Brief 04's method doc warns that `trg_recap_lifecycle_status` would snap a published row to
`closed`. **That trigger has since been fixed** and now carries an explicit guard:

```sql
-- Already delivered: publishing never changes it. Only reactivation does.
if tg_op = 'UPDATE' and old.lifecycle_status = 'delivered' then
  new.lifecycle_status := case when new.admin_is_active = true then 'active' else 'delivered' end;
  return new;
end if;
```

All 8 `delivered` rows are `admin_is_active = false`, so `published = true` keeps them `delivered`.
Verified against the live database in a rolled-back transaction:

```
update campaign_recaps set published = true where id = '971d344d…';
→ status=published  published=true  lifecycle_status=delivered  admin_is_active=false
rollback;
```

`sync_recap_publish_state` also sets `status = 'published'` in the same write, so the two stay
consistent. **Step 6 works exactly as the brief specifies — no second update, no fragility.**

---

## 6. Blocker C — curation would silently drop most of the media

Curation is **on by default**: per folder it perceptual-hash de-dups images and keeps the top N by
quality — **5 for a solo folder, 8 for a team folder**. Videos are never capped.

The brief's expectations ("72 media in folder", "expect a second ingest") read as though everything
lands. It would not:

| Campaign | Media in folder | Rough result with default curation |
|---|---|---|
| Fall ExtraCare x Epic | 368 | ~85 images + all videos |
| PNW Content | 531 | ~24 images + all videos (3 folders × 8) |
| Bloomington CFP Event | 72 | ~5–8 images + 2 videos |
| Extra Extra Big Deals January | 36 | ~20 images + videos |

`--no-curate` imports everything. This is a real choice, not a detail — it decides whether the
brand portal shows a curated set or a full dump.

**Runtime warning:** the script downloads every file from Drive, transcodes video, generates three
webp variants per image and uploads to Supabase Storage. Uncurated, this run is roughly **1,100+
files**. That is a long job and a meaningful storage cost.

---

## 7. Guardrails checked

- **"NCAA" / "March Madness"** — no new occurrences. The two known ones (the 2026 tab title and the
  legacy `CVS March Madness` row) are unchanged from brief 07 §6. Flagged, not renamed.
- **`manager_name`** — null on all 11. Not touched, not invented.
- **Idempotency** — the ingest keys on `drive_file_id` scoped to campaign (`existingByDriveId`), and
  carries a brand-wide collision guard. Re-running will not duplicate media. Roster idempotency on
  `(campaign_id, name)` still needs to be enforced by whatever writes the roster — the existing
  intake helper parses but does not itself de-dup.
- **Schema drift** — none found. `database.types.ts` was regenerated in brief 07 and is current;
  left alone per the brief.

---

## 8. What I recommend

1. **Skip RX Strategic Markets** — the brief already decides this (empty folder, no tracker).
2. **Run step 2 (roster) for 7 campaigns** — conventional, evidence-backed, low risk.
3. **Hold Bloomington CFP's roster** — the tab is not a roster; importing yields 5 junk rows.
4. **Adapt, don't rewrite:** generate a per-campaign manifest from subfolder names and drive the
   existing script with it. That honours "do not write a parallel ingest".
5. **Decide curation** before the first ingest — it is hard to undo a curated import cleanly.
6. **Decide the three unpartitioned campaigns** (PNW, Community Captains, Bloomington). Attaching
   their media campaign-wide with `athlete_id = null` matches the brief's intent but needs a small,
   explicit extension to the existing script.

---

## 9. Phase 1 results

### Rosters — 1,151 athletes imported across 8 campaigns

Idempotent on `(campaign_id, name)`; a re-run reports 0 inserts / 1,151 skipped. Google's CSV
export rate-limited two campaigns mid-run (HTTP 429), so the script gained backoff-and-retry.
Bloomington's names had the bleed-through `Indiana ` prefix stripped, as approved.

### Media — 117 imported, 106 linked to an athlete

| Campaign | lifecycle | athletes | media | linked | unlinked | img/vid |
|---|---|---|---|---|---|---|
| Bloomington CFP Event | delivered | 5 | 10 | 0 | 10 | 8/2 |
| CVS - Spotted at CVS | delivered | 79 | 18 | 18 | 0 | 15/3 |
| CVS Epic Beauty | delivered | 50 | 24 | 24 | 0 | 20/4 |
| CVS June | delivered | 102 | 12 | 12 | 0 | 10/2 |
| Epic Beauty + Unaltered Beauty | delivered | 659 | 13 | 13 | 0 | 9/4 |
| Extra Extra Big Deals January | delivered | 99 | 20 | 20 | 0 | 13/7 |
| Valentine's Day | delivered | 2 | 14 | 14 | 0 | 10/4 |
| **PNW Content** | delivered | 63 | **0** | 0 | 0 | — |
| Community Captains | active | 6 | 6 | 5 | 1 | 0/6 |
| **Fall ExtraCare x Epic** | active | 215 | **0** | 0 | 0 | — |
| RX Strategic Markets | active | 0 | 0 | 0 | 0 | skipped |
| **TOTAL** | | **1,280** | **117** | **106** | **11** | |

### The unlinked media are deliberate

- **Bloomington CFP Event (10)** — event coverage in a `Photos/` folder plus two recap videos.
  Not partitioned by athlete, and its roster carries no handles, so nothing could be matched
  without guessing. `athlete_id` null; the media is still owned by the campaign.
- **Community Captains (1)** — `Olivia Olsen Captions.mp4`. The roster spells her **Olivia Olson**.
  The other 5 linked by filename. Left unlinked rather than assume the two are the same person —
  worth a human confirming.

### Two campaigns still outstanding

`PNW Content` (delivered, 531 media available) and `Fall ExtraCare x Epic` (active, 368 available)
are gated behind an unrelated video-render batch on the same machine. **PNW is the only `delivered`
row with no media**, so Phase 2 should not publish it until its ingest runs.

### Curation is doing real work

| Campaign | files listed | uploaded |
|---|---|---|
| Bloomington CFP Event | 72 | 10 |
| CVS - Spotted at CVS | 26 | 18 |
| CVS Epic Beauty | 26 | 24 |
| Epic Beauty + Unaltered Beauty | 19 | 13 |
| Community Captains | 6 | 6 |

Bloomington is the sharpest case — 72 files down to 10, since a single event folder caps at 8
images (plus both videos, which are never capped).

### Operational note — three OOM kills

The run was killed by system memory pressure three times, and a fourth kill took out the
*watcher* that was waiting to resume, while it was doing nothing but sleeping. The cause was
contention with unrelated work on this machine (a 2,410-clip ffmpeg proxy batch and an open
DaVinci Resolve), not a fault in the ingest. No data was lost or duplicated at any point — the
importer keys on `drive_file_id`, so each restart resumed exactly where it stopped.

The real memory driver was `CURATION.concurrency`, hardcoded at 8 parallel image-scoring
requests. It is now a `--concurrency` flag (default unchanged at 8); the recovery runs used 2.

---

---

## 10. Phase 2 results — 7 rows published

Approved by Peyton 2026-09-10. `PNW Content` was initially held back — it is `delivered` but had
0 media, and publishing an empty campaign would have put an empty page in the brand portal. Its
ingest ran later the same day and it was published in a second pass.

| Campaign | status | published | lifecycle_status | hero | media | linked |
|---|---|---|---|---|---|---|
| Bloomington CFP Event | published | true | delivered | ✓ | 10 | 0 |
| CVS - Spotted at CVS | published | true | delivered | ✓ | 18 | 18 |
| CVS Epic Beauty | published | true | delivered | ✓ | 24 | 24 |
| CVS June | published | true | delivered | ✓ | 12 | 12 |
| Epic Beauty + Unaltered Beauty | published | true | delivered | ✓ | 13 | 13 |
| Extra Extra Big Deals January | published | true | delivered | ✓ | 20 | 20 |
| Valentine's Day | published | true | delivered | ✓ | 14 | 14 |
| PNW Content | published | true | delivered | ✓ | 34 | 0 |
| Community Captains | draft | false | **active** | — | 6 | 6 |
| Fall ExtraCare x Epic | draft | false | **active** | — | 0 | 0 |
| RX Strategic Markets | draft | false | **active** | — | 0 | 0 |

`lifecycle_status` stayed `delivered` on all eight, as §5 predicted — a single
`update published = true` was enough, with `trg_sync_recap_publish_state` moving `status` to
`published` in the same write. Re-running the script reports 0 changes. All eight
`/recap/<slug>` pages return **200**.

**PNW Content, second pass.** Ingested with `--folder --concurrency 2`: 570 files listed, **34
uploaded** after curation (24 images / 10 videos). All 34 are unlinked — the folder is partitioned
by store (Spokane / Eugene / Seattle), not by athlete, so nothing was matchable without guessing.
It publishes as gallery-only, the same shape as Bloomington. Hero picked at `quality_score`
67.26.

### Also fixed

`Olivia Olsen Captions.mp4` on Community Captains is Olivia Olson (Michigan) — the roster
spelling is right and the filename carries the typo, confirmed by Peyton. Linked by hand:
`media.athlete_id` null → `ec1d6fdb…`, plus the matching `media_athletes` row. Community
Captains is now 6/6 linked, and no unlinked media remains outside Bloomington.

Bloomington's 10 unlinked stay unlinked by decision — gallery-only event coverage.

---

## 11. Standing rule — hero selection

Brief 08 asked for "the same rule as brief 04". **Brief 04 defined no hero rule**: its docs never
mention hero, and nothing in the application picks one — `hero_image_url` is only ever read as a
card cover (`hero_image_url || thumbnail_url`) and otherwise set by hand in `OptInEditor`.

The rule below was defined here, approved by Peyton on 2026-09-10, and is **the standing rule for
future briefs to cite**:

> **Hero = the highest `quality_score` IMAGE owned by the campaign** (`media.campaign_id`,
> `type = 'image'`, ordered by `quality_score` descending, nulls last).
>
> - **Videos are excluded** — the column feeds an `<img>`.
> - `quality_score` is the sharpness + contrast + resolution score the ingest already computes
>   and curation ranks by, so the hero is the best frame curation kept.
> - **An existing `hero_image_url` is never overwritten.**
> - A campaign with no imported image keeps a **null** hero rather than being given a video poster
>   frame. That is legitimate — the card falls back to `thumbnail_url`, and two long-published CVS
>   campaigns (W/CWS, SPF) already run with a null hero.

Implemented in `scripts/cvs-ingest-08-publish.js`.

---

## 12. Still outstanding

- **`Fall ExtraCare x Epic`** — `active`, 215 athletes, **0 media**, 368 available in Drive. The only
  outstanding ingest. Still gated behind the machine's Sony MXF render batch. Ingest only — it is
  `active`, so it must **not** be published. Manifest is ready at
  `scripts/data/cvs-ingest-08/fall-extracare-x-epic-988.csv` (16 rows; 2 folders unmatched — a
  partially-matched pair folder and `Penn State Volleyball`, a team with no roster entry).
- **`RX Strategic Markets`** — skipped by the brief's own rule (empty Content folder, no tracker).
- **Curation caps** — Bloomington went 72 files → 10 (8-image cap per event folder, videos uncapped).
  If event campaigns read thin in the portal, `teamCap` or `--no-curate` is the lever.
- **Guardrail** — no new "NCAA" / "March Madness" occurrences. The two known ones from brief 07 §6
  are unchanged and still flagged, not renamed.
- **`manager_name`** — still null on all 11, not invented, per brief 05.

---

*Phase 1 and Phase 2 complete. 8 campaigns published, 2 left active and unpublished by design,
1 skipped. Only Fall ExtraCare x Epic's ingest remains.*

