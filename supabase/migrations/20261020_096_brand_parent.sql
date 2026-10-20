-- ============================================================
-- 096 — Parent brand link.
-- Some brands ran their campaigns under a parent company or an agency
-- (e.g. Walmart under Dove, Betterhelp under Golin, Flamin' Hot under
-- PepsiCo, M&M under Mars). parent_brand_id records that, so a brand
-- with no campaigns of its own still shows who it worked through.
-- Additive and nullable; safe to apply before 083.
-- Applied to production (xqaybwhpgxillpbbqtks) on 2026-10-20.
-- ============================================================
alter table public.brands
  add column if not exists parent_brand_id uuid references public.brands(id) on delete set null;
create index if not exists brands_parent_brand_id_idx on public.brands (parent_brand_id);
comment on column public.brands.parent_brand_id is
  'Parent company or agency this brand ran campaigns through (null = runs its own).';
