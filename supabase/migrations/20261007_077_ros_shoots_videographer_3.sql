-- Run of show: third crew slot on a shoot, for drone operators.
-- Both nullable; the public shoot page hides the row when videographer_3 is empty.
ALTER TABLE ros_shoots ADD COLUMN IF NOT EXISTS videographer_3 text;
ALTER TABLE ros_shoots ADD COLUMN IF NOT EXISTS videographer_3_phone text;
