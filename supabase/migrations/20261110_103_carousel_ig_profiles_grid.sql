-- The athlete's recent Instagram posts (small JPEG data URIs, newest first),
-- shown in the profile grid of the carousel preview video. Captured from the
-- athlete's public profile; internal review use only.
alter table public.carousel_ig_profiles
  add column grid jsonb not null default '[]'::jsonb;
