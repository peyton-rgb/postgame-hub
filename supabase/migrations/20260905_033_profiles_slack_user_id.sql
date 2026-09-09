-- ============================================================
-- profiles.slack_user_id — the stable key for DMing a person on Slack.
--
-- lib/slack-dm resolved every recipient through users.lookupByEmail. That call
-- is the only step in the DM path needing the users:read.email scope, and the
-- only one that can fail for reasons outside this app: a person's Slack email
-- differing from the Asana address campaign_recaps.manager_email carries, or a
-- deactivated account. When it fails the manager DM is silently forwarded to
-- SLACK_FALLBACK_EMAIL, or dropped.
--
-- With this column populated, slack-dm skips the lookup and opens the DM
-- directly. Null means "not recorded yet" and falls back to the email lookup,
-- so an empty column changes no behaviour — which is the state every profile
-- but Dom's is in as of this migration.
--
-- Numbered 033 rather than 032: 20260905_032_profiles_theme.sql exists on the
-- semantic-theming branch but not yet on main, and a duplicate number is worse
-- than a gap whichever of the two lands first.
--
-- ALREADY APPLIED to the POSTGAME HUB project (xqaybwhpgxillpbbqtks) via the
-- Supabase API on 2026-09-05, before this file existed. It is written to be
-- re-runnable so the tracked history matches the live database.
-- ============================================================

alter table public.profiles
  add column if not exists slack_user_id text;

comment on column public.profiles.slack_user_id is
  'Slack user id (U…) for bot DMs. When set, lib/slack-dm skips users.lookupByEmail (which needs the users:read.email scope) and opens the DM directly. Null = fall back to email lookup.';

-- Guard against an email or a display name being pasted in here. Slack ids are
-- U… for members and W… on Enterprise Grid.
alter table public.profiles
  drop constraint if exists profiles_slack_user_id_format;
alter table public.profiles
  add constraint profiles_slack_user_id_format
  check (slack_user_id is null or slack_user_id ~ '^[UW][A-Z0-9]{6,}$');

-- Seed the one id that is known. Idempotent: re-running cannot overwrite a
-- value a human has since corrected, only fill a null.
update public.profiles
   set slack_user_id = 'U07DVCQ4J81'
 where lower(email) = 'dom@pstgm.com'
   and slack_user_id is null;
