-- Migration 029 · brand-user authentication
--
-- NOT APPLIED — planner applies after review.
--
-- Gives brand and agency contacts a real login, scoped to the brands they
-- are attached to, and names the two humans a client should contact.
--
-- Constraint definitions below were read back from pg_constraint on
-- 17 Aug before being rewritten, not assumed:
--   profiles_access_level_check  CHECK (access_level IN
--     ('exec','admin','staff','athlete'))
--   profiles_role_check          CHECK (role IN
--     ('admin','brand_relations','campaign_manager',
--      'social_media_manager','athlete'))
--
-- Rollback:
--   ALTER TABLE brands DROP COLUMN account_owner_id;
--   ALTER TABLE brand_contacts DROP COLUMN invite_token, DROP COLUMN invite_expires_at;
--   ALTER TABLE postgame_contacts DROP COLUMN profile_id;
--   ALTER TABLE profiles DROP CONSTRAINT profiles_access_level_check;
--   ALTER TABLE profiles ADD CONSTRAINT profiles_access_level_check
--     CHECK (access_level IN ('exec','admin','staff','athlete'));
--   ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
--   ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
--     CHECK (role IN ('admin','brand_relations','campaign_manager',
--                     'social_media_manager','athlete'));
--   (rollback is only safe while no profiles row carries 'brand')

-- ------------------------------------------------------------
-- 1 · Account Lead on the brand
-- ------------------------------------------------------------
-- The named Postgame owner of the relationship, surfaced to clients in
-- the "Your Postgame Team" block alongside the campaign manager.
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS account_owner_id uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_brands_account_owner ON brands (account_owner_id);

-- ------------------------------------------------------------
-- 2 · invite tokens on the attachment
-- ------------------------------------------------------------
-- The token is per ATTACHMENT, not per identity: the same human invited
-- to two brands gets two links, and accepting one does not silently
-- grant the other.
--
-- DEFAULT gen_random_uuid() means the single pre-existing invited row
-- (7-Eleven / peytonjula@gmail.com) gets a token when this runs, so the
-- pilot invite can be resent without hand-patching it.
ALTER TABLE brand_contacts
  ADD COLUMN IF NOT EXISTS invite_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS invite_expires_at timestamptz;

-- Lookup path for /portal/signup?token=… — unique so a token can never
-- resolve to two attachments.
CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_contacts_invite_token
  ON brand_contacts (invite_token) WHERE invite_token IS NOT NULL;

-- ------------------------------------------------------------
-- 3 · identity ↔ login link
-- ------------------------------------------------------------
-- Set once, at signup. This is what makes "one human, one login, many
-- brands" true: the session resolves profile_id -> contact -> every
-- active attachment, rather than carrying brand ids in the session.
ALTER TABLE postgame_contacts
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_postgame_contacts_profile
  ON postgame_contacts (profile_id) WHERE profile_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4 · 'brand' on the access ladder
-- ------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_access_level_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_access_level_check
  CHECK (access_level IN ('exec', 'admin', 'staff', 'athlete', 'brand'));

-- ------------------------------------------------------------
-- 5 · 'brand' on the ROLE check too — NOT in the brief, and required
-- ------------------------------------------------------------
-- profiles.role is NOT NULL DEFAULT 'campaign_manager' and carries its
-- own CHECK. Without widening it, every brand login would have to be
-- written as one of the five STAFF job functions, and the default would
-- silently stamp external clients as 'campaign_manager'.
--
-- That is not merely untidy — src/lib/admin/auth.ts falls back to `role`
-- whenever access_level is unrecognised, and its fallback maps anything
-- that is not 'admin' or 'athlete' to 'staff'. A brand user carrying
-- role='campaign_manager' would therefore be READ AS STAFF and let into
-- /admin. The fallback is being hardened in the same change; widening
-- the role vocabulary is the other half, so a brand login can be
-- labelled honestly as what it is.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'brand_relations', 'campaign_manager',
                  'social_media_manager', 'athlete', 'brand'));
