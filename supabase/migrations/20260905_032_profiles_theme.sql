-- Per-user Hub theme preference.
--
-- Read server-side on /dashboard so the correct theme is in the HTML before
-- first paint (no flash of the wrong theme), and mirrored to localStorage
-- client-side for instant application on subsequent navigations.
--
-- Dark is the default: it is the existing appearance, so every current row is
-- correct without a backfill.
--
-- Client-facing surfaces — recaps, pitch pages, case studies — ignore this and
-- stay dark. A client opening a recap sees the brand presentation, not a staff
-- member's preference.

alter table public.profiles
  add column if not exists theme text not null default 'dark';

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check check (theme in ('dark', 'light'));

comment on column public.profiles.theme is
  'Hub UI theme: dark (default) or light. Client-facing surfaces — recaps, '
  'pitch pages, case studies — ignore this and stay dark.';
