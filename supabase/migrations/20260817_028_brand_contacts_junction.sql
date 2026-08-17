-- Migration 028 · contact identities + per-brand attachment junction
--
-- ⚠️ AUTHORED IN THE BUILD THREAD, NOT BY THE PLANNER.
-- The /admin/access brief expected this file to already be in the repo
-- ("Peyton adds it, or copy from planner"). It was not present anywhere
-- on disk when the screen was built, so it is reconstructed here from the
-- locked data-model ruling in the brief. If the planner's own 028 differs,
-- RECONCILE COLUMN NAMES BEFORE APPLYING — src/lib/admin/access.ts,
-- src/app/admin/access/page.tsx and .../actions.ts read these exact names.
--
-- Purpose: one login per human, no duplicate humans.
--   postgame_contacts = IDENTITY   (one row per person; already exists,
--                                   15 rows, gains contact_type/agency_name)
--   brand_contacts    = ATTACHMENT (one row per person-per-brand, carrying
--                                   that brand's role and status)
--
-- Status ladder: on_file → invited → active, plus bounced and revoked.
--   on_file  — known to us, no invite sent, holds NO seat
--   invited  — invite sent, not yet signed in, holds a seat
--   active   — signed in, holds a seat
--   bounced  — invite email failed, holds a seat and flags loudly
--   revoked  — access withdrawn; registry truth only (see note below)
--
-- SCOPE NOTE: portal entry today is the BRAND-level brands.portal_token.
-- Revoking here sets status='revoked' as registry truth; it does NOT
-- rotate or invalidate any token. Per-contact tokens are a future build.
--
-- Verified 17 Aug against xqaybwhpgxillpbbqtks: brand_contacts does not
-- exist; postgame_contacts has neither contact_type nor agency_name.
--
-- Rollback:
--   DROP TABLE brand_contacts;
--   ALTER TABLE postgame_contacts DROP COLUMN contact_type, DROP COLUMN agency_name;

-- ------------------------------------------------------------
-- 1 · identities
-- ------------------------------------------------------------
ALTER TABLE postgame_contacts
  ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'brand'
    CHECK (contact_type IN ('brand', 'agency')),
  ADD COLUMN IF NOT EXISTS agency_name text;

-- Dedupe is by email, so it must be unique where present. Partial index:
-- the 15 seed rows are allowed to carry a null email.
CREATE UNIQUE INDEX IF NOT EXISTS idx_postgame_contacts_email_unique
  ON postgame_contacts (lower(email)) WHERE email IS NOT NULL;

-- ------------------------------------------------------------
-- 2 · per-brand attachments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brand_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES postgame_contacts(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

  role text NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('approver', 'viewer')),
  status text NOT NULL DEFAULT 'on_file'
    CHECK (status IN ('on_file', 'invited', 'active', 'bounced', 'revoked')),

  -- The address the invite actually went to. May differ from the identity's
  -- signup email (bounced invites get corrected without touching identity).
  invited_email text,
  invited_at timestamptz,
  activated_at timestamptz,
  bounced_at timestamptz,
  bounce_reason text,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES profiles(id),
  last_active_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id),

  -- One attachment per human per brand. This is what makes inviting an
  -- existing email ATTACH rather than create a twin.
  UNIQUE (contact_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_contacts_brand ON brand_contacts (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_brand_contacts_contact ON brand_contacts (contact_id);
CREATE INDEX IF NOT EXISTS idx_brand_contacts_status ON brand_contacts (status);
