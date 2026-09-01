# BRIEF — Brand auto-create + Drive brand-root resolution

**For:** Claude Code · **Written:** 1 Sep 2026 · planner chat
**Repo:** `~/Postgame/hub` · **DB:** Supabase `xqaybwhpgxillpbbqtks`
**Branch note:** the iMac working copy was on `gemini-search-embedding` @ `e5c76d5` when this
was written. Branch from `main`, not from that.

---

## 1 · The incident this fixes

1 Sep 2026, Burger King. Sales created `Burger King/` and `Burger King/2026/` in Drive.
Rich's admin created campaign 1015 ("Fall 2026 - NIL"). The Hub synced the campaign at
06:45 ET. The campaign folder and its Content/Contracts subfolders were never built.

Verified from `agent_runs`, not inferred:

| Time (ET) | Job | Result |
|---|---|---|
| 06:45 | campaign sync | inserted 9, including admin_campaign_id `1015` ✅ |
| 07:15 | `admin-account-brand-map` | `auto_linked: 0`, `needs_human: 1` → **Burger King, account 131** |
| 07:31 | `drive-folder-provision` | 9 candidates, 5 provisioned, 4 skipped. BK skipped: `no_brand_id` |

The skip detail, verbatim from the run report:

> `"campaign has no brand_id — the CF admin sync leaves it null"`

**There is no `brands` row for Burger King anywhere** (`ILIKE '%burger%'` and `'%king%'` both
return zero). So the chain died two links before Drive was ever touched.

The Drive side is unambiguous and would have resolved cleanly:
- client root `1z0szyZYdD2CGd9zAeRTO8MM-ArQAgz-a` — holds every brand folder (`adidas` and
  `Burger King` are siblings in it)
- exactly **one** folder named `Burger King` → `1uZ2QUb3GZOk-wuMQJup9abIa5I-l3RW5`
- exactly **one** child, named `2026` → `1Tqar5JSNZbkSpgRyPQpJj1hMgUg6qcbB`

---

## 2 · Read these before writing anything

Both carry design decisions in their header comments that this brief deliberately preserves.
Do not treat them as obstacles to route around.

- `src/lib/account-brand-map.ts` — **"Fuzzy matching is banned outright"**, with the live
  counter-examples. That ban stays.
- `src/lib/drive-provision.ts` — creation-only, idempotent, adopt-before-create, and
  "more than one candidate at any level is a human decision, never a guess." Same.
- `src/app/api/sync/admin-accounts/route.ts` — says three times that it never creates a brand.
  **This brief changes that one statement.** Update the header comment to match the new rule;
  do not leave a comment that contradicts the code.
- `src/app/api/sync/drive-folders/route.ts` — already has an unused `no_brand_root` skip reason.

---

## 3 · What is already built (do not rebuild)

| Capability | Where | State |
|---|---|---|
| Fetch accounts from admin API | `getAccounts()` → `/accounts` | ✅ pulls all 120 every run |
| Account → brand translation table | `admin_account_map` | ✅ |
| Exact-name auto-link | `exactBrandFor()` | ✅ |
| Stamp `brand_id` onto campaigns | pass 3 of admin-accounts route | ✅ |
| Year-shelf resolution by name | `resolveYearFolder()` | ✅ stored → exact → variant → create |
| Campaign + Content/Contracts/Trackers | `provisionCampaign()` | ✅ |
| Logo variants incl. white knockout | `brand_logos` kind × variant | ✅ `on_black` = white version |

`getAccounts()` returns exactly `{ account_id, account, account_type_id, date_stamp }`.
**There is no website field.** Anything needing a brand's URL is out of scope here — see §8.

---

## 4 · Change 1 — create a brand when, and only when, it is unambiguously new

In `src/app/api/sync/admin-accounts/route.ts`, pass 2.

Today an account either exact-matches one brand (link it) or goes to `needs_human`. Add a
third outcome between them.

### The rule

- **Linking to an existing brand stays exact-only.** `exactBrandFor()` is unchanged. The
  fuzzy ban is intact — a guess still never maps an account onto a brand.
- **Creating** gains one new gate: create only when the account name is not *close* to any
  existing brand name. Similarity is used **as a veto, never as a link**.

```
exact match, exactly one brand   → link                    (unchanged)
exact match, two or more brands  → needs_human             (unchanged)
no exact match, but NEAR one     → needs_human   ← new veto
no exact match, near nothing     → CREATE brand   ← new
```

### `isNearExistingBrand(accountName, brandNames) → boolean`

New pure function in `src/lib/account-brand-map.ts`, exported, unit-tested. True when **any**
holds against **any** brand, all comparisons on `normaliseName()` output:

1. either name contains the other as a substring
2. equal after stripping all non-alphanumerics
3. Levenshtein distance ≤ 2 for names ≥ 8 chars, ≤ 1 for shorter

### It must produce exactly this on live data

These are the real accounts. Bake them into the test file as the fixture.

| Account | Nearest brand | Verdict | Why |
|---|---|---|---|
| `Cane's` | `Raising Cane's` | **veto** | rule 1, substring |
| `McDonalds` | `McDonald's` | **veto** | rule 2, punctuation |
| `Hey Dude` | `Heydude` | **veto** | rule 2, whitespace |
| `Ykone - Visit Las Vegas` | `Visit Las Vegas` | **veto** | rule 1, substring |
| `Dr Scholl's` | `Dr. Scholl's` | **veto** | rule 2 |
| `Burger King` | — | **create** | nothing within reach of 131 brands |

A test that lets any of the first five through is a failing test. This is the whole point of
the change: the exact matcher cannot tell "genuinely new" from "already here, spelled
differently", and auto-create without this veto produces a duplicate Raising Cane's.

### The insert

`brands` requires only `name`. `kit_status` defaults to `'placeholder'` — **use the default,
do not invent a new value**; its CHECK allows only `placeholder | official`, and
`placeholder` already means "kit not sourced yet", which is exactly the queue signal wanted.

```
INSERT INTO brands (name, admin_brand_id)  -- everything else defaults
```

`name` = the account name **verbatim**, trimmed only. No case changes, no punctuation
tidying — same discipline as `folderNameFor()`.

Then set `admin_account_map.brand_id` for that account, with the same
`.is("brand_id", null)` re-check at write time that the existing link path uses.

### ⚠️ Migration required

`admin_account_map_mapped_by_check` currently allows only `'auto_exact' | 'human'`.
A created mapping needs a third value — `'auto_created'` — so the provenance is legible and
these rows can be audited later. **This will fail on insert without a migration first.**
Ship the CHECK change as its own migration, applied before the route change deploys.

### Report shape

Add to the run report, in the existing style:

```
accounts: { total, auto_linked, created, vetoed, needs_human, created_list, vetoed_list }
```

`vetoed_list` carries the account name **and the brand it was near** — that is the queue a
human works from, and "near what" is the useful half.

### `?dry_run=1` must cover this

The existing dry-run computes without writing. It must now also compute what it *would*
create and veto, and still write nothing. Verify by diffing a dry run against the real run.

---

## 5 · Change 2 — resolve the brand root by name

In `src/lib/drive-provision.ts` + `src/app/api/sync/drive-folders/route.ts`.

Today: read `brands.drive_parent_folder_id`, and if null, skip `no_brand_root`. Nothing ever
looks for the folder.

Add `resolveBrandRoot(drive, clientRootId, brandName, storedId)`, modelled directly on
`resolveYearFolder()` — same list-and-compare via `listChildFolders()` + `matchesByName()`,
same refuse-on-ambiguity posture. Reuse those helpers; do not write a second matcher.

```
1. stored brands.drive_parent_folder_id     → use it, never re-resolve   (via: "stored")
2. exactly one child of client root matching brand name (trimmed, case-insensitive)
                                            → adopt, PERSIST the id      (via: "matched")
3. two or more matches                      → skip "ambiguous_brand_root"  ← new reason
4. zero matches                             → skip "brand_root_not_found"  ← new reason
```

**Never create the brand folder.** Sales owns creating it. Zero matches means "sales hasn't
made it yet" — skip, report, and the next cron pass picks it up once they do. That is a
normal state, not an error; keep it out of anything that reads as a failure.

Persisting the adopted id on step 2 is what makes this cheap — the search runs once per
brand, ever, then step 1 short-circuits it forever.

**The client root moves out of the script.** `1z0szyZYdD2CGd9zAeRTO8MM-ArQAgz-a` is currently
hardcoded at `scripts/provision-campaign-folders.ts:34` and the app has never heard of it.
Put it in env as `DRIVE_CLIENT_ROOT_FOLDER_ID`, read it in the route, and have the script read
the same env var. One source of truth. If the var is missing, skip with a clear reason —
do not fall back to a literal.

Add both new reasons to the `SkipReason` union and to `skipped_by_reason` in the report.

---

## 6 · Guardrails

- **No renames, no moves, no deletes, no trashing.** `files.create` stays the only mutating
  Drive call in this module.
- Every Drive call keeps `supportsAllDrives: true`; list calls keep
  `includeItemsFromAllDrives` + `corpora: "allDrives"`. `"user,allDrives"` is a 400.
- `brand_id` on a campaign is still only ever **filled, never changed**.
- A human mapping is still never overwritten by a sync.
- Ambiguity at any level is still a skip with a readable reason, never a guess.
- Do not touch `exactBrandFor()`, `normaliseName()`, `indexBrandsByName()`, `hasYearToken()`,
  or `NEVER_ADOPT_AS_YEAR_FOLDER`.

---

## 7 · Verification — in this order

1. **Unit tests** on `isNearExistingBrand` with the §4 fixture. All six cases correct.
2. **`?dry_run=1` on admin-accounts against live data.** Expect: `created` contains
   Burger King and nothing else; `vetoed_list` is empty (the other five were mapped by a
   human on 31 Aug — the veto is there for the *next* one). Confirm zero writes.
3. **Apply the CHECK migration.**
4. **Real run of admin-accounts.** Verify: one new `brands` row, `admin_account_map` row 131
   linked with `mapped_by='auto_created'`, campaign `9f8c0182-0a4c-4136-b366-e216a5f47404`
   now carries a `brand_id`. Every other brand row untouched — diff the count, 131 → 132.
5. **Real run of drive-folders.** Expect Burger King provisioned, `brandRootVia: "matched"`,
   `yearFolderVia: "exact"` on the existing `2026` folder — **not** `"created"`. If it reports
   `created` for either level, stop: it built a rival folder beside the real one.
6. **Check Drive by eye.** `Burger King/2026/Fall 2026 - NIL/{Content,Contracts,Trackers}`,
   and confirm no second `Burger King` or second `2026` folder was made.
7. **Re-run both immediately.** Idempotency check: second run provisions 0, creates 0,
   changes nothing.
8. Brooks, Crocs and Dove stay skipped throughout — they are separate problems (§8).

---

## 8 · Out of scope

- **Logo and colour sourcing.** Its own brief. Blocked on: the admin has no website field
  (54 of 131 brands have no URL on file), WebFetch strips CSS and refuses `.svg`, and only
  2 of 38 brands publish a stated hex. See `WEB-SOURCING-PASS.md`, `BRAND-KIT-HARVEST-2026-08-22.md`.
  New brands land at `kit_status='placeholder'` and wait there. **Nothing in this brief
  writes a colour or generates artwork.**
- **Brooks / Crocs** — `ambiguous_year_folder`, a human picks the 2026 shelf.
- **Dove** — `File not found: 1xoAyakRgC0sIYi-PJrv7oUdqm1U-2Ik0`. Its stored root points at a
  deleted folder. Fixed by re-pointing the brand, and once §5 ships, clearing that column
  lets the name search re-find it.
- **Deleting a campaign in the CF admin still doesn't delete it in the Hub.** Known, unrelated.

---

## 9 · Files

| File | Change |
|---|---|
| `supabase/migrations/*_mapped_by_auto_created.sql` | new — CHECK allows `auto_created` |
| `src/lib/account-brand-map.ts` | add `isNearExistingBrand`; update header comment |
| `src/app/api/sync/admin-accounts/route.ts` | create path, report fields, header comment |
| `src/lib/drive-provision.ts` | `resolveBrandRoot`, two new `SkipReason`s |
| `src/app/api/sync/drive-folders/route.ts` | call it, persist adopted root, report `brandRootVia` |
| `scripts/provision-campaign-folders.ts` | read the env var instead of the literal |
| tests | `isNearExistingBrand` fixture |

One PR. Stage by explicit filename. Merge from the GitHub PR page after the Vercel preview.
