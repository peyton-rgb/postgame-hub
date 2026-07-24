# board_tasks — legacy status recovery key

**Snapshot:** 2026-07-24, read from the live `board_tasks` table during the pre-launch
inventory pass — **before** the `/board` drag-reindex rewrote each row's `status` to the
canonical 5-column slugs.

## Why this file exists
Taking `/board` live introduced a canonical 5-column status model
(`to_do` / `in_progress` / `waiting_on_me` / `blocked` / `done`). The first drag persisted
those slugs to every row, overwriting the older free-form labels and renumbering
`sort_order`. Column membership and relative order were unchanged, but the finer sub-labels
(e.g. `PR-ready` vs `ready` vs `housekeeping`) have no slot in the 5-column model. This file
is the authoritative record of each row's original label so nothing is lost.

## Verification
The per-row labels below reconcile exactly with the independent aggregate counts observed at
first read: 10 `ready`, 4 `scoped`, 2 `spec-ready`, 1 `PR-ready`, 2 `housekeeping`,
3 `in-progress`, 2 `waiting-on-you`, 1 `needs-design-pick`, 3 `blocked` = **28**.

## Per-row original status (pre-migration)

| # | Task | Original `status` | `priority` | → Column now |
|---|------|-------------------|------------|--------------|
| 1 | Inspo Approve/Reject triage UI | `ready` | high | To Do |
| 2 | /board task-manager page | `in-progress` | high | In Progress |
| 3 | HEIC → JPG fix (black-tile bug) | `ready` | high | To Do |
| 4 | Postgame employee curated Hub view | `spec-ready` | high | To Do |
| 5 | Full brand portal integration | `spec-ready` | high | To Do |
| 6 | 100 t-shirt back-graphic options (Fanatics Fest) | `ready` | high | To Do |
| 7 | ProVisual 85 shirt mockup renders | `blocked` | high | Blocked |
| 8 | Instagram Reels weekly loop | `ready` | high | To Do |
| 9 | Slack #campaign-recaps → Hub auto-draft recaps | `PR-ready` | high | To Do |
| 10 | Homepage hydration bug | `ready` | low | To Do |
| 11 | Lyria 3 music generation | `scoped` | low | To Do |
| 12 | Repo-copy consolidation | `housekeeping` | low | To Do |
| 13 | Clear 3 orphaned agent_runs rows | `housekeeping` | low | To Do |
| 14 | Media Library per-file delete button | `ready` | normal | To Do |
| 15 | Fly.io FFmpeg poster worker | `scoped` | normal | To Do |
| 16 | Videographer signup portal | `needs-design-pick` | normal | Waiting on Me |
| 17 | Apparel management system | `waiting-on-you` | normal | Waiting on Me |
| 18 | Events / experiential feature | `scoped` | normal | To Do |
| 19 | Adidas promo-code email monitor | `scoped` | normal | To Do |
| 20 | MLB draft tool watchlist fix | `blocked` | normal | Blocked |
| 21 | Videographer data migration 2nd pass | `blocked` | normal | Blocked |
| 22 | Red Bull tailgate image pipeline | `ready` | normal | To Do |
| 23 | adidas HUSTLE20 Story graphics | `in-progress` | normal | In Progress |
| 24 | Canes BTS video edit (DaVinci) | `in-progress` | normal | In Progress |
| 25 | 30 new videographer signup-page concepts | `ready` | normal | To Do |
| 26 | Greensleeve videographer vetting sheet | `ready` | normal | To Do |
| 27 | Instagram account cleanup execution | `ready` | normal | To Do |
| 28 | Push intake fix + embed 453 inspo assets | `waiting-on-you` | urgent | Waiting on Me |

## Aggregate (cross-check)

| legacy status | count | → column |
|---|---|---|
| `ready` | 10 | To Do |
| `scoped` | 4 | To Do |
| `spec-ready` | 2 | To Do |
| `PR-ready` | 1 | To Do |
| `housekeeping` | 2 | To Do |
| `in-progress` | 3 | In Progress |
| `waiting-on-you` | 2 | Waiting on Me |
| `needs-design-pick` | 1 | Waiting on Me |
| `blocked` | 3 | Blocked |
| **total** | **28** | |

_Note: `sort_order` was renumbered on reindex; original numeric order is not restorable from
this file, but the visible column order was unchanged._
