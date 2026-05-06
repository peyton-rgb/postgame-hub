-- ============================================================
-- Phase 2: AGENT_RUNS and CONCEPTS tables
-- ALREADY APPLIED to recap project (xqaybwhpgxillpbbqtks) on 2026-05-06
-- This file is kept as documentation of what was run.
-- ============================================================

CREATE TYPE agent_name AS ENUM ('creative_director', 'editor', 'distributor', 'intake');
CREATE TYPE agent_run_status AS ENUM ('running', 'complete', 'failed');

CREATE TABLE agent_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name      agent_name NOT NULL,
  triggered_by    uuid NOT NULL REFERENCES auth.users(id),
  input_payload   jsonb NOT NULL,
  output_payload  jsonb,
  model           text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric,
  duration_ms     integer,
  status          agent_run_status NOT NULL DEFAULT 'running',
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_runs_agent_name ON agent_runs(agent_name);
CREATE INDEX idx_agent_runs_triggered_by ON agent_runs(triggered_by);
CREATE INDEX idx_agent_runs_created_at ON agent_runs(created_at DESC);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view agent_runs" ON agent_runs FOR SELECT USING (is_postgame_staff());
CREATE POLICY "Staff can create agent_runs" ON agent_runs FOR INSERT WITH CHECK (is_postgame_staff());
CREATE POLICY "Staff can update agent_runs" ON agent_runs FOR UPDATE USING (is_postgame_staff());

CREATE TYPE concept_production_scope AS ENUM ('ugc_only', 'hybrid', 'full_production');
CREATE TYPE concept_status AS ENUM ('proposed', 'approved', 'rejected', 'iterating', 'archived');
CREATE TYPE concept_source AS ENUM ('claude', 'manual');

CREATE TABLE concepts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id            uuid NOT NULL REFERENCES campaign_briefs(id) ON DELETE CASCADE,
  name                text NOT NULL,
  hook                text NOT NULL,
  athlete_archetype   text,
  settings_suggestions text[] DEFAULT '{}',
  inspo_references    uuid[] DEFAULT '{}',
  production_scope    concept_production_scope NOT NULL DEFAULT 'hybrid',
  estimated_assets    integer,
  status              concept_status NOT NULL DEFAULT 'proposed',
  rejection_feedback  text,
  iteration_history   jsonb DEFAULT '[]',
  generated_by        concept_source NOT NULL DEFAULT 'claude',
  claude_run_id       uuid REFERENCES agent_runs(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_concepts_brief_id ON concepts(brief_id);
CREATE INDEX idx_concepts_status ON concepts(status);
CREATE INDEX idx_concepts_claude_run_id ON concepts(claude_run_id) WHERE claude_run_id IS NOT NULL;

CREATE TRIGGER concepts_updated_at
  BEFORE UPDATE ON concepts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view concepts" ON concepts FOR SELECT USING (is_postgame_staff());
CREATE POLICY "Staff can create concepts" ON concepts FOR INSERT WITH CHECK (is_postgame_staff());
CREATE POLICY "Staff can update concepts" ON concepts FOR UPDATE USING (is_postgame_staff());
CREATE POLICY "Staff can delete concepts" ON concepts FOR DELETE USING (is_postgame_staff());
