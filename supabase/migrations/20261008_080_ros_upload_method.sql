-- Run of show: which desktop-app upload card the public shoot page shows.
-- NULL keeps the existing section (upload box or link-out button).
-- 'lucidlink' also needs lucid_campaign_folder; 'frameio' also needs
-- frameio_project_name and the shoot's frameio_folder.
ALTER TABLE run_of_shows ADD COLUMN IF NOT EXISTS upload_method text
  CHECK (upload_method IN ('lucidlink', 'frameio'));
