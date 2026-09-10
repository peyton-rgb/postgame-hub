# CVS tracker-tab audit + Drive link repair — Phase A report

**Run date:** 2026-09-09 · **Mode:** read-only (no Supabase or Drive writes) · **Brief:** 07
**Brand:** CVS — `brands.id = 06ad6e6e-b859-461e-a496-14472397ab4e` · **53** `campaign_recaps` rows

Nothing in this report has been applied. Phase B waits on your approval of the tables below.

---

## 0. Read this first — three things the brief got wrong

**a) Five of the sixteen proposed Drive folders contain zero media.**
`Summer/SPF`, `2025 Halloween`, `ExtraCare EOY`, `Mother's Day 2025` and `Epic Beauty - Fall` are
flat folders of contracts, recap decks and CSVs. No images, no video, no `Content` subfolder.
Linking them as `drive_content_folder_id` is harmless but pointless — brief 04's ingest skips
non-media (`import-campaign-media.js:768`), so it would import 0 files. See §3.

**b) Three more proposals point at a campaign parent folder that has a `Content` child.**
For 2024–25 campaigns the media lives one level down. Linking the parent still works (the ingest
recurses) but it also walks the contracts subfolder. The 2026 rows already follow the cleaner
pattern — they point straight at a folder under `Athlete Content 2026`. Recommendation in §3.

**c) `Holiday 2024` holds one media file, not two phases.**
The brief asked to confirm it covers Phase 2 and Phase 3. Its `Content` subfolder has **1** image
total. Whatever the holiday content was, it is not in this folder.

---

## 1. Tab inventory (the four trackers)

| Tracker | Sheet ID | Tabs |
|---|---|---|
| 2024 Master — "Internal All Campaigns" | `1CFCFy40SMt_xgNYcmRiCqVPx4bUZo1vPLqKjNADLyB0` | 13 |
| 2024 "Postgame / CVS 2024 Campaigns" | `13Hv4tiyWCPUqJ-euU3dJBUnWsFnVkXQhRD3UOLxEeWE` | 10 |
| 2025 Master — "Internal All Campaigns" | `1WQ2HOig9RBn1dAC1WZg0uHXVNZICf8hgBU0e2z9Jkw8` | 30 |
| 2026 Master — "Internal All Campaigns" | `1uLiJgwjxSc6vg3sk78Q9ph33RBiY3AoW_eQXBH8VdeM` | 18 |

<details>
<summary>Full tab list with gids</summary>

**2024 Master (`1CFCFy40…`)**
`314403906` Store Brands · `1903349389` Holiday Affiliate · `1282503252` Same-Day Delivery ·
`1626120294` SDD Total Metrics · `975368461` Epic Beauty Affiliate Campaign ·
`1061961159` Spotted At CVS Affiliate Campaign · `1517515410` Spotted Total Metrics ·
`494071538` Summer June Affiliate Campaign · `1886149189` Spotted Affiliate links ·
`1665331463` Summer June Total Metrics · `894956486` Well Market Campaign ·
`152404179` ASSUMPTIONS (DO NOT COPY) · `462426324` Bitly June Affiliate (Reference)

**2024 Postgame/CVS (`13Hv4tiy…`)**
`0` Epic Beauty · `427151962` Spotted at CVS · `1453160804` CVS Summer (June) ·
`199932386` Well Market Gifting (June) · `1817003903` CVS Store Brands - Phase 1 ·
`277927261` CVS Holiday - Phase 1 · `1398313462` CVS Store Brands - Phase 2 ·
`2053250893` CVS holiday - Phase 2 · `670435861` CVS Holiday - Phase 3 ·
`1473763348` CAMPAIGNEXPORT-CVSEpic Beauty-4222024 (2)

**2025 Master (`1WQ2HOig…`)**
`1310965878` Mother's Day · `1279522821` Sheet30 · `1153239036` Schools ·
`1840792703` Epic Metrics - CVS · `1614056043` Sheet12 · `1626120294` SDD Total Metrics ·
`1886149189` Spotted Affiliate links · `1820469488` NIL Influencer Metrics · `213720805` Dez Boosting ·
`462426324` Bitly June Affiliate (Reference) · `2113674642` Posts IG · `1653369416` Summer SPF ·
`229649195` Epic Beauty 2 · `1993793254` Halloween · `514101134` PNW · `1726677583` IMZ ·
`314403906` Epic Beauty · `758447428` Sheet36 · `2041572913` Sheet38 · `334128026` Holiday ·
`1904433336` ExtraCare December · `1646168985` IG Reach Rates (Impressions) ·
`2104418691` Gift Cards - Holiday · `301659762` Remaining MM · `1176503583` Posts Tiktok ·
`417490670` All Posts Report · `121677474` Posts with No Promo · `176496329` Comments IG ·
`1935840312` Sentiment · `710479186` Sentiment Summary

**2026 Master (`1uLiJgwj…`)**
`1389657349` SPF · `983669871` College World Series · `1220833137` Fall Epic Beauty ·
`591116651` Community Captains Tracker · `1029554010` Chicago · `16945540` Mother's Day ·
`1452875744` Minute Clinic · `629235660` Ronald Mcdonald House · `1455656181` Extra Big Deals ·
`1764781348` Community Captains · `293073679` IG Reach Rates (Impressions) ·
`1684390602` NEW CAMPAIGN TEMPLATE PAGE · `1684065158` Epic Beauty · `1968908289` March Madness ·
`1951289203` Sheet14 · `2085510601` Sheet13 · `578971717` Valentines Day · `1570003009` CFP Event

</details>

---

## 2. Tracker tab audit — 18 rows to change

The shared-gid problem is real and slightly worse than the brief estimated. **12 rows point at the
wrong tab**, **2 more carry no `gid` at all** (so they open whatever tab is first), and **4 rows have
no `tracker_url` despite a matching tab existing**.

Rows not listed below were checked and are correct.

### 2026 Master — `1uLiJgwjxSc6vg3sk78Q9ph33RBiY3AoW_eQXBH8VdeM`

| Campaign | Current gid → tab | Proposed gid → tab | Evidence |
|---|---|---|---|
| Valentine's Day | `1455656181` Extra Big Deals | **`578971717`** Valentines Day | exact title match |
| 26 Spring Epic Beauty | `1455656181` Extra Big Deals | **`1684065158`** Epic Beauty | roster = Byrum Brown, Joshua Jefferson, Koa Peat (spring '26) |
| The Tournament | `629235660` Ronald Mcdonald House | **`1968908289`** March Madness ⚠ | roster = Christian Anderson, Ebuka Okorie, Mikaylah Williams, Braden Smith |
| Community Captains | `1452875744` Minute Clinic | **`1764781348`** Community Captains | roster tab w/ volunteer-notes column; see note |
| W/CWS | `1389657349` SPF | **`983669871`** College World Series | baseball roster, "CWS" = College World Series |
| Mother's Day (2026) | *no gid* (defaults to SPF) | **`16945540`** Mother's Day | exact title match |
| Bloomington CFP Event | *no tracker_url* | **`1570003009`** CFP Event | tab A1 reads "Indiana / Date Options / Location Options" |
| Fall ExtraCare x Epic | *no tracker_url* | **`1220833137`** Fall Epic Beauty | roster = Rocco Becht, Olivia Olson, Hilton Alexander, Mearah O'Neal — **identical** to the `Epic Beauty - Aug` Drive subfolders |

*Correct already:* Extra Extra Big Deals January `1455656181`, Ronald McDonald House Boston
`629235660`, Minute Clinic `1452875744`, SPF `1389657349`, Chicago Activation `1029554010`.

> ⚠ **Guardrail flag (not renaming anything):** the 2026 tab is literally titled **"March Madness"**,
> and there is a legacy recap row named **"CVS March Madness"** (admin 348). Postgame's campaign is
> "The Tournament". Two occurrences of prohibited brand-facing text — flagged per the brief, left
> untouched. The `Valentines Day` tab also carries "2x NCAA Champion" in a Notes cell (row 2).

> **Community Captains is the one genuinely ambiguous call.** Two candidates:
> `1764781348` "Community Captains" is a per-athlete roster with a volunteer/community-service notes
> column. `591116651` "Community Captains Tracker" is a metrics sheet with a `CALCULATIONS: DO NOT
> ERASE` row and a **Mother's Day** section inside it — it looks like a cross-campaign reach
> calculator, not this campaign's roster. I propose `1764781348`; say the word if you want the other.

### 2025 Master — `1WQ2HOig9RBn1dAC1WZg0uHXVNZICf8hgBU0e2z9Jkw8`

| Campaign | Current gid → tab | Proposed gid → tab | Evidence |
|---|---|---|---|
| Mother's Day 2025 | `314403906` Epic Beauty | **`1310965878`** Mother's Day | roster = Madison Booker, Aneesah Morrow, Kiki Rice; Kiki Rice contract is in the Drive folder |
| Summer/SPF | `314403906` Epic Beauty | **`1653369416`** Summer SPF | roster = Avery Johnson, Behren Morton; Drive folder holds "…Contract - CVS Summer SPF May 2025" |
| Epic Sale Fall 2025 | `314403906` Epic Beauty | **`229649195`** Epic Beauty 2 | tab header reads "This or That & Epic Beauty"; Drive folder holds "Alex Orji CVS Epic + ThisThat Study" contract and "EPIC BEAUTY 14 FALL 2025" brief |
| Immunization | `314403906` Epic Beauty | **`1726677583`** IMZ | IMZ = immunization; roster Elliot Cadeau, Seth Trimble |
| Halloween | `514101134` PNW | **`1993793254`** Halloween | exact title match |
| ExtraCare December | `334128026` Holiday | **`1904433336`** ExtraCare December | exact title match |
| Epic Beauty + Unaltered Beauty | *no gid* (defaults to Mother's Day) | **`314403906`** Epic Beauty | Feb-2025 row; tab is the spring roster w/ bitly column |
| PNW Content | **different sheet** `186Wd13rXdcT7cKtuoupa2TduB8jAevvG6OpqEUrfFGs` | *decision needed* — 2025 Master `514101134` "PNW"? | that tab lists Spokane / Seattle / Eugene Event Content, matching the Drive folder's three store subfolders |

*Correct already:* Holiday `334128026`.

> **PNW Content is the only row pointing at a sheet outside the four in scope.** Its current sheet may
> be a standalone tracker that is perfectly fine. The brief's scope was "fix the gid, keep the sheet",
> and moving it changes the sheet — so I've left it as a decision rather than folding it into the
> apply table. Two other rows also reference out-of-scope sheets and were left alone:
> `CVS Affiliate` → `1V0gwFuC…` and `CVS Event Apprarance & Content` → `15EQ8QTd…`.

### 2024 "Postgame / CVS 2024 Campaigns" — `13Hv4tiyWCPUqJ-euU3dJBUnWsFnVkXQhRD3UOLxEeWE`

| Campaign | Current gid → tab | Proposed gid → tab | Evidence |
|---|---|---|---|
| CVS - Spotted at CVS | `0` Epic Beauty | **`427151962`** Spotted at CVS | exact title match |
| CVS June | *no tracker_url* | **`1453160804`** CVS Summer (June) | Drive folder "Summer - June" |
| CVS Well Market Gifting | *no tracker_url* | **`199932386`** Well Market Gifting (June) | exact title match |

*Correct already:* CVS Epic Beauty `0`, Store Brands Gifting - Phase 1 `1817003903`,
CVS Holiday Affiliate Phase 1 `277927261`, CVS Holiday Phase 2 `2053250893`,
Store Brands - Phase 2 `1398313462`, CVS Holiday Phase 3 `670435861`.

### No tab exists

| Campaign | Current | Finding |
|---|---|---|
| CVS March Madness (admin 348) | 2024 Master, no gid | **No matching tab in any of the four trackers.** The 2024 Master's 13 tabs are Store Brands / Holiday / SDD / Epic Beauty / Spotted / Summer June / Well Market / reference tabs. Leave `tracker_url` as-is or clear it — your call. |

---

## 3. Drive content-folder proposal

All 16 folder IDs in the brief resolve and are live (none trashed). Counts are recursive.
"Media" counts image/video only — what an ingest would actually pick up.

### 3a. Ready to link as-is — 2026 shelf (`Athlete Content 2026`)

These already follow the house pattern: a folder under `Athlete Content 2026` holding only media.

| Campaign | Folder | ID | Media | Other |
|---|---|---|---|---|
| Extra Extra Big Deals January | EEBD - January 2026 | `1um06aPXkRbWQIcjj8mekPVy5bQvqeOtn` | **36** | 0 |
| Valentine's Day | Valentines - Feb 2026 | `1qeMUTQ5b_mb1ejf-TapPagM9w92BM-ES` | **41** | 0 |
| Bloomington CFP Event | Indiana CFP Celebration Event | `1asDYvNGCthsyxtpDodr6EesUiAMMM5Y-` | **72** | 0 |
| Community Captains | Community Captains HQ Event Reel | `1MFqtWKVLuMFwYOg3_Ke-_6lsRAtgV9Jl` | **6** | 0 |
| Fall ExtraCare x Epic | Epic Beauty - Aug | `11D4zEh2SJIPPXSkctFKJ9ZJrl5IKyIuS` | **368** | 0 |

Notes:
- **Community Captains** — the brief also flagged `1QMwrtBbeJfC9a-09xR3cDv_btHFH08rB` ("Thank you HQ
  Event", **5** media). Both are event reels for the same campaign but they are separate folders and
  the column holds one ID. Recommend the 6-file reel; the 5-file folder needs a second campaign row
  or a manual merge in Drive. **Decision needed.**
- **Fall ExtraCare x Epic** already has `drive_folder_id = 1RoYo4kT7GOCBzJpXDjpWzQBoSjGwq3ld`
  ("Fall ExtraCare x Epic" under `CVS 2026`), which was provisioned with empty `Contracts/` and
  `Content/` subfolders. Its real media sits in `Epic Beauty - Aug`. Linking as proposed is correct;
  the empty provisioned `Content/` (`1smAFMdTaLzUzBlRMYjHBdGeXbXzI3oyA`) is then dead weight.

### 3b. Link the `Content` subfolder, not the parent — recommended change to the brief

| Campaign | Brief proposed (parent) | Recommend instead | Media | Why |
|---|---|---|---|---|
| Epic Beauty + Unaltered Beauty | `1gwBDzitN-RpYig5IXkTjE_H_wa06I7b5` Epic Beauty - Spring | **`1cG-6NPSGkAg7yuEJR4NdEQYu5Lfc4kER`** (`Content`) | **60** | parent also holds `Recap` (3 docs) + `Athlete contracts` (11 docs) |
| CVS Epic Beauty (2024) | `1MWudKZYKe71Pkc7tqlzrC0y7Lm9EKNOX` Epic Beauty - April 2024 | **`1TaGY-LaR5vvyAW5cQHKirPTvEyP6PtvX`** (`CVS Epic Beauty Content`) | **26** | parent has 1 loose doc |
| CVS - Spotted at CVS | `1zSIabQG2jdtn3_daeaZL3CCOmOTELCKw` Spotted at CVS - May 2024 | **`1R-VpD32RTIJr0o-rSVB8KCJO2mkETsYY`** (`Content Folder - Tier 1s`) | **26** | parent has 1 loose doc |

Either choice ingests the same media — the subfolder is just tighter. Your call; I'd take the
subfolder, since `drive_content_folder_id` is meant to name a content folder specifically
(that is what the provisioner writes for new campaigns, e.g. Minute Clinic → "Minute Clinic (CVS Content)").

### 3c. Fine as proposed, but read the count

| Campaign | Folder | ID | Media | Note |
|---|---|---|---|---|
| PNW Content | 2025 PNW + Events | `1XhcYSmrjxV6VjK6hi1Ln1-9R9k7AP1vz` | **531** | across Spokane (98) / Eugene (188) / Seattle (244) |
| CVS June | Summer - June | `14XljLWmk5ekDwpBJr3d7hOvCLoAMzt9d` | **18** | 3 per-athlete subfolders, no single `Content` child |
| CVS Holiday Phase 2 **and** Phase 3 | Holiday 2024 | `1oa9Kh-pSLDO2n5YQ1l7Vqgcm6dk31fDb` | **1** | ⚠ see below |

> **Holiday 2024 does not hold both phases.** Asked to confirm — it does not. The folder is
> `Click Tracking Reports` (6 CSV/docs) + `Content` (**1** media file). Pointing both Phase 2 and
> Phase 3 at it yields one image shared between two campaigns. Recommend **not** linking either row
> until the real holiday content is located. **Decision needed.**

### 3d. Do not link — zero media

All five are flat admin folders: contracts, recap decks, CSVs. No `Content` subfolder exists.

| Campaign | Folder | ID | Media | What's actually inside |
|---|---|---|---|---|
| Summer/SPF (2025) | Summer/SPF | `16id2sGVmW43rw0oytYfhJxTe3amnDFM7` | **0** | 43 files: 36 athlete contracts, recap .pptx, gift-card CSVs |
| Halloween (2025) | 2025 Halloween | `11wsE4JyPbRlMlVWcjIHllEomluGqtELM` | **0** | 8 files: contracts, recap .pptx, video specs .xlsx |
| ExtraCare December (2025) | ExtraCare EOY | `19pHwJxD0loQY3H9m5JQ_6BPqOcQ0JhYY` | **0** | 1 file: a single .docx contract |
| Mother's Day 2025 | Mother's Day | `1Q_FFtMmVVhZy0a1Vy7PPf7x5zsT80u1z` | **0** | 12 files: contracts, recap deck, paid-report .xlsx |
| Epic Sale Fall 2025 | Epic Beauty - Fall | `1lLfGX3NvHk0JCfge9YwoQbBdxFLyiaHa` | **0** | 13 files: contracts, campaign brief, SKU .xlsx |

Setting `drive_content_folder_id` on these is safe (the ingest skips non-media) but buys nothing.
Two options: link them anyway for provenance, or leave null and hunt for the real content folders in
a follow-up. **Decision needed** — I'd leave them null so an empty ingest doesn't read as "done".

---

## 4. The four judgment calls

### 4a. `26 Spring Epic Beauty` exists twice — merge into the Hub-native row

| | **A — keep this one** | **B — retire this one** |
|---|---|---|
| `id` | `4dd34b3c-8929-4130-887a-d388ca21f0b1` | `83702fc8-579a-465d-9fa9-79595c13de56` |
| slug | `26-spring-epic-beauty-mng480ef` | `26-spring-epic-beauty-857` |
| lifecycle / published | `closed` / **true** | `delivered` / false |
| `admin_campaign_id` | `afe0fdbb-…` (a UUID) | `857` |
| athletes | **418** | 0 |
| media / media_campaigns | **30 / 30** | 0 / 0 |
| hero + thumbnail | yes | no |
| `drive_folder_id` | `13E-8v0Czkh7DtXx4G92OHiaHf0yInaWx` → "Epic Beauty - January", **203 media** | null |
| `tracker_url` | null | 2026 Master, wrong gid `1455656181` |
| created / updated | 2026-04-01 / 2026-04-01 | 2026-02-02 / 2026-05-26 |

**Proposed merge direction: A absorbs B, then B is retired.** A carries every piece of real content;
B is an empty admin shell. Concretely — carry onto A: `admin_campaign_id = '857'` and a
`tracker_url` with the corrected gid `1684065158`. Then archive/delete B.

Two things to decide before this runs:
1. A's `admin_campaign_id` is a **UUID**, not the numeric admin id every other row uses. Overwriting
   it with `'857'` is probably right, but that UUID came from somewhere — worth a look before it goes.
2. A's Drive folder is named **"Epic Beauty - January"** while the campaign is "26 Spring". Same
   campaign under a different month label, or the wrong folder? A has 203 media in it, so it is not
   empty — but the name mismatch is worth your eye.

Per the brief this job does not touch `lifecycle_status` or `published`, so A stays `closed`/published.

### 4b. `IMZ` (admin 996) — wrong link, same program name

`IMZ` was created **2026-07** and is `active`, but its `drive_folder_id` points at
`1KvNJ2IENY1M_l5F7nficeeM3Y9Z9LItD` — a folder named `IMZ` sitting on the **2025** shelf.

Contents (20 files, **0 media**) straddle both years:
- 2025: `CVS Recap_IMZ_Nov 2025 .pptx`, `CVS Immunization x Postgame Athlete Contract (Fall 2025).docx`
- 2026: `CVS IMZ x Postgame Launch Timeline Fall 2026`, `CVS IMZ - Aug 2026 Plan`, `CVS IMZ Supplement Slides 9.4`

**Read: same recurring program, one folder reused across two years — not a wrong link, but not a
2026 campaign folder either.** There is also a separate 2025 recap row (`Immunization`, admin 762)
whose correct tab is the 2025 `IMZ` tab. So one Drive folder is serving two campaign rows.

Recommend: leave the link alone for now, and open a follow-up to split a `CVS IMZ 2026` folder under
`CVS 2026` (the 2026 shelf has no IMZ folder). Not something I'd fold into Phase B. **Your call.**

### 4c. `Injured Athlete`, `Leadership Video`, `November Leadership Panel Discussion`, `CVS Round Table`

All four confirmed **completely empty**: no `tracker_url`, no `drive_folder_id`, 0 athletes, 0 media,
0 rosters, no hero, no thumbnail, no description. A Drive search by name returns **no folder** for any
of them. All four are `published = false` and `lifecycle_status = delivered`.

| Campaign | admin id | created | updated |
|---|---|---|---|
| CVS Round Table | 582 | 2024-12-11 | 2026-05-26 |
| Leadership Video | 792 | 2025-09-12 | 2026-05-26 |
| November Leadership Panel Discussion | 820 | 2025-10-31 | 2026-05-26 |
| Injured Athlete | 860 | 2026-02-03 | 2026-05-22 |

**Read: admin noise, not campaigns.** They look like line items that came across in the admin sync
(the identical 2026-05-26 `updated_at` on three of them is a bulk sync touch, not real activity).
"Leadership Video" and "November Leadership Panel Discussion" also read as *deliverables within* the
Community Captains leadership work rather than campaigns of their own — note that
`CVS Community Captains 2026` in Drive contains
`CVS Community Captains -- Athlete panel discussion .docx`, which is likely the same panel.

Recommend: leave them unpublished and out of the portal. Deleting is your call — since they're
already `published = false` they cost nothing where they sit. **No action proposed in Phase B.**

### 4d. Drive-only 2026 folders with no Hub row

| Folder | ID | Media | Other | Read |
|---|---|---|---|---|
| CVS x IU Event 2026 Photos | `1wPt5XEuJb7lA9V0sUM_Y17h5IShyl4Go` | **85** | 1 | **Real content with nowhere to go.** Worth a campaign row — or it may belong to `Bloomington CFP Event` (Indiana), which is also an IU-adjacent event. Check for overlap before creating a new row. |
| CVS Pittsburgh Activation | `1AwwT_ME5xM38GywxV-ri83D1bB0-c3vc` | 0 | 1 | Planning shell |
| CVS PCW Q4 Event Activation 2026 | `1x412PoWNNqQttOzFam-SS1BM3N5QLo2v` | 0 | 2 | Planning shell |
| CVS Project Teal 2026 | `1inykxtij7nSSyd7IcLAm7iAJk9QPBhTH` | 0 | 1 | Planning shell |
| Chicago Market NIL 2026 | `1ZcAMJSodg8PUSi_khU1Mge4hx2I0Ec8Q` | 0 | 7 | Planning docs. Note the Hub already has a **`Chicago Activation`** row (admin 876, published, 32 media, folder `1vp3Vct1…`) — this is probably the planning folder for that same work, not a missing campaign. |

**Recommend:** only `CVS x IU Event 2026 Photos` needs a decision now. The other four are empty
planning folders — correctly absent from the Hub. **Decision needed on the IU folder.**

---

## 5. Other findings worth your attention

1. **`drive_content_folder_id` is null on 47 of 53 CVS rows.** Only 6 are set. Of those, 5 point at
   the *same id as `drive_folder_id`* (Holiday, RMH Boston, Chicago Activation, SPF, W/CWS) — the
   legacy flat-folder pattern — while Minute Clinic, Mother's Day 2026 and RX Strategic Markets point
   at a genuine `Content` subfolder. Worth settling which convention you want before Phase B writes
   17 more rows.
2. **`drive_provisioned_at` is null on every CVS row but one** (RX Strategic Markets, 2026-09-01).
   The `/api/sync/drive-folders` sweep has essentially never run over CVS.
3. **`campaign_rosters` is empty for all 53 CVS rows.** The 418 athletes on `26 Spring Epic Beauty`
   live in the `athletes` table via `campaign_id`, not in `campaign_rosters`. Anything reading rosters
   for CVS will show nothing.
4. **`database.types.ts` is stale** — it has no `drive_content_folder_id`, `drive_contracts_folder_id`,
   `drive_trackers_folder_id`, `drive_provisioned_at` or `lifecycle_status`, all of which exist in the
   database and are written by live code. Worth a regen.
5. **Two more out-of-scope tracker sheets** are referenced by CVS rows (§2): `1V0gwFuC…` on
   `CVS Affiliate` and `15EQ8QTd…` on `CVS Event Apprarance & Content`. Not audited — outside the four.
6. **Typo in a campaign name:** `CVS Event Apprarance & Content` (admin 238). Not renaming per the
   brief; flagging it.

---

## 6. Guardrail check — "NCAA" / "March Madness"

Occurrences found, **none renamed**:

| Where | Text |
|---|---|
| 2026 Master tracker, tab title | **"March Madness"** (`gid 1968908289`) — the tab I propose linking to `The Tournament` |
| `campaign_recaps.name` (admin 348) | **"CVS March Madness"** — legacy 2024 row, unpublished |
| 2026 Master, `Valentines Day` tab, row 2 Notes | "2x **NCAA** Champion, First Te…" |
| 2025 Master, tab title | "Remaining MM" (`gid 301659762`) — abbreviation, ambiguous |

None of these are brand-facing today (all four campaigns above are either unpublished or the text
lives inside an internal tracker). If the portal ever surfaces tab titles or Notes columns, the first
three become brand-facing and need renaming first.

---

## 7. What Phase B would do, if approved

One migration-style script, logging old → new per row:

- **18 `tracker_url` updates** — §2. Same sheet, corrected `gid` (14 fixes + 4 additions).
  Excludes `PNW Content` (sheet change, needs your decision) and `CVS March Madness` (no tab exists).
- **11 `drive_content_folder_id` updates** — §3a (5) + §3b (3) + §3c (3, or 1 if you drop the two
  Holiday rows), pending your §3b parent-vs-subfolder call.
- **Not included:** the 5 zero-media folders (§3d), the `26 Spring Epic Beauty` merge (§4a — it
  deletes a row, so it wants its own approved script), IMZ (§4b), the four empty rows (§4c), and the
  IU folder (§4d).
- **Not touched, per brief:** `lifecycle_status`, `published`, and any media ingest.

### Open decisions blocking a clean Phase B

1. §3b — link `Content` subfolders or parent folders for the three 2024–25 rows?
2. §3d — link the five zero-media folders anyway, or leave null?
3. §3c — link `Holiday 2024` (1 media file) to Phase 2 and Phase 3, or hold?
4. §3a — Community Captains: the 6-file reel, the 5-file "Thank you HQ Event", or both (needs a merge)?
5. §2 — `PNW Content`: move it to the 2025 Master `PNW` tab, or leave its standalone sheet?
6. §2 — Community Captains tab: `1764781348` (proposed) or `591116651`?
7. §4a — confirm the merge direction and what to do with A's UUID `admin_campaign_id`.
8. §4d — create a campaign row for `CVS x IU Event 2026 Photos` (85 media), or fold into Bloomington CFP?

---

*Read-only run. No Supabase rows and no Drive objects were modified. Scripts used are disposable and
live in the session scratchpad, not in the repo.*
