# CVS ingest + publish (brief 08) — Phase 1 pre-flight

**Run date:** 2026-09-10 · **Status:** ⛔ **not executed — blocked, nothing written**
**Scope:** 11 CVS rows · **Prereq:** brief 07 Phase B (applied; PR #267 **still open**)

No Supabase row and no Drive object has been modified by this brief. Everything below is
read-only verification done before touching anything.

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

*Read-only pre-flight. No writes performed. Awaiting decisions before any of Phase 1 runs.*
