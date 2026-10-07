-- Run of show: event site-map image for the public shoot page.
-- Nullable; the shoot page hides the "Event Site Map" card when it is empty.
ALTER TABLE ros_shoots ADD COLUMN IF NOT EXISTS site_map_url text;
