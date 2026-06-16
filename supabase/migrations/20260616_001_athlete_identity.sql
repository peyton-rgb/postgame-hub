-- ============================================================
-- Athlete App — Phase 1: Athlete identity
--
-- Additive only. No existing table/column is dropped, renamed, or retyped.
--
-- 1. Adds athlete-specific columns to public.profiles.
-- 2. Lets brand-new signups self-select the "athlete" role via signup
--    metadata, while preserving the prior default ("campaign_manager")
--    for everyone else. A self-signup can NEVER request a staff role
--    other than the pre-existing default — no escalation to admin.
-- 3. Locks the privileged columns (role, paypal_linked) so a user cannot
--    edit them on their own row through the existing "Users can update own
--    profile" RLS policy (which is column-blind). Only the service role /
--    trusted server context may change them.
-- ============================================================

-- ── 1. Athlete profile columns (all additive, nullable except the flag) ──
alter table public.profiles
  add column if not exists paypal_linked boolean not null default false,
  add column if not exists paypal_email  text,
  add column if not exists ig_handle     text,
  add column if not exists tiktok_handle text,
  add column if not exists school        text,
  add column if not exists sport         text,
  add column if not exists onboarded_at  timestamptz;

comment on column public.profiles.paypal_linked is
  'Athlete payout gate. Set server-side (service role) only — frozen against self-update.';

-- ── 2. Signup trigger: allow self-service athlete role ──
-- Only the literal value 'athlete' may be self-assigned from signup metadata.
-- Any other / missing value keeps the original default so existing staff
-- provisioning is unchanged and no caller can self-assign 'admin' etc.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_requested text := nullif(NEW.raw_user_meta_data->>'role', '');
  v_role      text := case when v_requested = 'athlete' then 'athlete'
                           else 'campaign_manager' end;
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    NEW.id,
    NEW.email,
    coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    v_role
  );
  return NEW;
end;
$function$;

-- ── 3. Freeze privileged columns against client self-update ──
-- The existing UPDATE policy allows auth.uid() = id but cannot restrict which
-- columns change. This trigger reverts role / paypal_linked to their prior
-- values unless the request is the trusted service role (or a direct SQL /
-- superuser context where the JWT role is absent, e.g. migrations).
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_jwt_role text := coalesce(auth.role(), '');
begin
  if v_jwt_role in ('service_role', '') then
    return NEW;  -- trusted server / migration context: allow anything
  end if;

  -- Client (authenticated / anon) context: privileged columns are immutable.
  NEW.role          := OLD.role;
  NEW.paypal_linked := OLD.paypal_linked;
  return NEW;
end;
$function$;

drop trigger if exists protect_profile_privileged_columns on public.profiles;
create trigger protect_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();
