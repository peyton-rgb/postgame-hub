# Minute Clinic — `minute-clinic-cvs`

Tracker tab: Minute Clinic (gid 1452875744)

## Filled

| field | before | after | source |
|---|---|---|---|
| `settings.quarter` | `""` | `Q1 2026` | `admin_created_on` |
| `lifecycle_status` | `closed` | `delivered` | readiness `ready = true` |
| `recap_readiness` | no rows | 1 row, `ready = true` | 12 Drive files, 23 media rows |

## Not filled, and why

| field | state | reason |
|---|---|---|
| `kpi_targets` | `{}` empty | 24 metric columns, 0 filled across 14 rows. Nothing to source it from, and the brief forbids inventing metrics |
| `athletes.metrics` / `post_url` | unchanged | same: no metric values in the tab |
| `description` | 465 chars | already populated — additive-only run, not overwritten |
| `key_takeaways` | 736 chars | already populated — not overwritten |
| `media_campaigns` | 0 links | not created: nothing in the app reads that table; media is already owned via `media.campaign_id` (23 rows) |

Public recap `/recap/minute-clinic-cvs` verified 200 after the change.

## Aggregate value — nulled

This campaign had **one** athlete row whose `ig_reel.views` was an exact
multiple of 100,000, the same shape as the eight corrected on The Tournament.
Flagged on the first pass because the instruction was scoped to The
Tournament; nulled on Peyton's follow-up, the same way.

| athlete | school | followers | ig_reel.views (removed) |
|---|---|---|---|
| Kamau Freeman | Georgia State University | 23,635 | 2,000,000 |

Value recorded here before the write so it is recoverable. `post_url`
preserved, verified in the `returning` clause. No total reach recorded: the
Minute Clinic tab has no totals row and 0 filled metric cells, so there was
nothing to match the figure against.

After this, CVS has **0** athlete rows left with an aggregate-shaped
`ig_reel.views`.
