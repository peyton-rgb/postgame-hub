-- ============================================================
-- Add drive_folder_id to creator_briefs
-- ============================================================
-- Purpose: stores the Google Drive folder ID for each creator
-- brief's athlete-level footage folder. Auto-created when the
-- brief is published.
--
-- Pairs with:
--   brands.drive_parent_folder_id   (brand-level folder)
--   campaign_briefs.drive_folder_id (campaign-level folder)
--
-- Date: 2026-05-08
-- ============================================================

BEGIN;

ALTER TABLE creator_briefs
  ADD COLUMN IF NOT EXISTS drive_folder_id text;

COMMENT ON COLUMN creator_briefs.drive_folder_id IS
  'Google Drive folder ID for this creator brief''s athlete-level folder. NULL until the brief is published — then auto-created and saved by the ensure-folders flow.';

COMMIT;
