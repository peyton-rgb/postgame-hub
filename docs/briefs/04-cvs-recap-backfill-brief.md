# Backfill recaps — 8 pre-Hub CVS campaigns

Repo: `peyton-rgb/postgame-hub` · Supabase project: `xqaybwhpgxillpbbqtks`
Independent of the brand-portal build. Can run before or after it.

## Goal
Eight CVS campaigns ran before the recap system existed. They sit in `campaign_recaps` with `lifecycle_status = 'closed'` and empty recap fields. Bring them to the same state as a normally delivered recap so the brand portal can show Results for them.

## The 8 recaps
Select with:
```sql
select cr.* from campaign_recaps cr
join admin_campaigns ac on cr.admin_campaign_id = ac.admin_id::text
where ac.brand = 'CVS' and cr.lifecycle_status = 'closed';
```
Names: Holiday, The Tournament, Ronald McDonald House Boston, Chicago Activation, Minute Clinic, Mother's Day, SPF, W/CWS.

## What's already in place (verified 2026-09-08)
- `drive_content_folder_id` is set on all 8 (linked today; the folders are inside `CVS 2026 / Athlete Content 2026`, except Holiday which is under `2025 / Holiday`).
- `tracker_sheet_id` / `tracker_url` is set on all 8. All point at one sheet, "2026 Master CVS Tracker (Internal All Campaigns)", with one tab per campaign. Tab names differ from recap names — map them:
  - Holiday → check the 2025 master tracker (`2025 Master CVS Tracker (Internal All Campaigns)` in the CVS parent folder); the 2026 sheet has no Holiday tab
  - The Tournament → tab `March Madness`
  - Ronald McDonald House Boston → tab `Ronald Mcdonald House`
  - Chicago Activation → tab `Chicago`
  - Minute Clinic → tab `Minute Clinic`
  - Mother's Day → tab `Mothers Day`
  - SPF → tab `SPF`
  - W/CWS → tab `College World Series`
- Athlete rosters already exist in `athletes` (`campaign_id = recap id`), 4–132 per campaign.
- Media: The Tournament already has 64 rows linked via `media_campaigns`. The other 7 have none.
- `recap_readiness` has never run for these (the cron only checks `delivered`).

## Steps — run for The Tournament first, verify, then the other 7
1. **Media ingest** — run the existing Drive media ingest against `drive_content_folder_id`, linking rows through `media_campaigns` (`campaign_recap_id`) and `media_athletes` where the athlete can be identified from filename or subfolder. Reuse the existing ingest code path; do not write a new one. Skip files already present (match on `drive_file_id`).
2. **Tracker metrics** — read the campaign's tab. Tab layouts vary (some are per-athlete rows with post columns, some are per-post-type summary blocks). Extract per-athlete post URLs, follower counts, and impressions/reach where present, into `athletes.metrics` (jsonb) and `athletes.post_url`. Follow whatever mapping the existing tracker-sync code uses; if none exists for a layout, write a small adapter per layout and log which rows couldn't be parsed rather than guessing.
3. **Recap fields** — populate `settings` on each recap with the same keys a normally built recap has: `description`, `key_takeaways`, `kpi_targets`, `platform`, `campaign_type`, `content_type`, `quarter`. Use the brief (where `brief_url` is set) and the tracker for facts. **Do not invent metrics, quotes, or takeaways.** If a field can't be filled from source material, leave it null and list it in the report for Peyton to fill in.
4. **Public sections** — set `public_sections` to the same defaults as a normal recap.
5. **Readiness** — run the readiness check for each recap. Only if `ready = true`, set `lifecycle_status = 'delivered'`. If a trigger normally drives `lifecycle_status`, use whatever path that trigger expects rather than a raw update.
6. **Report back** — one table: recap name, media ingested, athletes with metrics / total, fields filled / fields left null, readiness result, final status.

## Hard rules
- Never write to `budget` fields.
- No NCAA trademark terms in any brand-facing field (`description`, `key_takeaways`, `name`). "The Tournament" is the correct name; the tracker tab and Drive folder names are internal and fine to read from.
- No fabricated content. A null with a note beats a plausible guess.
- Log every AI call through the existing cost logging (`agent_runs`), respecting `agent_budgets`.
- Run on a branch; open a PR with the report in the description.
