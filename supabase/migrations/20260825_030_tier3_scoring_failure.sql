-- Migration 30 · a scoring failure must not look like a score
-- Purpose: the tier3 scorer had one fallback branch that wrote score_composite
--          50 + status 'scored' on ANY failure, so 62/62 failed runs were
--          indistinguishable from real scores. The code now leaves every score
--          column null and records why. That needs two things the schema has
--          no room for: a status that is not 'scored', and somewhere to put
--          the error text.
--          Verified 25 Aug: status CHECK = pending_review|scored|approved|
--          rejected|saved_for_later|imported; no scoring_error column.
--
-- Readers are already correct for the new value: /api/tier3/list filters
-- status='scored' (a failure drops out of the picker) and /api/tier3/import
-- requires 'scored' (a failure cannot be imported, and says so).
--
-- Rollback:
--   ALTER TABLE tier3_submissions DROP COLUMN scoring_error;
--   ALTER TABLE tier3_submissions DROP CONSTRAINT tier3_submissions_status_check;
--   ALTER TABLE tier3_submissions ADD CONSTRAINT tier3_submissions_status_check
--     CHECK (status = ANY (ARRAY['pending_review','scored','approved','rejected','saved_for_later','imported']));

ALTER TABLE tier3_submissions
  ADD COLUMN IF NOT EXISTS scoring_error text;

COMMENT ON COLUMN tier3_submissions.scoring_error IS
  'Why the last scoring attempt failed. Null on success. Paired with status=''scoring_failed''.';

ALTER TABLE tier3_submissions
  DROP CONSTRAINT IF EXISTS tier3_submissions_status_check;

ALTER TABLE tier3_submissions
  ADD CONSTRAINT tier3_submissions_status_check
  CHECK (status = ANY (ARRAY[
    'pending_review'::text,
    'scored'::text,
    'scoring_failed'::text,
    'approved'::text,
    'rejected'::text,
    'saved_for_later'::text,
    'imported'::text
  ]));
