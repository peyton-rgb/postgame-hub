-- 097 — roster_entries: one row per athlete per team, read from the
-- schools' own roster pages by the roster scrapers (scripts/rosters/).
--
-- Plain English: the current D1 rosters, as the schools publish them.
-- Instagram is how Postgame identifies an athlete, so each row carries the
-- handle and where it came from ('roster' = the school's page,
-- 'matched' = filled from existing data by name + school + sport).
-- person_id links the row to people once the athlete is identified.
--
-- First load 2026-10-20: 358 D1 schools, ~147,800 athletes.
-- Staff-only (RLS). Additive: no existing table changes.

create table if not exists public.roster_entries (
  id                uuid primary key default gen_random_uuid(),
  school_domain     text not null,
  school_name       text,
  ncaa_org_id       bigint,
  conference        text,
  college_id        bigint references public.colleges(id) on delete set null,
  sport             text not null,
  full_name         text not null,
  jersey            text,
  position          text,
  class_year        text,
  height            text,
  weight            text,
  hometown          text,
  high_school       text,
  previous_school   text,
  instagram         text,
  instagram_source  text check (instagram_source in ('roster', 'matched', 'manual')),
  match_detail      jsonb,
  person_id         uuid references public.people(id) on delete set null,
  roster_url        text,
  platform          text,
  scraped_at        timestamptz not null default now(),
  run_id            uuid references public.roster_runs(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique nulls not distinct (school_domain, sport, full_name, jersey)
);
comment on table public.roster_entries is 'Current college rosters read from schools'' own roster pages (scripts/rosters). One row per athlete per team. Instagram is the identifier; instagram_source says whether the school listed it or it was matched from existing data.';

create index if not exists roster_entries_instagram_idx on public.roster_entries (lower(instagram));
create index if not exists roster_entries_school_sport_idx on public.roster_entries (school_domain, sport);
create index if not exists roster_entries_person_idx on public.roster_entries (person_id);

alter table public.roster_entries enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'roster_entries' and policyname = 'roster_entries_staff_all') then
    create policy roster_entries_staff_all on public.roster_entries
      for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff());
  end if;
end $$;

drop trigger if exists roster_entries_set_updated_at on public.roster_entries;
create trigger roster_entries_set_updated_at before update on public.roster_entries
  for each row execute function public.set_updated_at();
