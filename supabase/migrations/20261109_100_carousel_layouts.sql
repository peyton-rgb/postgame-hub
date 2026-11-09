-- ============================================================
-- Migration 100: carousel layouts + media, carried over from the
-- "Carousel Layout Editor" artifact.
--
-- carousel_layouts      one row per athlete: the saved layout exactly as
--                       the artifact stored it (canvas, guides, layers).
-- carousel_reel_covers  each athlete's saved reel-cover pick.
-- carousel_media        what each layer's `media` key points to
--                       (label, kind, size, duration) and where its files
--                       live in the private `carousels` storage bucket.
--
-- The artifact itself is left untouched as a backup.
-- Acaden Lewis joins carousel_athletes here: he has a saved carousel but
-- his Frame.io SELECTED folder isn't known yet, so both folder ids are null.
-- ============================================================

insert into public.carousel_athletes (slug, name, frameio_selected_folder_id, sort_order)
values ('acaden_lewis', 'Acaden Lewis', null, 0)
on conflict (slug) do nothing;

create table if not exists public.carousel_layouts (
  slug               text primary key references public.carousel_athletes(slug) on delete cascade,
  layout             jsonb not null,
  device             text,
  saved_at           timestamptz,
  source_doc_id      text,          -- artifact document id, e.g. carousel_billy
  source_version     int,
  source_updated_at  timestamptz,
  imported_at        timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.carousel_reel_covers (
  slug               text primary key references public.carousel_athletes(slug) on delete cascade,
  cover              jsonb not null,
  source_doc_id      text,
  source_version     int,
  source_updated_at  timestamptz,
  imported_at        timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.carousel_media (
  media_key   text primary key,
  info        jsonb not null,         -- label, kind, w, h, dur, in0, group, athlete, cutout…
  files       jsonb not null,         -- { proxy, full, strip, thumb } → storage paths in `carousels`
  created_at  timestamptz not null default now()
);

alter table public.carousel_layouts     enable row level security;
alter table public.carousel_reel_covers enable row level security;
alter table public.carousel_media       enable row level security;

create policy carousel_layouts_staff_all on public.carousel_layouts
  for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff());
create policy carousel_reel_covers_staff_all on public.carousel_reel_covers
  for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff());
create policy carousel_media_staff_read on public.carousel_media
  for select to authenticated using (public.is_postgame_staff());

-- Private bucket; staff read through signed URLs.
insert into storage.buckets (id, name, public)
values ('carousels', 'carousels', false)
on conflict (id) do nothing;

create policy carousels_bucket_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'carousels' and public.is_postgame_staff());
