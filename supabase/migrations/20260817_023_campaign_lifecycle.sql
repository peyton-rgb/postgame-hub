-- Migration 2/6 · campaign lifecycle + owner on campaign_recaps
-- Purpose: real lifecycle states (existing status is draft/published only —
--          left untouched) + campaign owner. Verified 17 Aug: neither exists.
-- Rollback: ALTER TABLE campaign_recaps DROP COLUMN lifecycle_status, DROP COLUMN owner_id;

ALTER TABLE campaign_recaps
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'draft'
    CHECK (lifecycle_status IN ('draft','active','delivered','closed')),
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_campaign_recaps_lifecycle ON campaign_recaps (lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_campaign_recaps_owner ON campaign_recaps (owner_id);
