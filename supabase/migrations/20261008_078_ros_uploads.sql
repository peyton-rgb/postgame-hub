-- Run of show: crew upload box → Mac Studio.
-- run_of_shows gets the LucidLink campaign folder and an on/off switch; the
-- public shoot page keeps the old link-out button until uploads_enabled is true.
ALTER TABLE run_of_shows ADD COLUMN IF NOT EXISTS lucid_campaign_folder text;
ALTER TABLE run_of_shows ADD COLUMN IF NOT EXISTS uploads_enabled boolean NOT NULL DEFAULT false;

-- One row per file the Studio receiver reports back (POST /api/ros-upload/report).
CREATE TABLE IF NOT EXISTS ros_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ros_shoot_id uuid NOT NULL REFERENCES ros_shoots(id) ON DELETE CASCADE,
  upload_id text NOT NULL UNIQUE,      -- tusd upload id
  batch_id text,                       -- one per drag/drop session
  file_name text NOT NULL,
  relative_path text,
  uploader_name text,
  uploader_role text,
  file_kind text NOT NULL CHECK (file_kind IN ('raw','working')),
  size bigint,
  sha256 text,
  lucid_path text,
  status text NOT NULL CHECK (status IN ('in_lucid','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ros_uploads_shoot_idx ON ros_uploads (ros_shoot_id, created_at DESC);

-- No public policies: only the server routes read or write this, with the service role.
ALTER TABLE ros_uploads ENABLE ROW LEVEL SECURITY;
