-- Migration 028 · contact identities + per-brand attachment junction
--
-- APPLIED to xqaybwhpgxillpbbqtks by the planner thread on 17 Aug.
-- Includes the unique email index the planner applied separately as
-- 028b — folded in here so this file remains the single description of
-- the schema, and verified against pg_indexes rather than assumed.
--
-- This file was rewritten to match the schema that is ACTUALLY APPLIED,
-- read back from information_schema / pg_constraint. An earlier version
-- of this file was reconstructed in the build thread from the brief and
-- differed from what the planner applied (it carried bounced_at,
-- bounce_reason, last_active_at and created_by, which do not exist, and
-- lacked signup_email, which does). The code was aligned to the real
-- schema at the same time. Repo now reproduces the database.
--
-- Purpose: one login per human, no duplicate humans.
--   postgame_contacts = IDENTITY   (one row per person; pre-existing,
--                                   gains contact_type / agency_name)
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
-- Revoking sets status='revoked' as registry truth; it does NOT rotate
-- or invalidate any token. Per-contact tokens are a future build.
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

-- Dedupe is by email, so it must be unique where present — this is what
-- makes "one login, no duplicate humans" a guarantee rather than a
-- convention. The application already looks the address up before
-- inserting (src/app/admin/access/actions.ts); the index closes the race
-- where two concurrent invites for the same new address would both miss
-- that lookup and create twins.
--
-- Partial (WHERE email IS NOT NULL) so the seed rows may keep a null
-- email, and on lower(email) so casing cannot smuggle a twin past it.
-- Applied by the planner as 028b; folded in here to keep 028 the single
-- description of this schema.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_email_unique
  ON postgame_contacts (lower(email)) WHERE email IS NOT NULL;

-- ------------------------------------------------------------
-- 2 · per-brand attachments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brand_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES postgame_contacts(id),
  brand_id uuid NOT NULL REFERENCES brands(id),

  -- Nullable with no CHECK in the applied schema; the app writes
  -- 'approver' | 'viewer' and treats anything else as 'viewer'.
  role text,
  status text NOT NULL DEFAULT 'on_file'
    CHECK (status IN ('on_file', 'invited', 'active', 'bounced', 'revoked')),

  -- Address the invite was sent to (may be corrected after a bounce).
  invited_email text,
  -- Address the person actually signed up with, once they do.
  signup_email text,

  invited_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES profiles(id),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- One attachment per human per brand. This is what makes inviting an
  -- existing email ATTACH rather than create a twin.
  UNIQUE (contact_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_contacts_brand ON brand_contacts (brand_id, status);

-- NOT PRESENT in the applied schema, recorded so the gap is deliberate:
--   bounced_at / bounce_reason — status='bounced' is allowed by the CHECK,
--     but there is nowhere to record WHEN it bounced or why. The UI shows
--     the bounced state without a timestamp.
--   last_active_at — the approved mockup has a "Last active" column with no
--     column to source it from. The screen shows "Activated" (activated_at)
--     instead rather than mislabel a different fact.
--   created_by — no attribution column on the attachment. Who invited whom
--     is still recoverable from admin_audit_log (contact.invite carries
--     actor_id), so accountability is not lost, only denormalised.
