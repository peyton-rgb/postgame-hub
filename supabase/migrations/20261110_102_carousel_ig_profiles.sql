-- Each carousel athlete's Instagram profile details, for the editor's IG frame
-- and (later) the phone preview: handle, display name, blue check, counts, bio
-- and a small profile photo (data URI, ~7–15 KB). Seeded from the IG captures
-- taken for the artifact editor; an athlete with no row gets a plain fallback.

create table public.carousel_ig_profiles (
  slug         text primary key references public.carousel_athletes(slug) on delete cascade,
  handle       text not null,
  display_name text,
  verified     boolean not null default false,
  followers    text,
  following    text,
  posts        integer,
  bio          jsonb not null default '[]'::jsonb,
  avatar       text,
  source       text not null default 'ig_capture',
  captured_at  timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.carousel_ig_profiles enable row level security;

create policy carousel_ig_profiles_staff_all on public.carousel_ig_profiles
  for all to authenticated using (public.is_postgame_staff()) with check (public.is_postgame_staff());
