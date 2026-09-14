# CVS recap backfill — method and findings

Brief: `docs/briefs/04-cvs-recap-backfill-brief.md`. Run 2026-09-09 against
`xqaybwhpgxillpbbqtks`. Changes are DATA, applied with `execute_sql` (not
`apply_migration`, which is for DDL). This directory is the audit trail: one
file per campaign recording exactly what was written and what the source
material did not contain.

## Three preconditions in the brief no longer held

**1. The recap fields were not empty.** The brief says these eight sit "with
empty recap fields", verified 2026-09-08. By the time this ran, every one had
a description (273-609 chars) and six of eight had key_takeaways (228-738).
Someone filled them in between. Per Peyton's instruction this run is ADDITIVE
ONLY: nothing that already had content was overwritten, and every write is
guarded (`where coalesce(settings->>'quarter','') = ''`).

**2. The brief's SQL now returns ten campaigns, not eight.** `26 Spring Epic
Beauty` and `CVS '26 Q1` have since become `closed`. Both were left untouched;
this run works from the eight NAMES.

**3. There is no "Data fixes" section in the brief.** The eight aggregate
values were identified independently: athlete rows on The Tournament whose
`ig_reel.views` is an exact multiple of 100,000, which is what migration 047
already guards out of Top posts.

## What the trackers actually contain

The "2026 Master CVS Tracker" tabs are ROSTERS, not filled-in performance
trackers. Across the six 2026 tabs there are **2 populated metric cells in
total**:

| tab | rows | metric columns | filled metric cells |
|---|---|---|---|
| SPF | 135 | 24 | 0 |
| College World Series | 19 | 24 | 2 |
| Chicago | 60 | 1 | 0 |
| Mother's Day | 123 | 1 | 0 |
| Minute Clinic | 14 | 24 | 0 |
| Ronald Mcdonald House | 10 | 1 | 0 |
| March Madness | 33 | (see below) | 0 |

On the March Madness tab the columns are also misaligned against their own
header: `IG Reel Views` (col 24) contains `Texas Tech`, and everything from
there is identity data shifted right. No tab contains a campaign total.

**Consequence:** step 2 of the brief (tracker metrics into `athletes.metrics`
and `athletes.post_url`) yields nothing for any of the eight, and
`kpi_targets` could not be sourced from the tracker for the seven that have it
empty. Writing anything into those fields would have been invention, which the
brief forbids.

## Two things found in the schema that change how this must be done

**`lifecycle_status` is derived by a trigger.** `trg_recap_lifecycle_status`
is `BEFORE INSERT OR UPDATE **OF published, admin_is_active**` and runs:

```
new.lifecycle_status := case
  when new.published = true        then 'closed'
  when new.admin_is_active = true  then 'active'
  when new.admin_is_active = false then 'delivered' end;
```

All eight are `published = true`, which is *why* they were `closed`. Because
the trigger only fires on those two columns, an UPDATE that sets
`lifecycle_status` alone does persist — verified in a rolled-back transaction.
That is the path used here.

**It is fragile, and this is the follow-up worth taking.** The next time
anyone touches `published` or `admin_is_active` on one of these rows — an
unpublish/republish from the admin — the trigger recomputes and snaps it back
to `closed`. The durable fix is to change the trigger's mapping so a published,
inactive recap is `delivered` rather than `closed`. Not done here: it changes
behaviour for all 636 recaps and belongs in its own change.

**`media_campaigns` links were NOT created.** The brief's step 1 says to link
through `media_campaigns`. Nothing in the application reads that table: the
public recap renderer (`app/recap/[slug]/page.tsx`) selects `media` by
`campaign_id`, and `PortalDashboardBody` carries a comment saying the join
table "is only partially populated" and avoids it. All seven already have
their media owned via `media.campaign_id` (16-89 rows each), which is the link
every renderer actually uses. Writing ~300 curation rows nothing consumes
would have been noise — CLAUDE.md is explicit that `media_campaigns` means
placement, not ownership.

## Safety checks run before writing

- Snapshot of every row before each write, and a `returning` clause after.
- `sync_recap_publish_state` recomputes `published` from `status` on ANY
  update, so a settings write could have silently unpublished a live recap.
  Confirmed all eight have `status = 'published'` first.
- After: only the two campaigns not on the list remain `closed`; CVS delivered
  went 36 to 44; all eight `/recap/[slug]` pages still return 200.
