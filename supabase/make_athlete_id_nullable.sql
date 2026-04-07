-- ─── Make athlete_id nullable on media ──────────────────────
-- Campaign-level Drive imports create media rows without an
-- athlete association. Allow athlete_id to be NULL.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE media ALTER COLUMN athlete_id DROP NOT NULL;
