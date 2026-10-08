-- Run of show: LucidLink upload card — crew upload to their own top-level
-- LucidLink folder, "Upload - <Name> - <Role> (<lucid_upload_label> <Stop>)".
-- The label is the campaign's short name in that folder name, e.g. "Canes Pumpkin".
ALTER TABLE run_of_shows ADD COLUMN IF NOT EXISTS lucid_upload_label text;
