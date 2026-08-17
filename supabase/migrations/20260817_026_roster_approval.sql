-- Migration 5/6 · funnel stage + brand approval w/ provenance on athletes
-- Purpose: Sourced->Delivered funnel (athletes currently has NO status column)
--          + per-roster-row brand approval with provenance (portal / AM-email /
--          sheet-import), per locked rulings. Contract sends gate on approval.
-- Rollback: ALTER TABLE athletes DROP COLUMN funnel_stage,
--           DROP COLUMN brand_approval_status, DROP COLUMN approval_provenance,
--           DROP COLUMN approval_decided_by, DROP COLUMN approval_decided_at;

ALTER TABLE athletes
  ADD COLUMN IF NOT EXISTS funnel_stage text NOT NULL DEFAULT 'sourced'
    CHECK (funnel_stage IN ('sourced','outreach','opted_in','selected','committed','delivered')),
  ADD COLUMN IF NOT EXISTS brand_approval_status text NOT NULL DEFAULT 'pending'
    CHECK (brand_approval_status IN ('pending','approved','declined','not_sent')),
  ADD COLUMN IF NOT EXISTS approval_provenance text
    CHECK (approval_provenance IN ('portal','am_email','sheet_import') OR approval_provenance IS NULL),
  ADD COLUMN IF NOT EXISTS approval_decided_by text,
  ADD COLUMN IF NOT EXISTS approval_decided_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_athletes_funnel ON athletes (funnel_stage);
