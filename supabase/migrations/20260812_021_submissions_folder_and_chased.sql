-- 20260812_021_submissions_folder_and_chased.sql
-- Brief E. Two nullable columns on submissions.
--
-- athlete_folder_id: the upload path already creates a per-athlete folder in
-- Drive. Storing its id at that moment is what lets the athlete sheet link
-- straight to someone's content; resolving a file's parent at read time works
-- too, but costs a Drive call per row.
--
-- chased_at: stamped when Ping is used. Without it the "needs attention" alert
-- has nothing to settle against and pulses forever.
--
-- Applied to POSTGAME HUB on 12 Aug 2026; recorded here so the schema history
-- lives in git rather than only in the database.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS athlete_folder_id text,
  ADD COLUMN IF NOT EXISTS chased_at timestamptz;
