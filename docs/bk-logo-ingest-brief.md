# BRIEF — Burger King logo ingest

**For:** Claude Code · **Written:** 1 Sep 2026 · planner chat
**Brand:** Burger King `6d4efdc4-2e4a-4a87-a2cc-aef662454378` (admin account 131)
**Rights:** Peyton confirmed Postgame has rights for this campaign. The source page's
public terms say editorial use only and that other use "will require express written
permission from Burger King Company LLC" — recorded here so the basis is on file.

---

## Why this is a brief and not already done

The planner chat can read and measure these files through the browser but **cannot move
95–98 KB binaries into Drive or Supabase Storage**: tool output truncates far below one
file's base64, and neither the Adobe nor the Drive connector accepts a source URL.
Claude Code can `curl` them directly and holds the service-role key. Everything that
could be determined without the bytes is below — measured, not assumed.

## The three files

Source page: `https://news.bk.com/media-assets/logos-fonts`
(recorded on the brand as `brand_guidelines_url`; the client named it in their own
campaign brief). All three are the complete published set — there is no ZIP, no vector,
and no stated hex anywhere on the page.

| # | File | px | bytes | SHA-256 |
|---|---|---|---|---|
| 1 | `BK_LOGO_PRIMARY_®_SU_RGB.png` | 4201 × 3600 | 95,058 | `0292c2fc2293f91fcc9362ad7b772663964f81da7be8934fa6df0466a42a4ec4` |
| 2 | `BK_LOGO_WORDMARK_BRGRKNG®_ST_BBQ_BROWN_RGB.png` | 6001 × 3001 | 97,823 | `47f896c2fb550be99ffdcb739872ed60d3a0cee6272918006af0acbb71f9c60e` |
| 3 | `BK_LOGO_WORDMARK_BRGRKNG®_ST_FIREY_RED_RGB.png` | 6000 × 3001 | 97,577 | `e5da35b521112b05f3df03811bff748d18ca72edc7cb1f1e359742bedd7e2779` |

URLs (host `cdn.prod.website-files.com`, path prefix `/631b4b4e277091ef01450237/`):

```
635821f727079c639eb64b5d_BK_LOGO_PRIMARY_%E2%94%AC%C2%AB_SU_RGB.png
635821f627079c17bdb64b21_BK_LOGO_WORDMARK_BRGRKNG%E2%94%AC%C2%AB_ST_BBQ_BROWN_RGB.png
635821f6f4e53661954c6a98_BK_LOGO_WORDMARK_BRGRKNG%E2%94%AC%C2%AB_ST_FIREY_RED_RGB.png
```

**Verify each SHA-256 after download.** If one differs, stop — the asset changed at source.

## Measured, not guessed

Sampled off-canvas from the decoded PNGs: alpha from the pixel data, ink as the modal
fully-opaque RGB.

| File | alpha | ink(s) | class |
|---|---|---|---|
| Primary | 73.3% transparent | `#FF8533` 51.6% + `#D62300` 48.4% | **MULTI — never flatten to one ink** |
| BBQ Brown wordmark | 87.5% transparent | `#502314` 99.9% | single ink |
| Firey Red wordmark | 87.6% transparent | `#D62300` 100% | single ink |

All three carry real alpha, so none is `OPAQUE`. All are far above the 512px floor.
`#D62300` appears independently in files 1 and 3 — a useful cross-check that the sampling
is reading real brand ink rather than compression noise.

## What to write

Storage: follow the existing convention for the other 374 rows (Supabase Storage), and
put a copy in the brand's Drive folder `1uZ2QUb3GZOk-wuMQJup9abIa5I-l3RW5`.

Three `brand_logos` rows, all `variant = 'on_white'` — every file is dark ink for a light
ground:

| kind | variant | ink_hex | has_alpha | width | height |
|---|---|---|---|---|---|
| `lockup` | `on_white` | `#D62300` | true | 4201 | 3600 |
| `wordmark` | `on_white` | `#502314` | true | 6001 | 3001 |
| `wordmark` | `on_white` | `#D62300` | true | 6000 | 3001 |

`source` (match the house free-text provenance style):

```
official BK newsroom media assets (news.bk.com/media-assets/logos-fonts)
| downloaded + sha256-verified 2026-09-01 | measured 2026-09-01
```

Set `verified_at`. Leave `reject_reason` null. **Correction:** an earlier draft said to leave
`dated` null — it is `NOT NULL DEFAULT false`, so `false` is the correct "nothing asserted" state.

## What must NOT happen

- **No `on_black` row.** Burger King publishes no white/reversed file. Generating one
  means recolouring their mark — forbidden by the source terms and by the precedent set
  in `LOGO-SOURCING-PASS-1.md` (brand-supplied reversed files only, branch B1).
- **Do not flatten the primary lockup.** Two inks by design.
- **Do not write `brands.fill_color`.** The inks above are *sampled from artwork*, not a
  stated brand value, and the house rule is stated-beats-sampled with nothing recorded
  when neither is available. `fill_color_source` would be a lie.
- **Leave `kit_status = 'placeholder'`.** It is accurate until a reversed file and a
  vector master arrive. Promoting to `official` on a PNG-only, no-knockout set overstates
  what is on hand.

## Still open — ask the client

The newsroom page is a press resource, not BK's brand kit. Their campaign manager should
ask the BK contact for: **vector masters** (SVG/EPS/AI), a **white/reversed** version, and
**stated hex values**. That closes `on_black`, gives a real `fill_color` with provenance,
and retires this brief.


---

# OUTCOME — ingested 1 Sep 2026

Executed by Claude Code. Verified independently from the planner chat.

## What landed

`brand_logos` 374 → 376. Two rows, both `on_white`, `has_alpha` true, `verified_at` set,
`reject_reason` null, `dated` false:

| kind | ink_hex | px | file |
|---|---|---|---|
| `lockup` | `#D62300` | 4201 × 3600 | `bk-lockup-primary.png` |
| `wordmark` | `#502314` | 6001 × 3001 | `bk-wordmark-bbq-brown.png` |

Storage: `campaign-media/brand-kits/{brand_id}/` — matching the convention the other rows use.
Drive: all three PNGs in the brand folder `1uZ2QUb3GZOk-wuMQJup9abIa5I-l3RW5`, byte sizes
matching source exactly (95,058 / 97,823 / 97,577). SHA-256 verified on download and again
on a round-trip fetch of the public Storage URLs.

## Why BBQ Brown holds the wordmark slot — and where Firey Red went

Burger King publishes two wordmark colourways. `brand_logos` has
`UNIQUE (brand_id, variant, kind)`, so only one can be the registered `wordmark / on_white`.

**BBQ Brown `#502314` won on contrast.** Measured by WCAG relative luminance, the same
method `BRAND-KIT-HARVEST-2026-08-22.md` uses:

| ink | on white | on off-white `#FAF8F5` | on Postgame black |
|---|---|---|---|
| **BBQ Brown `#502314`** | **13.196:1** | 12.45:1 | 1.52:1 |
| Firey Red `#D62300` | 5.123:1 | 4.83:1 | 3.93:1 |

Both clear the 3:1 floor; brown is more than twice as strong on the ground the `on_white`
slot exists to serve. The case for red was cross-kind consistency with the lockup's ink —
contrast won.

**The Firey Red file is not lost.** It is in Storage and in Drive, deliberately unregistered.
Promoting it is one `UPDATE` — nothing needs re-downloading.

**Two alternatives were rejected, for the record:**

- *Widen the constraint and keep both.* `brand-logo.ts:100` resolves with
  `candidates.find((l) => l.kind === kind)` and there is no `ORDER BY` in the query. Two rows
  in one slot resolve **non-deterministically — differently between queries**, not merely
  arbitrarily once. The constraint is what holds the resolver's one-file-per-slot assumption
  up; widening it without teaching the resolver to choose converts a clean failure into an
  intermittent one.
- *File BBQ Brown as `kind='mono'`.* The only `mono` row in the table is Allstate,
  `source: "quarantine record 2026-08-24"`, every measurement null — and it also carries
  `dated: true` with `reject_reason: "DATED - do not use. Kept so backfills from
  logo_primary_url do not silently reintroduce it."` `mono` is where an unusable record was
  deliberately parked to block its own re-import, not a colourway slot.

## Deliberately still missing

`on_black`: **none**, and that is correct. BK publishes no reversed file; generating one means
recolouring their mark. `fill_color` / `fill_color_source`: null — the inks above are sampled
from artwork, not stated by the brand. `kit_status`: `placeholder`.

`brands.brand_guidelines_url` stays on the parent `news.bk.com/media-assets` rather than the
`/logos-fonts` child: it is verbatim what the client wrote in their campaign brief, and the
parent covers future harvests of menu and restaurant imagery. Page-level provenance lives in
each row's `source`.

## Correction to this brief

An earlier revision said "the other 309 rows." The table held **374** before this ingest.
The 309 figure was quoted from `SESSION-ADDENDUM-2026-08-26.md` rather than counted — it was
already 65 rows stale when it was read. Corrected above. The lesson is the project's own
standing rule: run the SELECT, do not quote the doc.

## The client ask — unchanged, plus one

Vector masters (SVG/EPS/AI) · a white/reversed file · stated hex values · **and which wordmark
colourway BK treats as primary.** That last one is the real question underneath the choice
above, and BK should answer it rather than us inferring it from a contrast ratio.
