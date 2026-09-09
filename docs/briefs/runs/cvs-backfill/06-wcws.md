# W/CWS — `wcws-cvs`

Tracker tab: College World Series (gid 983669871)

## Filled

| field | before | after | source |
|---|---|---|---|
| `settings.quarter` | `""` | `Q2 2026` | `admin_created_on` |
| `lifecycle_status` | `closed` | `delivered` | readiness `ready = true` |
| `recap_readiness` | no rows | 1 row, `ready = true` | 11 Drive files, 49 media rows |

## Not filled, and why

| field | state | reason |
|---|---|---|
| `kpi_targets` | `{}` empty | 24 metric columns, only 2 filled metric cells across 19 rows — too sparse to source a KPI from. Nothing to source it from, and the brief forbids inventing metrics |
| `athletes.metrics` / `post_url` | unchanged | same: no metric values in the tab |
| `description` | 436 chars | already populated — additive-only run, not overwritten |
| `key_takeaways` | 228 chars | already populated — not overwritten |
| `media_campaigns` | 0 links | not created: nothing in the app reads that table; media is already owned via `media.campaign_id` (49 rows) |

Public recap `/recap/wcws-cvs` verified 200 after the change.
