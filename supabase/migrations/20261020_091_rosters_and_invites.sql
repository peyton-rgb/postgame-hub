-- 091 — Rosters and invites: the tables behind /admin/rosters,
-- /admin/rosters/settings and /admin/invites.
--
--   athlete_invites   the invite queue: athletes WITHOUT the app who get a
--                     text or an Instagram DM from staff (CF invites.cfm).
--                     App users get an in-app notification instead and never
--                     land here.
--   roster_runs       one row per roster-bot run (when, schools checked, what
--                     it changed).
--   roster_changes    what a run changed, per athlete: added, transfer, left a
--                     roster, new handle, details refreshed.
--   roster_issues     schools that need a look (site changed, bot blocked,
--                     too few athletes found, missing handles, same Instagram
--                     on two records).
--   roster_uploads    hand uploads (the backup path when a site can't be read).
--   roster_settings   one row: schedule and what the bots may do on their own.
--
-- Athletes are `people` rows (people.id), schools are `colleges` rows.
-- Builds on 083 (saved_audiences, is_postgame_staff(), set_updated_at()).
-- Every statement is idempotent. The Hub feature-detects all of this: the
-- screens show pending notes until it is applied. FILE ONLY — not applied.

-- ------------------------------------------------------------ invites
create table if not exists public.athlete_invites (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references public.people(id) on delete cascade,
  instagram_username text,
  phone_on_file      boolean not null default false,
  channel            text not null default 'dm' check (channel in ('text', 'dm')),
  campaign_recap_id  uuid references public.campaign_recaps(id) on delete set null,
  audience_id        uuid references public.saved_audiences(id) on delete set null,
  message            text,
  status             text not null default 'not_sent' check (status in ('not_sent', 'sent', 'private', 'bad_ig')),
  sent_by            uuid references public.profiles(id) on delete set null,
  sent_at            timestamptz,
  joined_at          timestamptz,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.athlete_invites is 'Invite queue: athletes without the Postgame app, to be sent a text or Instagram DM by staff and marked sent. CF invites.cfm.';
create index if not exists athlete_invites_status_idx on public.athlete_invites (status, created_at desc);
create index if not exists athlete_invites_person_idx on public.athlete_invites (person_id);
create unique index if not exists athlete_invites_person_campaign_uniq
  on public.athlete_invites (person_id, coalesce(campaign_recap_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ------------------------------------------------------------ roster bots
create table if not exists public.roster_runs (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  status          text not null default 'running' check (status in ('running', 'done', 'failed')),
  schools_checked integer not null default 0,
  added           integer not null default 0,
  transfers       integer not null default 0,
  left_roster     integer not null default 0,
  new_handles     integer not null default 0,
  notes           text
);
comment on table public.roster_runs is 'One row per roster-bot run.';
create index if not exists roster_runs_started_idx on public.roster_runs (started_at desc);

create table if not exists public.roster_changes (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references public.roster_runs(id) on delete cascade,
  person_id       uuid references public.people(id) on delete set null,
  kind            text not null check (kind in ('added', 'transfer', 'left', 'handle_added', 'updated', 'archived', 'restored')),
  from_college_id bigint references public.colleges(id) on delete set null,
  to_college_id   bigint references public.colleges(id) on delete set null,
  detail          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
comment on table public.roster_changes is 'What each roster run changed, per athlete. Transfers carry from/to college.';
create index if not exists roster_changes_kind_idx on public.roster_changes (kind, created_at desc);

create table if not exists public.roster_issues (
  id             uuid primary key default gen_random_uuid(),
  college_id     bigint references public.colleges(id) on delete cascade,
  kind           text not null check (kind in ('site_changed', 'blocked', 'too_few', 'missing_handles', 'duplicate_ig', 'other')),
  detail         text,
  athletes_count integer,
  last_good_at   timestamptz,
  status         text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  resolved_by    uuid references public.profiles(id) on delete set null
);
comment on table public.roster_issues is 'Schools whose roster update needs a person to look (Needs a look tab).';
create index if not exists roster_issues_open_idx on public.roster_issues (status, created_at desc);

create table if not exists public.roster_uploads (
  id          uuid primary key default gen_random_uuid(),
  college_id  bigint references public.colleges(id) on delete set null,
  file_name   text,
  row_count   integer,
  uploaded_by uuid references public.profiles(id) on delete set null,
  applied_at  timestamptz,
  created_at  timestamptz not null default now()
);
comment on table public.roster_uploads is 'Rosters uploaded by hand (backup when a school site cannot be read).';

create table if not exists public.roster_settings (
  id                    smallint primary key default 1 check (id = 1),
  cadence               text not null default 'weekly' check (cadence in ('weekly', 'biweekly', 'monthly')),
  run_at                text not null default '04:00 America/New_York',
  sweep_months          text[] not null default array['august', 'october', 'january'],
  transfer_by_instagram boolean not null default true,
  save_instagram_id     boolean not null default true,
  may_add               boolean not null default true,
  may_fill_handles      boolean not null default true,
  may_update_details    boolean not null default true,
  on_missing            text not null default 'archive' check (on_missing in ('archive', 'flag')),
  hold_back_below_pct   integer not null default 50 check (hold_back_below_pct between 0 and 100),
  slack_summary         boolean not null default true,
  workspace_tasks       boolean not null default true,
  updated_by            uuid references public.profiles(id) on delete set null,
  updated_at            timestamptz not null default now()
);
comment on table public.roster_settings is 'Roster-bot schedule and what the bots may change on their own. One row (id = 1).';
insert into public.roster_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------ updated_at
drop trigger if exists athlete_invites_set_updated_at on public.athlete_invites;
create trigger athlete_invites_set_updated_at
  before update on public.athlete_invites
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ RLS: staff only
do $$
declare t text;
begin
  foreach t in array array['athlete_invites', 'roster_runs', 'roster_changes', 'roster_issues', 'roster_uploads', 'roster_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_staff_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff())',
        t || '_staff_all', t
      );
    end if;
  end loop;
end $$;
