# Content Review Pipeline — Phase 1 & 2 Addendum

**Companion to** `claude_CONTENT-REVIEW-PIPELINE-SPEC.md`. Where the two
disagree, **this file is correct** — the spec describes what was planned, this
records what shipped.

> The companion spec is **not in this repository** — it is not git-tracked and
> does not exist anywhere under `~/postgame`. It lives outside version control
> (Cowork). The precedence rule above still applies wherever you are reading it.

Date: 2026-08-24 · PRs #196–#201, all merged · Supabase `xqaybwhpgxillpbbqtks`

---

## What shipped

| PR | What | Merged (UTC) |
|---|---|---|
| #196 | `in_edit` + `brand_review` statuses; `slot_index` surfaced; catalogue of hardcoded status checks | 17:19 |
| #197 | Repair pass — 4 sites fixed (slot-uniqueness + status guards) | 17:50 |
| #198 | Auth regression fix — ownership scoping on both upload resolution paths | 18:23 |
| #199 | Version rows on upload via `add_deliverable_version()` | 18:39 |
| #200 | Multi-instance aware clients; component state collision fixes | 18:53 |
| #201 | Multi-slot creation in `ensureDeliverables()` | 19:12 |

**Migrations applied:** `content_review_pipeline_phase_1`,
`add_deliverable_version_function`.

**Production state at close:** 4 deliverables (all `slot_index = 1`),
2 `deliverable_versions` rows (both `source='backfill'`, backdated to the
original 2026-06-17 upload times), 0 rows in `review_sessions`,
`review_comments`, `edit_jobs`, `edit_steps`, `edit_suggestions`.

---

## Corrections to the spec

### `add_deliverable_version()` — new, not in the original spec

Appending versions from application code lets two concurrent uploads both read
v1 and both attempt v2. The unique constraint rejects the loser — loud, not
corrupting — but that is still a failed upload for a real athlete.

The function locks the parent deliverable, computes `max + 1`, inserts, and
repoints `file_url` / `thumbnail_url` / `media_type` / `uploaded_at`. Atomic.

```sql
add_deliverable_version(
  p_deliverable_id uuid, p_file_url text, p_media_type text,
  p_thumbnail_url text default null, p_drive_file_id text default null,
  p_source text default 'athlete', p_created_by uuid default null
) returns deliverable_versions
```

**Deliberately does not set `status` or `is_final`.** Transitions belong to the
caller; `is_final` is Phase 5, on brand approval only.

`source` values the code can write: `'athlete'` (athlete upload) and `'import'`
(videographer). `'edit'` is reserved for Phase 3. **The only value present on any
production row today is `'backfill'`** — nothing has been uploaded since #199
shipped, so the athlete and import paths are proven in the clean room but not yet
exercised in production.

### Statuses needed no migration

`athlete_deliverables.status` is plain `text` with **no CHECK constraint**. The
two new values were a TypeScript-only change.

### `uploaded_at` changed meaning

Now `coalesce(uploaded_at, now())` — **first** upload time, not most recent.
This makes it consistent with its siblings (`approved_at`, `posted_at`,
`verified_at`, `paid_at`), which are all stage-entry timestamps. Per-version
timing is preserved on `deliverable_versions.created_at`.

### Videographer sends `slotIndex`, athlete sends `deliverableId`

The rule was "prefer `deliverableId` everywhere." `/api/v/register` is a
**public endpoint**, and accepting a client-supplied row id there adds a
client-controlled identifier to a public surface. Since its `optin_id` comes
from the validated token, `(optin_id, slot, slot_index)` is already the unique
constraint — identical guarantee, less surface.

### Multi-slot numbering is set-based, not count-based

The spec said number from `existing_count + 1`. Shipped code fills **missing
indexes** instead.

Identical for any data this code produces (indexes are always contiguous). They
diverge only if a gap appeared: count-based numbering would target an existing
index, hit `23505`, and because that error is deliberately swallowed, **silently
create nothing while the gap persisted permanently.**

### Supabase preview branches do NOT replay migrations

Earlier briefs claimed they do. **They do not.** A preview branch comes up
empty — no tables, no functions, not even the migration tracking table.
`FUNCTIONS_DEPLOYED` refers to edge function deployment.

**Working pattern:** build schema and functions on the branch verbatim from
production's live `information_schema` and `pg_get_functiondef`, so you test the
deployed objects rather than a reimplementation. To exercise real application
code against it, point the env vars `createServiceSupabase()` reads
(`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) at the branch and
import the function from `src/lib`. Delete the branch when done — it bills while
it exists (~$0.013/hour).

---

## Method lessons

**Search by shape, not by value.** This cost three findings:

1. Grepping status literals (`in_review`, `changes_requested`) missed
   `post-link`'s allowlist, which hardcodes status without naming those values.
2. It also missed both slot-uniqueness bugs entirely — a different bug class the
   net was never going to catch.
3. Grepping React render keys (`key={d.slot}`) found nothing; the real
   collisions were in component **state** (`busySlot`, `doneSlots`), one layer
   below where the greps pointed.

Better nets: `.eq("slot"`, `maybeSingle()`, `.in("status"`, `includes(.*status`.

**A unique constraint is a promise the application is built on.** Dropping
`UNIQUE (optin_id, slot)` was verified safe against the *data* (4 rows) and not
against the *code*. Two callers encoded that promise as `.maybeSingle()` and an
unbounded `.update()`. Audit callers, not just rows.

**Prove the test reproduces the bug first.** Every clean-room harness
demonstrated the defect under the old code before showing it fixed. A suite that
passes against broken code proves nothing.

**`getMyDeals()` calls `ensureDeliverables()`.** Any "read-only" production check
through that path executes creation logic against live data. The check and the
risk are the same action.

---

## Known gaps

- **Concurrency on `add_deliverable_version()` is evidence, not proof.** Five
  simultaneous calls produced `[1,2,3,4,5]` with zero rejections; that the
  transactions genuinely overlapped inside Postgres was not demonstrable from
  the client.
- **`ensureDeliverables()` insert path** was never executed against production
  (all test rows pre-existed). Covered by the column default.
- **No UI sets `required_deliverables`.** Multi-slot works, but campaigns are
  configured elsewhere — nothing in the Hub currently produces a
  `["reel","reel"]` array.
- **`post-link` allowlist** is correct by design now (commented), but remains a
  hardcoded list.

---

## Remaining phases

**Phase 3 — Internal review.** Turn on `review_sessions` / `review_comments`
against real deliverables. Timecoded comments, internal comment layer. Tables
are built and cold; `deliverable_id` / `deliverable_version_id` / `asset_url`
columns were added in Phase 1 and are unused.

**Phase 4 — Brand review.** Portal Review tab (the one cold surface in an
otherwise live portal). `brand_decision` writes; send-back compiles comments
into `review_note`.

**Phase 5 — FINAL + Drive.** `is_final` on brand approval triggers the rename and
`FINALS/` copy. Copy, never move. System-written, never typed.
Naming: `{First} {Last} - {Campaign} - {Brand} - {slot}-{index} - {version}.{ext}`
Also update `extractAthleteNameFromFilename()` — it lives at
`src/lib/google-drive.ts:65` and is consumed by the Drive import matcher at
`src/lib/google-drive.ts:237`. Same commit, or import matching breaks.

**Phase 6 — One real campaign end to end** before scaling.

### Still open from the original spec

- **The three campaign tables** — `campaign_recaps` (media), `brand_campaigns`
  (review_sessions), `optin_campaigns` (deliverables). No shared key. Deferred
  deliberately; needs its own session.
- `review_sessions.campaign_id` still points at `brand_campaigns` — confirmed
  still `FOREIGN KEY (campaign_id) REFERENCES brand_campaigns(id) ON DELETE
  CASCADE`. Reachable via `deliverable_id` now, so it no longer blocks — but it
  is still wrong.
- Who at Postgame may send to brand (permission check, Phase 4)
- Whether athletes see edit history (recommendation: v1 and FINAL only)
- Send-back round cap (`revision_round` exists to support one)
