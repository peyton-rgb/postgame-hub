-- 075: per-platform links + Story screenshot for posting packages
--
-- Every post now goes up in four places: the Instagram post, the athlete's
-- Instagram Story (proved with a screenshot), TikTok and X. A post counts as
-- Posted — the payment trigger — only once all four are in; the app sets
-- status/posted_at in one place, maybeMarkPosted() in src/lib/deliver-package.ts.
--
-- Additive only. posting_packages.live_url stays and keeps holding the
-- Instagram link, so everything that reads it today keeps working.
--
-- One Story screenshot per post: it is stored at position 0. Carousel photos
-- use positions 1…n, and the existing unique index on (package_id, position)
-- therefore allows exactly one row at 0 — no second screenshot can land.
--
-- NOT part of this migration: the campaign's `deliverables` platform lists.
-- The planner updates those after the code is merged; the code treats all
-- four platforms as required either way.
--
-- Applied by the planner chat through MCP; committed here for repo parity.

-- a) Story screenshots live in the existing files table
alter table public.posting_package_files
  drop constraint posting_package_files_kind_check;
alter table public.posting_package_files
  add constraint posting_package_files_kind_check
  check (kind in ('photo', 'story_screenshot'));

-- b) One row per platform link
create table public.posting_package_links (
  id           uuid primary key default gen_random_uuid(),
  package_id   uuid not null references public.posting_packages(id) on delete cascade,
  platform     text not null check (platform in ('instagram', 'tiktok', 'x')),
  url          text not null,
  submitted_at timestamptz not null default now(),
  unique (package_id, platform)
);
create index posting_package_links_package_id_idx
  on public.posting_package_links (package_id);

alter table public.posting_package_links enable row level security;
create policy posting_package_links_staff_all
  on public.posting_package_links
  for all to authenticated
  using ((select is_staff())) with check ((select is_staff()));
