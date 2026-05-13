-- supabase/migrations/20260421_bts_campaign_name_override.sql
--
-- Step 1 of adding a "new campaign" fallback to the BTS submission flow.
-- Before this change, every bts_submission had to reference an existing
-- campaign_recaps row via campaign_id. If a submitter is filming for a
-- brand-new campaign that hasn't been set up in the Hub yet, they had no
-- way to submit. This migration lets the submitter type a free-text
-- campaign name instead, which the admin can later resolve into a real
-- campaign_id.
--
-- Invariants after this migration:
--   - At least one of (campaign_id, campaign_name_override) is non-null
--     on every row (enforced by CHECK bts_submissions_campaign_required).
--   - Queries filtering by "unlinked submissions" can use a partial
--     index on campaign_name_override IS NOT NULL.
--
-- Existing rows: all current rows have a non-null campaign_id and a null
-- campaign_name_override, so the CHECK already holds — no backfill
-- required. Still, we wrap in a transaction so the column add, the
-- constraint, and the index either all land or none do.

BEGIN;

-- 1. New nullable text column, no default.
ALTER TABLE bts_submissions
  ADD COLUMN campaign_name_override text;

-- 2. CHECK: every row must have a real campaign link OR an override name.
ALTER TABLE bts_submissions
  ADD CONSTRAINT bts_submissions_campaign_required
  CHECK (campaign_id IS NOT NULL OR campaign_name_override IS NOT NULL);

-- 3. Partial index so "show me all unlinked submissions" is cheap.
--    Only indexes rows where campaign_name_override is actually set —
--    the vast majority of submissions will have it NULL and stay out
--    of this index entirely.
CREATE INDEX bts_submissions_campaign_name_override_idx
  ON bts_submissions (campaign_name_override)
  WHERE campaign_name_override IS NOT NULL;

COMMIT;
