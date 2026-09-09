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

## Flagged, not changed

This campaign has **one** athlete row whose `ig_reel.views` is an exact
multiple of 100,000 — the same shape as the eight corrected on The Tournament.
The instruction was scoped to The Tournament's eight, so it was left alone
rather than swept in. Migration 047's guard already keeps it out of Top posts.
