-- Migration 1/6 · access_level on profiles
-- Purpose: admin access ladder (exec > admin > staff > athlete), separate from
--          role (job function). Verified 17 Aug: profiles has role only.
-- Rollback: ALTER TABLE profiles DROP COLUMN access_level;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'staff'
  CHECK (access_level IN ('exec','admin','staff','athlete'));

UPDATE profiles SET access_level = 'admin'   WHERE role = 'admin';
UPDATE profiles SET access_level = 'athlete' WHERE role = 'athlete';
-- campaign_manager + social_media_manager stay 'staff' (default).

-- EXEC SEEDS — fill real emails before applying (Peyton, Bill, Angie):
-- UPDATE profiles SET access_level = 'exec' WHERE email IN ('___','___','___');
