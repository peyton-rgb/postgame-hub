-- Migration 6/6 · admin_audit_log
-- Purpose: every confirmed admin write records who/what/when + before/after.
--          Pay-suite actions, DNW set/remove, toggles, approvals all insert here.
-- Rollback: DROP TABLE admin_audit_log;

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES profiles(id),
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON admin_audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON admin_audit_log (actor_id, created_at DESC);
