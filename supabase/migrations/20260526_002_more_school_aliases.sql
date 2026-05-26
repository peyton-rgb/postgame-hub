-- ============================================================
-- Migration: more_school_aliases
-- Adds UCF / USF abbreviations to the school alias lookup so
-- Drive folders named with those abbreviations auto-detect.
-- Applied to project xqaybwhpgxillpbbqtks (POSTGAME HUB).
-- ============================================================

insert into public.school_aliases (alias, school_name) values
  ('UCF', 'University of Central Florida'),
  ('USF', 'University of South Florida')
on conflict (alias) do nothing;
