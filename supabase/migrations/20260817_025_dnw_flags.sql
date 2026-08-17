-- Migration 4/6 · do-not-work-with flag on people (network-wide, identity level)
-- Purpose: locked ruling — any staff can set (reason required), admin+ removes,
--          all logged; excludes from sourcing, blocks roster adds.
--          Verified 17 Aug: no dnw columns on people.
-- Rollback: ALTER TABLE people DROP COLUMN dnw_flag, DROP COLUMN dnw_reason,
--           DROP COLUMN dnw_category, DROP COLUMN dnw_set_by, DROP COLUMN dnw_set_at;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS dnw_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dnw_reason text,
  ADD COLUMN IF NOT EXISTS dnw_category text,
  ADD COLUMN IF NOT EXISTS dnw_set_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS dnw_set_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_people_dnw ON people (dnw_flag) WHERE dnw_flag;
