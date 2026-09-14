# SPF — `spf-cvs-2026`

Tracker tab: SPF (gid 1389657349)

## Filled

| field | before | after | source |
|---|---|---|---|
| `settings.quarter` | `""` | `Q2 2026` | `admin_created_on` |
| `lifecycle_status` | `closed` | `delivered` | readiness `ready = true` |
| `recap_readiness` | no rows | 1 row, `ready = true` | 8 Drive files, 89 media rows |

## Not filled, and why

| field | state | reason |
|---|---|---|
| `kpi_targets` | `{}` empty | 24 metric columns, 0 filled across 135 rows. Nothing to source it from, and the brief forbids inventing metrics |
| `athletes.metrics` / `post_url` | unchanged | same: no metric values in the tab |
| `description` | 462 chars | already populated — additive-only run, not overwritten |
| `key_takeaways` | 338 chars | already populated — not overwritten |
| `media_campaigns` | 0 links | not created: nothing in the app reads that table; media is already owned via `media.campaign_id` (89 rows) |

Public recap `/recap/spf-cvs-2026` verified 200 after the change.
