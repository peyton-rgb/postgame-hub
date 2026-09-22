-- Add 'admin_drive_service' to the agent_name enum.
--
-- Brief 15 requires every write from the admin Drive service to be logged to
-- agent_runs under a truthful name, NOT reused from admin_sync. agent_runs
-- .agent_name is a Postgres enum, so the value has to exist before the first
-- insert or the log write fails — and the endpoint would then either 500 on a
-- successful handoff or swallow the error, which is the exact failure mode
-- this codebase has been paying down all week.
--
-- Own migration: ALTER TYPE ... ADD VALUE cannot be used in the same
-- transaction that goes on to use the value. Same shape as 20260905_042.
--
-- Note the existing 'admin_sync' member is currently doing duty for five
-- different nightly jobs, distinguishable only by input_payload.source. This
-- deliberately does not join that pile.
--
-- APPLIED to the recap-editor-test branch (jlxdxuqfmnnpwvmozgmm) on 2026-09-22.
-- NOT applied to production.

alter type public.agent_name add value if not exists 'admin_drive_service';
