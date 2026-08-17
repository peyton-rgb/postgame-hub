-- Migration 3/6 · brand lifecycle + kit state + MSA + socials on brands
-- Purpose: brand pipeline stage, two-state kit rule (placeholder blocks
--          client-facing output), MSA storage, brand social handles.
--          Verified 17 Aug: none exist (industry already present).
-- Rollback: ALTER TABLE brands DROP COLUMN lifecycle_stage, DROP COLUMN kit_status,
--           DROP COLUMN msa_url, DROP COLUMN ig_handle, DROP COLUMN tiktok_handle;

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS lifecycle_stage text,
  ADD COLUMN IF NOT EXISTS kit_status text NOT NULL DEFAULT 'placeholder'
    CHECK (kit_status IN ('placeholder','official')),
  ADD COLUMN IF NOT EXISTS msa_url text,
  ADD COLUMN IF NOT EXISTS ig_handle text,
  ADD COLUMN IF NOT EXISTS tiktok_handle text;
