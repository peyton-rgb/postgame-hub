-- ============================================================
-- Posting instructions 2b: one link per athlete, and Feed carousels.
--
-- TWO CHANGES, both additive. Nothing is dropped or renamed.
--
-- 1. posting_packages.athlete_key — staples one athlete's posts together
--    within a campaign. Today each athlete has two rows (reel + feed) and
--    each row has its own delivery_token; the athlete page now loads every
--    row sharing (posting_campaign_id, athlete_key) so EITHER of an
--    athlete's existing tokens opens the same combined page. No token is
--    invalidated: every link already texted out keeps working.
--
--    The backfill groups on trim(athlete_name) because names carry stray
--    whitespace (CLAUDE.md: match with TRIM). At the time of writing that is
--    22 groups over 44 rows, each group one reel and one feed.
--
-- 2. posting_package_files — the photos of a Feed carousel, in order.
--    A Feed post is several photos, not one, so they cannot live in a single
--    column. The Reel keeps video_url / cover_url exactly as they are;
--    nothing is migrated out of them.
--
--    cover_url on feed rows is null on all 22 rows today and stays null —
--    feed photos live here instead. The attach route stops writing feed
--    photos to cover_url in the same PR.
--
-- RLS: staff-only, matching posting_packages (migration 073). No anon policy
-- on either table. The athlete page reads through the service-role client in
-- src/lib/deliver-package.ts, which bypasses RLS by design.
-- ============================================================

begin;

-- ---- 1. athlete_key -------------------------------------------------------

alter table public.posting_packages
  add column if not exists athlete_key uuid;

comment on column public.posting_packages.athlete_key is
  'Groups one athlete''s posts within a posting campaign. All rows sharing (posting_campaign_id, athlete_key) render on one athlete page, reachable by any of their delivery_tokens.';

-- One fresh uuid per (campaign, trimmed name). Only fills rows that have
-- none, so re-running this migration cannot re-key an athlete whose link is
-- already out in the world.
with groups as (
  select
    posting_campaign_id,
    trim(athlete_name) as trimmed_name,
    gen_random_uuid()  as new_key
  from public.posting_packages
  where athlete_key is null
  group by posting_campaign_id, trim(athlete_name)
)
update public.posting_packages p
set athlete_key = g.new_key
from groups g
where p.athlete_key is null
  and trim(p.athlete_name) = g.trimmed_name
  and p.posting_campaign_id is not distinct from g.posting_campaign_id;

-- The lookup the athlete page makes on every load.
create index if not exists posting_packages_campaign_athlete_idx
  on public.posting_packages (posting_campaign_id, athlete_key);

-- ---- 2. posting_package_files --------------------------------------------

create table if not exists public.posting_package_files (
  id            uuid primary key default gen_random_uuid(),
  package_id    uuid not null references public.posting_packages (id) on delete cascade,
  kind          text not null check (kind in ('photo')),
  position      integer not null,
  url           text not null,
  storage_path  text,
  drive_file_id text,
  file_name     text,
  created_at    timestamptz not null default now()
);

comment on table public.posting_package_files is
  'Ordered files belonging to one posting package. Today: the photos of a Feed carousel. The Reel''s video/cover stay on posting_packages.';

-- Two photos cannot share a slot in the carousel.
create unique index if not exists posting_package_files_package_position_key
  on public.posting_package_files (package_id, position);

-- Reading one package's photos in order.
create index if not exists posting_package_files_package_idx
  on public.posting_package_files (package_id, position);

alter table public.posting_package_files enable row level security;

drop policy if exists "posting_package_files_staff_all" on public.posting_package_files;
create policy "posting_package_files_staff_all"
  on public.posting_package_files
  for all
  to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

commit;
