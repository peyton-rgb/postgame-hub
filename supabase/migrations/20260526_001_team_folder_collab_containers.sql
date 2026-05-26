-- ============================================================
-- Migration: team_folder_collab_containers
-- Adds school-alias lookup + collab container tables for the
-- content upload team-folder detection feature.
-- Applied to project xqaybwhpgxillpbbqtks (POSTGAME HUB).
-- ============================================================

-- 1. School abbreviation lookup
create table if not exists public.school_aliases (
  id          uuid primary key default gen_random_uuid(),
  alias       text not null unique,
  school_name text not null,
  created_at  timestamptz not null default now()
);

insert into public.school_aliases (alias, school_name) values
  ('UF',   'University of Florida'),
  ('FSU',  'Florida State University'),
  ('UCLA', 'University of California, Los Angeles'),
  ('UGA',  'University of Georgia'),
  ('UNC',  'University of North Carolina'),
  ('OU',   'University of Oklahoma'),
  ('LSU',  'Louisiana State University')
on conflict (alias) do nothing;

-- 2. Collab containers
create table if not exists public.collab_containers (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references public.campaign_recaps(id) on delete cascade,
  team_name       text not null,
  school          text,
  sport           text,
  drive_folder_id text,
  platform        text,
  post_url        text,
  source          text not null default 'auto',
  created_at      timestamptz not null default now(),
  unique (campaign_id, drive_folder_id)
);

create index if not exists idx_collab_containers_campaign
  on public.collab_containers (campaign_id);

-- 3. Collab container membership
create table if not exists public.collab_container_athletes (
  id           uuid primary key default gen_random_uuid(),
  container_id uuid not null references public.collab_containers(id) on delete cascade,
  athlete_id   uuid not null references public.athletes(id) on delete cascade,
  included     boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (container_id, athlete_id)
);

create index if not exists idx_cca_container on public.collab_container_athletes (container_id);
create index if not exists idx_cca_athlete   on public.collab_container_athletes (athlete_id);

-- 4. RLS — mirror existing athletes/media pattern
alter table public.school_aliases             enable row level security;
alter table public.collab_containers          enable row level security;
alter table public.collab_container_athletes  enable row level security;

create policy "Auth users full access to school_aliases"
  on public.school_aliases for all to authenticated using (true) with check (true);
create policy "Public can read school_aliases"
  on public.school_aliases for select to public using (true);

create policy "Auth users full access to collab_containers"
  on public.collab_containers for all to authenticated using (true) with check (true);
create policy "Public can view collab_containers in published campaigns"
  on public.collab_containers for select to public
  using (exists (
    select 1 from public.campaign_recaps
    where campaign_recaps.id = collab_containers.campaign_id
      and campaign_recaps.published = true
  ));

create policy "Auth users full access to collab_container_athletes"
  on public.collab_container_athletes for all to authenticated using (true) with check (true);
create policy "Public can view collab_container_athletes in published campaigns"
  on public.collab_container_athletes for select to public
  using (exists (
    select 1 from public.collab_containers c
    join public.campaign_recaps r on r.id = c.campaign_id
    where c.id = collab_container_athletes.container_id
      and r.published = true
  ));
