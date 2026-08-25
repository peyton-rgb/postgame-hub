# Thumbnail resolution and `score_composition` — hypothesis refuted

**Date:** 2026-08-25
**Status:** Tested, refuted, no code change made.
**Related:** #214 (scoring fixed), #215 (re-score script)

---

## The hypothesis

`score_composition` barely discriminates: 62/100 on 29 of 62 files, only 14
distinct values across the set. Travis Vaughn returned 1 distinct composition
value across 4 files; Madison Hill 2 across 12.

The suspicion was resolution. The scorer reads `drive_thumbnail_url`, which
carries `&sz=w400`. A 400px render arguably cannot carry what composition is
about — subject placement, negative space, horizon, headroom — so the model
returns a safe mid-value.

**Result: refuted.** Composition stayed pinned at 1600px. Resolution is not the
constraint.

---

## Drive does serve the larger render

Checked first, because a silently-capped image would have produced a null result
that looked like a real one.

| `sz` | dimensions | bytes |
|---|---|---|
| `w400` | 400 x 225 | 111 KB |
| `w1600` | 1600 x 900 | 1,261 KB |

4x linear, ~11x bytes. The experiment was testing something real.

---

## The eight test files could not answer the question

The eight `test_upload` files were re-scored at `w400` and at `w1600` through
the real route.

| File | w400 (control re-run) | w1600 | what it is |
|---|---|---|---|
| `Peyton_Jula_01.png` | 12.25 (c=20) | 8.00 (c=15) | cluttered screenshot |
| `Peyton_Jula_02.png` | 12.25 (c=20) | 8.00 (c=20) | cluttered screenshot |
| `Peyton_Jula_03.png` | 15.85 (c=15) | 16.00 (c=20) | cluttered screenshot |
| `Peyton_Jula_04.png` | 0.00 (c=0) | 0.00 (c=0) | blank white image |
| `Peyton_Jula_05.png` | 42.00 (c=60) | 44.00 (c=60) | mid |
| `Peyton_Jula_06.mp4` | 73.25 (c=68) | 70.50 (c=62) | video, hook null |
| `Peyton_Jula_07.png` | 84.25 (c=82) | 87.55 (c=88) | real vertical shot |
| `Peyton_Jula_08.png` | 82.50 (c=82) | 85.10 (c=88) | real vertical shot |
| | **6 distinct c** | **6 distinct c** | |

The ends held — blank stayed 0, good shots stayed low-80s and rose slightly. But
**the distinct-value count did not move**, and more importantly the test set
never exhibited the symptom in the first place: at `w400` it already produced
six distinct composition values and never once returned 62.

That is the flaw in using these eight as the control. They span blank / bad /
mid / good, which is exactly what makes them a good range test and a bad probe
for *this* hypothesis. The pinning appears on client files, which are
tonally similar to each other — same athletes, same shoot setups. A test set
chosen for its spread cannot demonstrate a clustering effect.

---

## The files that actually pinned, measured read-only

Travis Vaughn (4) and Madison Hill (12) — the two most pinned athletes, 16 files.
Measured **without writing to the database**, using logic extracted verbatim from
`route.ts` so the prompt could not drift.

| | distinct composition | 62-count | input tokens/image |
|---|---|---|---|
| `w400` | **4 / 16** (55, 58, 62, 65) | 11 / 16 | 696 |
| `w1600` | **4 / 16** (45, 55, 58, 62) | 8 / 16 | 4,555 |

Identical discrimination at 6.5x the input-token cost. The values shift around,
but the number of distinct values is unchanged and 62 remains dominant.

### The decisive control

Re-scoring the same files at the *same* resolution moves composition about as
much as changing the resolution does. At `w400`, stored values of 62 came back
as 55, 58, 62 and 65 on a fresh run; `Madison_Hill_03.jpeg` moved 62 -> 55 with
no input change at all.

**Run-to-run variance is comparable to the between-resolution difference.** That
is what makes this a refutation rather than a weak positive: the resolution
signal, if any, does not rise above the model's own noise floor on this task.

---

## What this means

Composition clustering is not a resolution problem. The remaining candidates —
**not investigated here, and deliberately not tuned** — are:

- the prompt's composition wording, which may be too abstract to anchor a number
- the 0.20 weighting, which lets a pinned dimension flatten the composite
- the model's genuine ceiling at judging composition from a single still

Worth knowing: because composition is pinned, the other sub-scores vary
*compensatorily* around it, so the composite hides variation that is plainly
visible one level down. Travis Vaughn's four files sit within 0.88 composite
points while his lighting ranges 58-75 and subject 55-78. **Any review UI that
sorts by composite alone inherits that flattening** — sub-scores are the more
honest signal today.

---

## Cost, for the record

`w1600` costs ~6.5x the input tokens (696 -> 4,555 per image). Across 62 files
that is roughly 43K -> 282K input tokens; at Sonnet 5 rates the difference is
cents, not dollars. Cost was never the reason not to do this — the reason is
that it does not work.

---

## Side findings

**A blank image can return no text block.** During the restore run,
`Peyton_Jula_04.png` (blank white) came back with no text content and was
correctly recorded as `status='scoring_failed'`, `scoring_error='model returned
no text block'`, all scores null. It scored 0 on retry. Intermittent, and the
#214 failure handling caught it exactly as designed — but a retry for this case
would be reasonable.

**`matchAthlete()` matches on filename, and filenames are not unique.**
`route.ts:164` passes `submission.file_name` to `matchAthlete()`. Madison Hill
submitted twice and uploaded `Madison_Hill_02.jpeg` both times — distinct
`drive_file_id`s, identical names. All 62 rows do have distinct file ids, so
nothing is currently mis-attributed, but the matcher keys on the one field that
is not unique. Catalogued, not fixed.

**The stale-generated-types theory was wrong.** `src/types/supabase.ts` and
`src/lib/database.types.ts` are byte-identical and have **zero importers**, and
every Supabase client is built with a bare `createClient(...)` and no `Database`
generic — so no query anywhere in the codebase is schema-checked. Regenerating
them would change nothing. The `GenericStringError` seen in the re-score script
comes from supabase-js parsing a select string on an untyped client, and the
same class of error already exists in `admin/access/page.tsx`. Threading the
generic through the client factories is the real fix; the code comment at
`src/lib/supabase-server.ts:108` puts one factory at 112 call sites, so that is
its own job.

**The `tsc` baseline never moved.** It is **227 errors**, at `405b284`,
`47c0f1d`, `23b0df6` and `caef388` alike — the merges added none. The "227 ->
268" in the brief traces to my own reporting: earlier PRs counted raw `tsc`
output lines (268), which include the indented continuation lines of multi-line
errors, rather than lines matching `error TS` (227). The error-set diffs in
those PRs were computed consistently before and after, so their "zero
introduced" conclusions still hold — only the headline number was mislabelled.
**227 is the baseline.**
