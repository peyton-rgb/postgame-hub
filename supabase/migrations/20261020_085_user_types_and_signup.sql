-- ============================================================
-- 085 — App user types + self-service sign-up for videographers,
--       coaches and agents.
--
-- Product rules (Peyton, 2026-10-20):
--   * App user types are: current athlete, former athlete, coach,
--     videographer, agent. There is NO "fan" type.
--   * Brand users (brand portal) and Postgame staff are separate sign-ins.
--   * An ATHLETE is a roster profile (people / athlete_profiles); a USER is
--     someone with the app. The Instagram handle links them.
--   * Videographers sign up at postgame1.com/desktop (web) or inside the
--     desktop app, then upload through the desktop app only.
--
-- What this file does:
--   1. user_types  — adds a stable machine `code` and seeds the five app
--                    types plus `brand` and `staff` (083 created the table
--                    empty; its comment says "kinds of people", which is
--                    exactly these). Insert-if-missing, so a later ColdFusion
--                    import can add its own rows without clashing.
--   2. profile_types — seeds the roster profile kinds the Hub already uses
--                    as people.roster_status (college / high school / former
--                    college / professional / former pro). Insert-if-missing.
--   3. videographer_profiles, coach_profiles, agent_profiles — one row per
--                    self-service sign-up, keyed by the Supabase auth user.
--                    No bank, tax or password columns anywhere.
--   4. profiles.role — widened so an app login can be labelled honestly
--                    ('videographer' | 'coach' | 'agent') instead of being
--                    stamped as a staff job function.
--   5. handle_new_user() — the auth.users trigger, rebuilt from the LIVE
--                    body (read back from production 2026-10-20 — the copy
--                    in 20260616_001 is stale) so it also:
--                      a. reads raw_user_meta_data->>'user_type',
--                      b. writes profiles.access_level explicitly.
--                    (b) fixes a pre-existing fail-open: access_level has
--                    DEFAULT 'staff', and the live trigger never set it, so
--                    every athlete self-signup landed with role='athlete'
--                    AND access_level='staff'. The one existing athlete row
--                    was patched by hand; new ones were not.
--
-- ACCESS LEVEL FOR APP USERS — read this before changing it.
--   src/lib/admin/auth.ts recognises exactly five access levels
--   (exec, admin, staff, athlete, brand). Anything else falls back to
--   profiles.role, and that fallback maps every role it does not know to
--   'staff' — so a brand-new level such as 'app' would let a videographer
--   into /admin. Until auth.ts learns a dedicated level, every app user
--   type is stored with access_level = 'athlete' (the floor rung, "outranks
--   nothing") and the real type lives in profiles.role + user metadata.
--   middleware.ts and requireAdmin() both fail closed on 'athlete'.
--
-- NOT APPLIED. Written for review; apply with apply_migration, never
-- execute_sql. Safe to re-run (every statement is if-not-exists / on
-- conflict do nothing / create or replace).
--
-- Rollback (reverse order):
--   drop trigger if exists on_auth_user_created on auth.users;  -- then
--   restore handle_new_user() from the body quoted in section 5 below
--   alter table profiles drop constraint profiles_role_check;
--   alter table profiles add constraint profiles_role_check check (role in
--     ('admin','brand_relations','campaign_manager','social_media_manager',
--      'athlete','brand'));
--   drop table if exists agent_profiles, coach_profiles, videographer_profiles;
--   delete from profile_types where code is not null;
--   delete from user_types where code is not null;
--   alter table profile_types drop column code;
--   alter table user_types drop column code, drop column description;
-- ============================================================

-- ---------- 1. user_types: machine code + seed ----------
alter table public.user_types
  add column if not exists code text,
  add column if not exists description text;

create unique index if not exists user_types_code_key
  on public.user_types (code) where code is not null;

comment on column public.user_types.code is
  'Stable machine key used in auth user metadata (user_type) and in code. Never renamed.';

insert into public.user_types (code, user_type, description) values
  ('current_athlete', 'Current athlete', 'On a roster now (college, high school or pro). Signs up in the Postgame app.'),
  ('former_athlete',  'Former athlete',  'No longer on a roster. Keeps their profile and can still be booked.'),
  ('coach',           'Coach',           'Coaches and team staff. New type — nobody has it yet. Postgame reviews before access.'),
  ('videographer',    'Videographer',    'Shoots Postgame campaigns. Signs up at /desktop, uploads through the desktop app.'),
  ('agent',           'Agent',           'Represents athletes. Postgame reviews before access; can invite their athletes.'),
  ('brand',           'Brand user',      'Client contact with a brand portal login (/portal). Not an app user.'),
  ('staff',           'Postgame staff',  'Signs in with a @pstgm.com Google account (/login). Not an app user.')
on conflict (code) where code is not null do nothing;

-- ---------- 2. profile_types: machine code + seed ----------
alter table public.profile_types
  add column if not exists code text;

create unique index if not exists profile_types_code_key
  on public.profile_types (code) where code is not null;

comment on column public.profile_types.code is
  'Stable machine key. Mirrors people.roster_status so the two vocabularies can be joined.';

insert into public.profile_types (code, profile_type, show_in_rankings) values
  ('college_athlete',      'College athlete',      true),
  ('high_school_athlete',  'High school athlete',  false),
  ('former_college',       'Former college athlete', false),
  ('professional_athlete', 'Professional athlete', false),
  ('former_pro',           'Former pro',           false)
on conflict (code) where code is not null do nothing;

-- ---------- 3. Self-service sign-up profiles ----------
-- One row per app login of that type. auth_user_id is the Supabase Auth
-- user; person_id is the roster/people record once staff link it (by
-- Instagram handle or email); videographer_id is the existing booking
-- roster row in `videographers` (414 rows) once matched.

create table if not exists public.videographer_profiles (
  id                     uuid primary key default gen_random_uuid(),
  auth_user_id           uuid unique references auth.users(id) on delete cascade,
  person_id              uuid references public.people(id) on delete set null,
  videographer_id        uuid references public.videographers(id) on delete set null,
  full_name              text not null,
  email                  text not null,
  phone                  text,
  instagram_or_portfolio text,
  city                   text,
  gear                   text,
  status                 text not null default 'signed_up'
                         check (status in ('signed_up','can_upload','inactive')),
  lucidlink_member_id    text,
  signup_source          text not null default 'web'
                         check (signup_source in ('web','desktop_app','admin')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
comment on table public.videographer_profiles is
  'Videographer app accounts from /desktop (web) or the desktop app. status: signed_up = account only; can_upload = Postgame granted LucidLink access; inactive = switched off. No payment or tax columns here.';
create index if not exists videographer_profiles_status_idx on public.videographer_profiles (status);
create index if not exists videographer_profiles_email_idx  on public.videographer_profiles (lower(email));

create table if not exists public.coach_profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete cascade,
  person_id     uuid references public.people(id) on delete set null,
  full_name     text not null,
  email         text not null,
  phone         text,
  school        text,
  title         text,
  status        text not null default 'pending'
                check (status in ('pending','approved','inactive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.coach_profiles is
  'Coach app accounts from /signup/coach. Pending until Postgame approves.';
create index if not exists coach_profiles_status_idx on public.coach_profiles (status);

create table if not exists public.agent_profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique references auth.users(id) on delete cascade,
  person_id     uuid references public.people(id) on delete set null,
  full_name     text not null,
  email         text not null,
  phone         text,
  agency        text,
  title         text,
  status        text not null default 'pending'
                check (status in ('pending','approved','inactive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.agent_profiles is
  'Agent app accounts from /signup/agent. Pending until Postgame approves. The 162 roster agents stay in people (person_type = Agent) until linked via person_id.';
create index if not exists agent_profiles_status_idx on public.agent_profiles (status);

-- RLS: the owner reads and edits their own row (never status / links —
-- see the column guard below); staff (@pstgm.com, is_postgame_staff())
-- read and write everything. Inserts come from server actions with the
-- service role, so no client insert policy on purpose: a browser can
-- never create a row with status = 'can_upload'.
do $$
declare t text;
begin
  foreach t in array array['videographer_profiles','coach_profiles','agent_profiles'] loop
    execute format('alter table public.%I enable row level security', t);

    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_staff_all') then
      execute format('create policy %I on public.%I for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff())', t||'_staff_all', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_owner_select') then
      execute format('create policy %I on public.%I for select to authenticated using (auth_user_id = auth.uid())', t||'_owner_select', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=t||'_owner_update') then
      execute format('create policy %I on public.%I for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid())', t||'_owner_update', t);
    end if;

    if not exists (select 1 from pg_trigger where tgname = t||'_set_updated_at' and tgrelid = ('public.'||t)::regclass) then
      execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t||'_set_updated_at', t);
    end if;
  end loop;
end $$;

-- Column guard: an owner UPDATE may change contact details, never the
-- fields that grant access or link records. Same shape as
-- protect_profile_privileged_columns() on profiles.
create or replace function public.protect_signup_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_jwt_role text := coalesce(auth.role(), '');
begin
  if v_jwt_role in ('service_role', '') then
    return NEW;  -- server action / migration context: allow anything
  end if;
  if public.is_postgame_staff() then
    return NEW;  -- staff may change status and links from /admin
  end if;
  NEW.status       := OLD.status;
  NEW.auth_user_id := OLD.auth_user_id;
  NEW.person_id    := OLD.person_id;
  return NEW;
end;
$function$;

do $$
declare t text;
begin
  foreach t in array array['videographer_profiles','coach_profiles','agent_profiles'] loop
    if not exists (select 1 from pg_trigger where tgname = t||'_protect_privileged' and tgrelid = ('public.'||t)::regclass) then
      execute format('create trigger %I before update on public.%I for each row execute function public.protect_signup_profile_privileged_columns()', t||'_protect_privileged', t);
    end if;
  end loop;
end $$;

-- videographer_profiles also guards the LucidLink / roster links.
create or replace function public.protect_videographer_profile_links()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') in ('service_role', '') or public.is_postgame_staff() then
    return NEW;
  end if;
  NEW.videographer_id     := OLD.videographer_id;
  NEW.lucidlink_member_id := OLD.lucidlink_member_id;
  return NEW;
end;
$function$;

drop trigger if exists videographer_profiles_protect_links on public.videographer_profiles;
create trigger videographer_profiles_protect_links
  before update on public.videographer_profiles
  for each row execute function public.protect_videographer_profile_links();

-- ---------- 4. profiles.role: honest labels for app logins ----------
-- Read back from pg_constraint on 2026-10-20 before rewriting:
--   CHECK (role IN ('admin','brand_relations','campaign_manager',
--                   'social_media_manager','athlete','brand'))
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in (
    'admin', 'brand_relations', 'campaign_manager', 'social_media_manager',
    'athlete', 'brand',
    'videographer', 'coach', 'agent'
  ));

-- ---------- 5. handle_new_user(): user_type aware, sets access_level ----------
-- Live body before this change (production, 2026-10-20), kept here so the
-- rollback is exact:
--
--   v_requested := nullif(NEW.raw_user_meta_data->>'role','');
--   v_is_staff  := lower(NEW.email) like '%@pstgm.com';
--   if v_requested = 'athlete' then v_role := 'athlete';
--   elsif v_is_staff then v_role := case when v_requested in
--       ('brand_relations','campaign_manager','social_media_manager')
--       then v_requested else 'campaign_manager' end;
--   else v_role := 'athlete'; end if;
--   insert into profiles (id,email,full_name,avatar_url,role) values (...)
--   on conflict (id) do nothing;
--
-- New rules, in order (granting LESS access is never risky, so the
-- narrow cases come first):
--   1. metadata user_type in (videographer, coach, agent) and NOT a
--      @pstgm.com address  -> role = that type, access_level = 'athlete'
--      (the floor; see the header note on access levels).
--   2. metadata role = 'athlete' or user_type in (current_athlete,
--      former_athlete)      -> role 'athlete', access_level 'athlete'.
--   3. @pstgm.com           -> a requested staff job function or
--      'campaign_manager', access_level 'staff'. Never 'admin' / 'exec'
--      from metadata.
--   4. anyone else          -> 'athlete' / 'athlete' (unchanged default).
-- Brand logins are created by /portal/signup with the service role and
-- immediately upserted to role/access_level 'brand'; they pass through
-- rule 4 for a moment with no session, exactly as before.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_requested text    := nullif(NEW.raw_user_meta_data->>'role', '');
  v_user_type text    := nullif(NEW.raw_user_meta_data->>'user_type', '');
  v_is_staff  boolean := lower(NEW.email) like '%@pstgm.com';
  v_role      text;
  v_level     text;
begin
  if not v_is_staff and v_user_type in ('videographer', 'coach', 'agent') then
    v_role  := v_user_type;
    v_level := 'athlete';   -- app-user floor; auth.ts has no 'app' level yet

  elsif v_requested = 'athlete' or v_user_type in ('current_athlete', 'former_athlete') then
    v_role  := 'athlete';
    v_level := 'athlete';

  elsif v_is_staff then
    v_role := case
                when v_requested in ('brand_relations', 'campaign_manager', 'social_media_manager')
                  then v_requested
                else 'campaign_manager'
              end;
    v_level := 'staff';

  else
    v_role  := 'athlete';
    v_level := 'athlete';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role, access_level)
  values (
    NEW.id,
    NEW.email,
    coalesce(
      nullif(NEW.raw_user_meta_data->>'full_name', ''),
      nullif(NEW.raw_user_meta_data->>'name', ''),
      split_part(NEW.email, '@', 1)
    ),
    coalesce(
      nullif(NEW.raw_user_meta_data->>'avatar_url', ''),
      nullif(NEW.raw_user_meta_data->>'picture', '')
    ),
    v_role,
    v_level
  )
  on conflict (id) do nothing;

  return NEW;
end;
$function$;

-- The trigger itself (on_auth_user_created) already exists on auth.users
-- and points at this function by name, so replacing the body is enough.
