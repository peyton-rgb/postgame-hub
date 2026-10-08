-- Run of show: Frame.io upload card on the public shoot page.
-- The card shows only when both are set: the Frame.io project crew mount
-- (run_of_shows) and this stop's folder inside it (ros_shoots). Both nullable;
-- the shoot page keeps the existing upload section when either is empty.
ALTER TABLE run_of_shows ADD COLUMN IF NOT EXISTS frameio_project_name text;
ALTER TABLE ros_shoots ADD COLUMN IF NOT EXISTS frameio_folder text;
