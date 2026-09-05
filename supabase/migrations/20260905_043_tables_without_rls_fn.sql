-- ============================================================
-- public.tables_without_rls() — the weekly health check's RLS section.
--
-- pg_class is not reachable through PostgREST, so the check needs a function.
-- SECURITY DEFINER because relrowsecurity is not readable by the anon or
-- authenticated roles; the answer is a list of table NAMES with no row data,
-- so nothing sensitive crosses the boundary.
--
-- EXECUTE granted to service_role only. The health check runs unattended with
-- the service key; nothing in the browser calls this.
--
-- ALREADY APPLIED to POSTGAME HUB (xqaybwhpgxillpbbqtks) on 2026-09-05.
-- ============================================================

create or replace function public.tables_without_rls()
returns table (table_name text)
language sql
security definer
set search_path = pg_catalog, public
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity = false
  order by c.relname;
$$;

revoke all on function public.tables_without_rls() from public, anon, authenticated;
grant execute on function public.tables_without_rls() to service_role;

comment on function public.tables_without_rls() is
  'Public tables with row level security switched off. Read by /api/cron/health-check.';
