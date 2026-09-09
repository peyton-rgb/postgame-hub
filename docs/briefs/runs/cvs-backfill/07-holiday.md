# Holiday — `holiday-cvs-2025`

Tracker tab: none in the 2026 sheet — the brief points at the 2025 master tracker

## Filled

| field | before | after | source |
|---|---|---|---|
| `settings.quarter` | `""` | `Q4 2025` | `admin_created_on` |
| `lifecycle_status` | `closed` | `delivered` | readiness `ready = true` |
| `recap_readiness` | no rows | 1 row, `ready = true` | 7 Drive files, 43 media rows |

## Not filled, and why

| field | state | reason |
|---|---|---|
| `kpi_targets` | `{}` empty | no tab in the 2026 tracker at all. Nothing to source it from, and the brief forbids inventing metrics |
| `athletes.metrics` / `post_url` | unchanged | same: no metric values in the tab |
| `description` | 302 chars | already populated — additive-only run, not overwritten |
| `key_takeaways` | **empty** | still empty: no source. The 2026 sheet has no Holiday tab, and nothing in the campaign's own record supplies takeaways. Left null for Peyton to write rather than invented. |
| `media_campaigns` | 0 links | not created: nothing in the app reads that table; media is already owned via `media.campaign_id` (43 rows) |

Public recap `/recap/holiday-cvs-2025` verified 200 after the change.
