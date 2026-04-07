-- ─── Add drive_file_id to media ─────────────────────────────
-- Tracks the Google Drive file ID for media imported via Drive,
-- enabling future re-sync and duplicate detection.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE media ADD COLUMN IF NOT EXISTS drive_file_id text;

CREATE INDEX IF NOT EXISTS idx_media_drive_file_id
  ON media (drive_file_id)
  WHERE drive_file_id IS NOT NULL;
