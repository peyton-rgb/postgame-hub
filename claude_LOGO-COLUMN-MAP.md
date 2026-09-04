# Logo column map — the eight `brands` logo columns

**Date:** 2026-09-04 · **Mode:** read-only audit · **Scope:** `~/postgame/hub/src` (+ `scripts/`)
**Worked example:** UMG `1168bcb1-5da8-47cd-87a5-758c0fef2741`

All 132-row counts below were re-verified live against prod before writing. Every fill
number in the commissioning brief is confirmed exact.

---

## 0. The headline

There is no single column to fix, because **there is no single chain that reads them.**
This repo contains **eleven distinct hand-rolled logo fallback chains, and no two are
identical.** Several disagree about which end of the light/dark axis they want, and two
different functions share the name `resolveBrandLogo` while doing unrelated things.

That — not any one column — is why UMG took six attempts.

---

## 1. Column → readers → background → filter → class

| Column | Populated | Read by (surface) | Background | Filter | Class |
|---|---:|---|---|---|---|
| `logo_url` | 92 | `dashboard/[id]` brand-kit seed (`logos[0]`, label "Primary"); `dashboard/recaps` `brandMark()` **fallback**; `public-site.ts` last resort; `athlete-deals` / `payouts` / `athlete-deliverables` (**first**); `campaign-readiness` `pickLogo()` 4th; `api/search` | mixed — dark recap tile, dark athlete cards | knockout on recaps tile (see §4) | **LIVE** |
| `logo_primary_url` | 92 | `portal.ts` `pickBrandLogo()` **first**; `portal/invite-token` first; `portal/brand-session` first; `getCoverFlowCampaigns` `logoChip`; `getHomepageRotatorCampaigns` `logoChip`; `admin/layout` 3rd; `packages.ts` `pickHeroLogo()` 3rd | **both** — dark portal *and* white email chip | none | **LIVE** |
| `logo_dark_url` | 87 | `portal.ts` `pickBrandLogo()` **2nd**; `invite-token` 2nd; `brand-session` 2nd; `packages` `pickHeroLogo()` 4th; `campaign-readiness` `pickLogo()` **last** | dark portal (**wrong** — see §6) | none | **LIVE** |
| `logo_light_url` | 83 | `dashboard/recaps` `brandMark()` **first**; `admin/layout` **first** (dark sidebar); `portal-data.ts` **first**; `public-site.ts` 1st legacy; `getHomepageRotatorCampaigns` `logoLight`; `campaign-readiness` 2nd | dark | knockout on recaps tile | **LIVE** |
| `logo_mark_url` | 81 | `dashboard/recaps` `brandMark()` for `SQUARE_MARKS` only; `campaign-readiness` 6th; `packages` `pickHeroLogo()` 5th; `invite-email` last resort | dark | knockout on recaps tile | **LIVE** |
| `logo_white_url` | **4** | `packages.ts` `pickHeroLogo()` **FIRST**; `campaign-readiness` `pickLogo()` **FIRST**; `admin/layout` 2nd; `portal-data` 2nd; `portal.ts` last; `invite-token` last; `brand-session` last; `athlete-deals`/`payouts`/`athlete-deliverables` 2nd | dark / brand-colour hero | none | **LIVE** |
| `logo_icon_url` | **1** | `campaign-readiness` `pickLogo()` 5th — **only reference in the repo** | dark rail | chip heuristic | **READ, NEVER WRITTEN** |
| `logo_icon_svg_url` | **1** | *nothing* — appears only in generated types (`types/supabase.ts`, `lib/database.types.ts`) | — | — | **DEAD** |

---

## 2. Column → what writes it

| Column | Writer | Notes |
|---|---|---|
| `logo_primary_url` | `dashboard/brands/[id]/page.tsx:292` (`saveKit`) | the brand-kit edit UI |
| `logo_dark_url` | `dashboard/brands/[id]/page.tsx:293` | same form |
| `logo_light_url` | `dashboard/brands/[id]/page.tsx:294` | same form |
| `logo_mark_url` | `dashboard/brands/[id]/page.tsx:295` | same form |
| `logo_url` | ~~`dashboard/brands/[id]/page.tsx:296`~~ — **write removed 2026-09-04, see §2.1**; still written by `components/BrandList.tsx:110,137` (new-brand create + upload) | **FROZEN in the brand-kit editor** |
| `logo_white_url` | `scripts/upload-canes-package-assets.ts:166` **only** | one-off script, hardcoded to a single brand (Raising Cane's), sets only when null |
| `logo_icon_url` | **nothing in the repo** | 1 populated row arrived from outside this codebase |
| `logo_icon_svg_url` | **nothing in the repo** | 1 populated row, same |

### 2.1 The 31-row divergence has a specific, reproducible cause — now closed

**Resolved 2026-09-04.** The line below has been removed from `saveKit`; the brand-kit
editor no longer writes `logo_url` at all. What follows describes the mechanism as it stood
and why the 31 rows look the way they do.

`src/app/dashboard/brands/[id]/page.tsx:296` (former):

```ts
logo_url: logoPrimary || brand.logo_url,
```

`logo_primary_url` is written unconditionally; `logo_url` is written **only when
`logoPrimary` is truthy**, otherwise it silently retains its previous value. So every save
made while the Primary field was empty or cleared leaves `logo_url` pointing at a stale
file while `logo_primary_url` moves on. This is not drift — it is a one-way ratchet, and
it fires on every such save.

Verified live (132 brands):

- both hold the **same** non-null value — **61**
- both **null** — **40** (these make up the brief's "same on 101": 61 + 40)
- both set and **genuinely different** — **31** ✅ matches the brief

Also confirmed: `logo_light_url == logo_primary_url` on **7**; `logo_light_url ==
logo_dark_url` on **5** — both exactly as Pass-0's Class D recorded.

---

## 3. Which column should hold the canonical logo

**Direct answer: none of the eight. The canonical store already exists and is
`brand_logos`, resolved through `resolveBrandLogo()` in `src/lib/brand-logo.ts`.**

That resolver is the only logo code in the repo that models the problem correctly:

- it is **surface-aware** — `LogoSurface = dark | light | brand` maps to
  `LogoVariant = on_white | on_black | on_brand` via `VARIANT_FOR_SURFACE`
- it **refuses to cross the variant boundary** to satisfy a kind preference, with the
  reason stated in-line: *"Stepping outside it to find a preferred kind is what makes a
  logo invisible"*
- it carries `has_alpha`, `ink_hex`, `bg_hex` — the measured facts that the filename
  guessing in `pickLogo()` is a poor substitute for
- it is **already** first choice in `public-site.ts`, `getCoverFlowCampaigns`,
  `getHomepageRotatorCampaigns`, `campaign-readiness-data`, `portal-data`, `clients/[slug]`,
  `campaign/[slug]`, `campaigns/page`, `deals/*`, `dashboard/brand-portals`

A single canonical *column* cannot work, and it is worth being precise about why: the data
genuinely has two independent axes — **ink** (light vs dark) and **kind** (mark vs lockup
vs wordmark). One column can express neither pair. Any "canonical column" answer just
relocates the bug.

**For the legacy columns during the transition**, the coherent reading is:

| Column | Intended meaning | Action |
|---|---|---|
| `logo_light_url` | light ink, for dark grounds | keep — the light half of the pair |
| `logo_dark_url` | dark ink, for light grounds | keep — the dark half of the pair |
| `logo_primary_url` | brand-ground / default lockup | keep as the single default |
| `logo_url` | — | **write-frozen** (done); reconcile the 31 deliberately, then retire — *not* a blind mirror |
| `logo_mark_url` | square/badge mark | keep until `brand_logos.kind='mark'` is filled |
| `logo_white_url` | — | fold into `logo_light_url` (4 rows) |
| `logo_icon_url`, `logo_icon_svg_url` | — | retire (1 row each) |

---

## 4. The grey dashboard tile — file, line, what it does

**File:** `src/app/dashboard/recaps/page.tsx`

**The rule** — lines **506–515**:

```css
.rcp-page .mark img.knockout {
  filter: brightness(0) invert(1) drop-shadow(0 3px 16px rgba(7, 7, 10, 0.75));
}
.rcp-page .emptywell img.knockout {
  filter: brightness(0) invert(1);
  opacity: 0.34;
}
```

`brightness(0)` drives every visible pixel to black **while preserving alpha**; `invert(1)`
then drives them to white. On artwork with a transparent background that is a clean
knockout. On an **opaque** file the "visible pixels" are the whole rectangle — so the
rectangle becomes one solid white plate, which is the block that was reported. It is
applied over a dark card, so it reads as flat grey rather than white.

**Applied at** lines **1654** and **1680**:

```tsx
<img className={isKnockout ? 'knockout' : ''} src={mark} alt={brandName} />
```

**Gated by a hardcoded brand-name allowlist**, line **90**:

```ts
const KNOCKOUT_MARKS = ['UMG'];
```

So UMG was the *only* brand receiving this filter — which is why the symptom looked
UMG-specific rather than like the file-opacity problem it actually was.

**A second, separate grey filter** — lines **792** and **798**, on empty-state cards:

```css
.rcp-page .emptywell img { filter: grayscale(1) brightness(1.9); opacity: 0.4; }
.rcp-page .card.empty-card:hover .emptywell img { filter: grayscale(0.35) brightness(1.4); }
```

This one is deliberate empty-state styling, not a defect, but it is a second independent
source of "the logo looks grey" and will confuse the next person who greps for it.

### 4.1 Live consequence of the UMG fix — needs a decision

`UMG` is **still on `KNOCKOUT_MARKS`**, and `brandMark()` reads `logo_light_url ?? logo_url`.
Once the planner chat points those at `umg-white.svg`, the tile will apply
`brightness(0) invert(1)` to already-white artwork. That is harmless (white → white), but
the allowlist entry is now dead weight and should come off in the same pass that removes
the other 11 brands' entries.

**The real risk is elsewhere.** `pickLogo()` in `campaign-readiness.ts:124`:

```ts
const ambiguousDark = /\.(svg|avif)(\?|$)/.test(f);
return { url, chip: darkInk || ambiguousDark };
```

Any `.svg` is assumed dark-ink and gets a **white chip** behind it. `umg-white.svg` matches
neither `/black|dark|navy|-blk|_blk/` nor anything else that would save it — it is an
`.svg`, so `chip` comes back `true`. **Pointing any `pickLogo()`-reachable column at
`umg-white.svg` puts white artwork on a white chip and makes it invisible.** The columns
`pickLogo()` walks, in order, are `logo_white_url → logo_light_url → logo_primary_url →
logo_url → logo_icon_url → logo_mark_url → logo_dark_url`.

---

## 5. What would have to change to collapse eight columns into a coherent set

**Proposal only — none of this has been implemented.**

1. **Close the `logo_url` ratchet.** `dashboard/brands/[id]/page.tsx:296` becomes an
   unconditional mirror (`logo_url: logoPrimary`) or the column stops being written at all.
   Until this changes, every fix applied to `logo_primary_url` can silently fail to reach
   the surfaces reading `logo_url`. This is the smallest change with the largest effect.
   **Status: DONE 2026-09-04.** `saveKit` no longer writes `logo_url` at all
   (option 2 — freeze rather than mirror, so the 31 diverged values survive).
   The mirror was *not* made unconditional: that would have destroyed one side of
   the divergence on the next unrelated save of those brands.

   **Still open on the same file — `dashboard/brands/[id]/page.tsx:208`:**
   ```ts
   setLogoPrimary(b.logo_primary_url || b.logo_url || null);
   ```
   The form still *seeds* the Primary field from `logo_url` when
   `logo_primary_url` is null, which would copy `logo_url` → `logo_primary_url`
   on save. **Verified 0 rows currently match** (primary null with `logo_url`
   set), so this is **latent, not live** — deliberately left in place. It must be
   resolved in the same reconciliation job, before any backfill creates a row
   that matches it.

2. **Delete the duplicate chains.** Replace all eleven with `resolveBrandLogo()` from
   `brand-logo.ts`, called with the surface each caller actually renders on. In particular
   retire `pickLogo()` ×2 (`campaign-readiness.ts`, `portal/brand-session.ts` — same name,
   different order), `pickBrandLogo()` (`portal.ts`), `pickHeroLogo()` (`packages.ts`),
   `brandMark()` (`dashboard/recaps`), and the inline chains in `portal-data.ts`,
   `invite-token.ts`, `admin/layout.tsx`, `athlete-deals.ts`, `payouts.ts`,
   `athlete-deliverables.ts`.
3. **Rename one of the two `resolveBrandLogo`s.** `lib/brand-logo.ts` (the `brand_logos`
   resolver) and `lib/admin/invite-email.ts` (a legacy-column wrapper) share a name and do
   different things. This is an active trap.
4. **Retire the filename ink heuristic.** `brand_logos.ink_hex` / `has_alpha` are measured;
   `/black|dark|navy|-blk|_blk/` is a guess that the code's own comment admits is wrong
   ("Column names lie"). Chip decisions should read the measured column.
5. **Drop the `KNOCKOUT_MARKS` / `SQUARE_MARKS` allowlists** once `brand_logos` carries
   `kind` and `has_alpha` for those brands — both lists are already documented in-file as
   temporary.
6. **Backfill then retire** `logo_white_url` (4 rows, one ad-hoc script), `logo_icon_url`
   and `logo_icon_svg_url` (1 row each, no writer).
7. **Only then** recompute Pass-0's finding.

---

## 6. Contradictions with the existing audit docs

1. **`logo_white_url` is not vestigial.** The brief lists it as "suspected vestigial" on 4
   rows. It is read by **nine** chains and is **first in priority** in two of them
   (`packages.ts` `pickHeroLogo`, `campaign-readiness.ts` `pickLogo`). For those 4 brands
   it outranks every other column. It is better described as **live, load-bearing, and
   maintained by a single one-brand script** — the most fragile column of the eight.

2. **`logo_dark_url` is read on a dark ground, backwards.** `portal.ts:61` `pickBrandLogo()`
   returns `logo_primary_url || logo_dark_url || logo_light_url || logo_white_url`, and the
   portal renders on `#0d0d11` with `rgba(250,248,245,…)` text (`PortalFrame.tsx:130`,
   `PortalDashboardBody.tsx:250`, `CampaignsBody.tsx:89`). Dark ink is preferred **second**
   on a near-black surface, with light ink third and white last. `portal-data.ts:109` and
   `admin/layout.tsx:35` — both also dark — order it the opposite way (`light → white →
   primary → dark`). Two portal-adjacent files disagree about the same axis.

3. **The same function serves two opposite backgrounds.** `pickBrandLogo()` feeds both the
   dark portal *and* the invite email, where the logo sits on an explicit
   `background:#ffffff` chip (`invite-email.ts:86`). One chain cannot be correct for both;
   it is currently ordered for the white chip, so the portal is the side that loses.

4. **`logo_url` never reached the recap page directly.** The brief says `logo_url` "drove
   the recap page". More precisely: the public recap hero
   (`CampaignRecap.tsx`, the `settings.brand_logo_url` / `client_logo_url` IIFE in the hero — `origin/main` lines 1273–1279) and the PPTX export (`pptx-export.ts:185,817`) read
   **`settings.brand_logo_url || campaign.client_logo_url`** and never touch `brands` at
   all. `logo_url` reaches them only indirectly — `dashboard/[id]/page.tsx:1457` selects
   `logo_url, logo_light_url, logo_dark_url, logo_mark_url` **in that order**, pushes them
   into `logos[]` ahead of the brand-kit storage files, and auto-populates
   `settings.brand_logo_url` from `logos[0]` (line 1493), which is `logo_url`. Once saved,
   that value is **frozen on the recap** and no later brand-row fix will reach it.
   This distinction matters for Pass-0: fixing brand rows does not repair recaps already
   saved.

5. **The audits' four-column frame misses more than `logo_url`.** Of the eight columns,
   the audits cover `logo_primary_url`, `logo_dark_url`, `logo_light_url`, `logo_mark_url`.
   Two of the four *uncovered* columns are read in production paths
   (`logo_url`, `logo_white_url`) and one is read but never written (`logo_icon_url`).
   Any count of "brands that would render wrong" computed over the four is blind to the
   column that is first-in-priority for `pickHeroLogo` and `pickLogo`.

6. **`logo_icon_url` is a category the brief's three buckets don't have.** It is read
   (`campaign-readiness.ts:113`) but has **no writer anywhere in the repo** — the inverse
   of WRITE-ONLY. Its single populated row came from outside this codebase.

---

## 7. `campaign_recaps.client_logo_url` — the per-recap freeze

**Non-null on 2 of 636 campaign recaps** (verified live; the in-code comment at
`api/submission-forms/[token]/route.ts:63` says "2 of 611" — the count is unchanged, the
table has grown).

Read by `CampaignRecap.tsx` (hero fallback, `origin/main` line 1278), `Top50Recap.tsx:428`, `pptx-export.ts:185,817`,
`run-of-show/[slug]/page.tsx:71`, `getCoverFlowCampaigns.ts:142`,
`getHomepageRotatorCampaigns.ts:175` — always as a fallback *behind*
`settings.brand_logo_url` or a `brands` column.

**Assessment:** at 2 rows this column is not the problem it looks like. The far larger
freeze is `campaign_recaps.settings.brand_logo_url`, which takes precedence over it
everywhere, is written on every recap save (`dashboard/[id]/page.tsx:1642,1960`), and is
what the public recap hero and the PPTX deck actually render. **That** is the field that
makes brand-row fixes invisible on existing recaps — and it is out of scope here, but it
should be counted before Pass-0 is re-run.

---

## 8. Scope statement

Read-only. One file written (this one). No edits to any other file, no migration, no DB
write, no branch, no commit, no push. Live database access was limited to `SELECT`/`count`
against `brands` and `campaign_recaps` to verify the numbers above.

`git` was used only to read: `status`, `branch`, `stash list`, `log`, `diff`, and `show`
(the last two to pin the `CampaignRecap.tsx` line numbers in §9). No `git` command in this
audit changed the index, the working tree, any branch, or the remote.

---

## 9. Note on line numbers

`src/components/CampaignRecap.tsx` changed underneath this audit. A 386-line roster
sort/filter addition appeared in the working tree mid-pass, moved again between two reads,
and was then committed as `1239caf feat(recap): sortable + filterable roster headers` on
branch `feat/roster-sort-filter` — which moved `HEAD` as well.

Its citations above are therefore pinned to **`origin/main`** (`client_logo_url` at
1278–1279), which is stable. For reference the same code sits at 1428–1429 at `HEAD`
(`1239caf`). Every other file cited was unmodified throughout, so those line numbers are
accurate against both `origin/main` and the working tree.
