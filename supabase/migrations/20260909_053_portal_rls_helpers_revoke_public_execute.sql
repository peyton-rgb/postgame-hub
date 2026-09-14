-- Take EXECUTE on the two Phase 2 helpers away from PUBLIC and anon.
--
-- WHY. Postgres grants EXECUTE on a new function to PUBLIC by default, and
-- Supabase exposes every function in the `public` schema as an RPC. Migrations
-- 050/051 granted EXECUTE to `authenticated` explicitly but never removed the
-- default, so both helpers were reachable unauthenticated at
-- /rest/v1/rpc/is_brand_user and /rest/v1/rpc/my_brand_ids. The database
-- linter flags this as anon_security_definer_function_executable.
--
-- SEVERITY: low, not zero. Called as anon, auth.uid() is null, so
-- is_brand_user() returns false and my_brand_ids() returns no rows — there is
-- nothing to leak today. But both are SECURITY DEFINER and read profiles and
-- brand_contacts as their owner, so leaving them callable by anyone holding
-- the publishable key is a standing invitation for the next edit to one of
-- them to become a real disclosure.
--
-- SAFE TO REVOKE, checked rather than assumed: all 24 RLS policies that
-- reference either helper are granted TO authenticated. No anon-facing policy
-- calls them, so anon never needs EXECUTE to satisfy a policy. Confirmed from
-- pg_policies before applying.
--
-- authenticated KEEPS execute because the policies genuinely need it, and a
-- signed-in user calling these learns only their own brand attachment, which
-- they already know. service_role keeps it as the backend identity.
--
-- VERIFIED AFTER APPLYING:
--   · ACL is now postgres/authenticated/service_role — the bare PUBLIC entry
--     (=X/postgres) is gone; has_function_privilege('anon', ...) is false
--   · through the real REST API with the publishable key, both RPCs return
--     HTTP 401 / SQLSTATE 42501 "permission denied for function"
--   · anon table reads are byte-identical to the pre-Phase-2 baseline:
--     84 recaps / 3,266 athletes / 4,241 media / 126 brands / 381 logos /
--     2,120 media_campaigns / 2,130 media_athletes / 0 review_sessions
--   · supabase/tests/rls-phase2.sql still passes 20 of 20
--
-- STILL FLAGGED BY THE LINTER, deliberately out of scope here: is_staff(),
-- is_postgame_staff(), handle_new_user(), notify_athletes_new_deal(),
-- protect_profile_privileged_columns() and review_sessions_brand_columns()
-- carry the same default PUBLIC grant. The last three are trigger functions,
-- which PostgREST cannot usefully invoke, but the grants are still worth
-- tidying in a pass of their own.
--
-- Rollback:
--   grant execute on function public.is_brand_user() to public;
--   grant execute on function public.my_brand_ids() to public;

revoke all on function public.is_brand_user() from public;
revoke all on function public.is_brand_user() from anon;

revoke all on function public.my_brand_ids() from public;
revoke all on function public.my_brand_ids() from anon;

grant execute on function public.is_brand_user() to authenticated, service_role;
grant execute on function public.my_brand_ids() to authenticated, service_role;
