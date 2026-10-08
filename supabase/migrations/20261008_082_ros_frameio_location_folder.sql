-- Run of show: Frame.io upload card. Each shoot's location folder inside the
-- Frame.io project, e.g. "Cincinnati" or "Minnesota".
ALTER TABLE ros_shoots ADD COLUMN IF NOT EXISTS frameio_location_folder text;
