-- ============================================================
-- Migration 101: every save of a carousel layout is kept.
--
-- carousel_layout_versions holds one row per save (the full layout as it was
-- saved), so any earlier state of an athlete's carousel can be restored.
-- Seeded with each layout as imported from the old artifact (migration 100).
-- Applied to production 2026-11-09 (36 rows seeded, all matching).
-- ============================================================

create table if not exists public.carousel_layout_versions (
  id          bigserial primary key,
  slug        text not null references public.carousel_athletes(slug) on delete cascade,
  layout      jsonb not null,
  saved_by    uuid,               -- auth user id; null for the import
  note        text,               -- e.g. 'imported from artifact'
  saved_at    timestamptz not null default now()
);
create index if not exists carousel_layout_versions_slug_idx on public.carousel_layout_versions (slug, saved_at desc);

alter table public.carousel_layout_versions enable row level security;
create policy carousel_layout_versions_staff_read on public.carousel_layout_versions
  for select to authenticated using (public.is_postgame_staff());

insert into public.carousel_layout_versions (slug, layout, note, saved_at)
select slug, layout, 'imported from artifact (' || coalesce(source_doc_id, '?') || ' v' || coalesce(source_version::text, '?') || ')',
       coalesce(saved_at, imported_at)
from public.carousel_layouts
where not exists (select 1 from public.carousel_layout_versions v where v.slug = carousel_layouts.slug);
